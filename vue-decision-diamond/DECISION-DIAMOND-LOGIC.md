# Decision Diamond — Behaviour Reference

**Purpose.** A canonical write-up of how the Decision Diamond node works in
the Pebble automation builder: what it does, what users can configure, and
how the AI assistant maps to that. Intended for product, design, and
engineering stakeholders.

**Source of truth.** Drawn from the live code in
`src/automations/builder/DecisionDiamondEditor.vue`,
`src/decisionDiamond/`, and `src/lib/ai/`. Any divergence between this doc
and the code should be treated as a doc bug.

**Last updated.** 2026-05-21

---

## Contents

1. [What it is](#1-what-it-is)
2. [Data model & boolean semantics](#2-data-model--boolean-semantics)
3. [Available conditions](#3-available-conditions)
4. [Trigger entity attribute reference](#4-trigger-entity-attribute-reference)
5. [Default routing](#5-default-routing)
6. [User abilities — direct UI](#6-user-abilities--direct-ui)
7. [User abilities — AI assistant](#7-user-abilities--ai-assistant)
8. [Special flow — "rule set for sequence N"](#8-special-flow--rule-set-for-sequence-n-andor-clarification)
9. [Lifecycle invariants](#9-lifecycle-invariants)
10. [Save & persistence](#10-save--persistence)
11. [Accessibility](#11-accessibility)
12. [Architecture footnote](#12-architecture-footnote)

---

## 1. What it is

A **routing node** in an automation. Records (deals, contacts, etc.) flow
in; the diamond evaluates them against a set of **sequences** (branches)
and sends each record down exactly one path. Records that match no
sequence fall through to the **default routing**.

## 2. Data model & boolean semantics

```
DecisionDiamondConfig
├─ groups: Sequence[]          ← evaluated in order; FIRST MATCH WINS
│   └─ Sequence
│      ├─ id, targetFlowId, targetName
│      └─ blocks: Block[]      ← OR-joined within a sequence
│         └─ Block
│            └─ conditions[]   ← AND-joined within a block
│               └─ Condition { field, operator, values[] }
└─ defaultRouting              ← '__drop__' | sequence's targetFlowId
```

| Level                       | Boolean op                | Meaning                                                                       |
| --------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| Sequences in `groups[]`     | priority — first match    | Record exits via the *first* sequence whose rules all pass                    |
| Blocks in `blocks[]`        | **OR**                    | Sequence passes if *any* block passes                                         |
| Conditions in `conditions[]`| **AND**                   | Block passes only if *all* conditions pass                                    |

A sequence with **zero blocks** is a pass-through — anything that reaches
it falls in.

## 3. Available conditions

| Field id              | Field label           | Allowed operators                       | Allowed values                                                                                       |
| --------------------- | --------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `dealValue`           | Deal Value            | `equals`, `exceeds`, `lessThan`, `between` | Dollar amount(s) as numeric string. `between` takes `[min, max]`.                                  |
| `dealStage`           | Deal Stage            | `equals`                                | One of: `New`, `Qualified`, `Estimate Sent`, `Scheduled`, `Won`, `Lost`                              |
| `dealCompletionTime`  | Deal Completion Time  | `between`                               | Two ISO date strings `[start, end]`                                                                  |
| `dealExpirationTime`  | Deal Expiration Time  | `between`                               | Two ISO date strings `[start, end]`                                                                  |

Default value picks when the user omits them: stage→`Qualified`,
value→`1000`, completion→`[7 days ago, today]`,
expiration→`[today, 7 days ahead]`.

## 4. Trigger entity attribute reference

> **Source of truth:** [Decision diamond 2.0 concepts — Complete Trigger
> Entity Attribute Reference](https://thryv.atlassian.net/wiki/spaces/~63bf451d0913ada386aafd07/pages/4368859204/Decision+diamond+2.0+concepts#Complete-Trigger-Entity-Attribute-Reference).
> This section mirrors that doc for engineering convenience — when the
> two ever drift, the Confluence page wins.

Decision diamonds branch on a record that arrives from an upstream
trigger. The four supported triggers below carry different attributes
into the diamond. The form fields the user configures on the **When**
step determine what data the diamond can route on downstream.

### 4.1 Product is purchased — *"When a purchase is made"*

| Attribute | Required | Type | Options / behavior | Dependency |
| --- | --- | --- | --- | --- |
| **Select purchase type** | Yes | Single-select | **Product** — "When a specific product is purchased" / **Any purchase** — "When any purchase is made" | Top-level driver |
| **Select products** | Conditional | Multi-select with categories | Full product catalog (e.g., `1 Hour Consult`, `30 min consult`, `Expensive Product`, `Jialing consultation fee 30/60 mins`). Each item shows its category (e.g., `Uncategorized`). | **Only when purchase type = "Product"**. Hidden when purchase type = "Any purchase". |
| **Payment type** *(optional)* | No (marked optional but with red asterisk) | Multi-select | Credit Card (charge now), Credit Card (Manual), Check, Cash, Money Order, Adjustment, Include $0 invoices, Any payment type (incl. future-created types) | Always visible regardless of purchase type |

### 4.2 Quote status

| Attribute | Required | Type | Options / behavior | Dependency |
| --- | --- | --- | --- | --- |
| **Trigger when quote is…** | Yes | Single-select | **Sent**, **Viewed**, **Accepted** *(Payment options unavailable)* | None — this is the only attribute |

### 4.3 Pipeline stage is moved — *"Pipeline stage move"*

| Attribute | Required | Type | Options / behavior | Dependency |
| --- | --- | --- | --- | --- |
| **When moving** | Yes | Single-select | **Into** — trigger when deal moves *into* the selected stage / **Out of** — trigger when deal moves *out of* the selected stage | Top-level direction selector |
| **Pipeline** | Yes | Single-select | List of all configured pipelines in the account (in the reference tenant: `My Pipeline`, `Custom pipeline`, `Sales pipeline`, `delete stage 2 Custom pipeline`, …) | Independent — but its value drives the **Stage** options |
| **Stage** | Yes | Single-select | List of all stages belonging to the selected pipeline. E.g. for *My Pipeline*: `New leads`, `Qualified leads`, `Quote sent`, `Negotiating`, `Quote accepted`, `Felipe Testing`, `Felipe Pipeline Test`, `Felipe Stage Test`, `Felipe Cant Repro No More`. | **Dependent on Pipeline** — the stages shown change based on the selected pipeline |

### 4.4 Appointment

| Attribute | Required | Type | Options / behavior | Dependency |
| --- | --- | --- | --- | --- |
| **When a contact** | Yes | Single-select | **Schedules**, **Reschedules**, **Cancels** | Top-level event selector |
| **Select an appointment type** | Yes | Single-select | List of all appointment types configured in the account, each shown with duration. E.g. `60-Minute Coaching Call with Jialing Chen (60 minutes)`, `15-Minute Initial Consultation with Jialing Chen (15 minutes)`, `Appointment 2 with Marvin Abisrror (2 hours)`, `Appointment 1 with Miguel Orantes`, … | Always shown — the same field appears under **Schedules** / **Reschedules** / **Cancels** |

### 4.5 Summary of dependent / conditional logic

Only two trigger entities have form fields that show or hide based on
other selections:

- **Product is purchased** — the **Select products** picker only renders
  when **Select purchase type = "Product"**. Switching to **Any
  purchase** removes that field entirely while **Payment type**
  remains visible.
- **Pipeline stage is moved** — the **Stage** dropdown is populated
  *dynamically* from the selected **Pipeline**; changing the pipeline
  replaces the stage list with that pipeline's stages.

**Quote status** and **Appointment** have no conditional show/hide
attributes — every field is visible regardless of which option is
chosen in the upper drop-downs.

## 5. Default routing

Configured via the **"If nothing matches, where should it go?"** dropdown
at the bottom of the editor.

- **Don't put them in a sequence** (`__drop__`) — silently discard
  non-matching records.
- **Sequence N** — route fall-through records into Sequence N. Useful as a
  catch-all branch.

If a sequence used as default is later deleted, the routing auto-resets to
`__drop__`.

## 6. User abilities — direct UI

| Affordance                                                                  | Effect                                                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **+ Add a rule** (inside a sequence card)                                   | Appends a new **OR-block** with one empty condition row                                           |
| **+ And condition** (chat quick-reply pill)                                 | Adds a new condition row to the *last* existing block in that sequence (AND-joined)               |
| **+ Or rule** (chat quick-reply pill)                                       | Adds a new OR-block with one empty condition row                                                  |
| **+ Add a new rules set for Sequence N+1** (button below all cards)         | Creates a new empty sequence                                                                      |
| Per-sequence `⋮` menu — **Move up / Move down**                             | Reorder sequences (first-match-wins order matters)                                                |
| Per-sequence `⋮` menu — **Import rules from…**                              | Placeholder for cross-diamond reuse (not wired in this prototype)                                 |
| Per-sequence `⋮` menu — **Clear all rules**                                 | Removes all blocks, sequence card stays                                                           |
| Per-sequence `⋮` menu — **Delete this sequence**                            | Removes the card. **Minimum 1 sequence enforced** — last one can't be deleted.                    |
| Per-rule `⋮` menu — **Remove rule**                                         | Removes a single condition. Block auto-deletes if its last condition is removed.                  |
| Per-rule **Duplicate**                                                      | Copies a single AND-condition or an entire OR-block                                               |
| Drag handle on sequence card                                                | Reorders sequences via drag-and-drop with a drop indicator                                        |
| **Default routing** dropdown                                                | Pick `__drop__` or any existing sequence                                                          |
| **AI assistant** toggle (top-right)                                         | Shows / hides the chat panel on the left                                                          |
| **New chat** button                                                         | Confirms then resets the chat transcript. Rules pane is preserved.                                |
| **Save**                                                                    | Closes the editor (config is already live-bound to canvas state — see §9)                         |
| **X (close)**                                                               | Same as Save in this prototype — there's no discard semantic at this layer                        |

## 7. User abilities — AI assistant

**Backend transports**

- **Stub** (default, in-process) — regex-driven planner returning real
  Anthropic-shape SSE events. Lets us develop the full client against the
  live wire format without an API key.
- **Real Anthropic Claude** (Sonnet 4.5) when `VITE_AI_API_URL` is set —
  same protocol, real reasoning. Deploy template lives in
  `infra/ai-chat-lambda.ts`.

The AI never edits state directly — it emits typed **tool calls** that the
editor executes against the live config.

### 7.1 Tool catalogue

| Tool                       | Args                                                                                              | What it does                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add_sequence`             | `{ name_hint? }`                                                                                  | Append an empty sequence                                                                                                                                              |
| `delete_sequence`          | `{ sequence_index }`                                                                              | Remove a sequence (refuses if it's the last one; system prompt requires confirmation if rules present)                                                                |
| `clear_sequence`           | `{ sequence_index }`                                                                              | Remove all rules in a sequence (system prompt requires confirmation)                                                                                                  |
| `add_condition`            | `{ sequence_index?, all_sequences?, field?, operator?, values? }`                                 | Append an AND-joined condition. **Self-heals**: creates a sequence first if none exist. Omitting `field` opens an empty row. `all_sequences:true` applies to every sequence. |
| `remove_condition`         | `{ sequence_index?, field? }`                                                                     | Remove a condition (by field, or the most recent one). Empty blocks auto-collapse.                                                                                    |
| `mirror_condition`         | `{ source_sequence, target_sequences[] }`                                                         | Copy a condition from one sequence to others                                                                                                                          |
| `set_default_routing`      | `{ target: "drop" \| "<index>" }`                                                                 | Set fall-through behaviour                                                                                                                                            |
| `explain_current_rules`    | `{ sequence_index? }`                                                                             | Read-only — returns a plain-English summary                                                                                                                           |
| `list_available_fields`    | —                                                                                                 | Read-only — returns the canonical field/operator/stage list                                                                                                           |

### 7.2 Natural-language parsing

The stub backend understands a wide range of phrasings. The list below is
a sample, not exhaustive.

| User phrasing                                                       | Routed to                                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| "add a new rule set", "create a ruleset", "new set of rules"        | `add_sequence` (or rule-set-for-sequence flow if a target sequence is named — see §7)                  |
| "**new**/another/additional sequence" / "branch" / "path" / "track" | `add_sequence`                                                                                         |
| "add deal value over $5,000 to sequence 1"                          | `add_condition({ sequence_index: 0, field: dealValue, operator: exceeds, values: ["5000"] })`         |
| "deal value above $10k to all sequences"                            | `add_condition({ all_sequences: true, field: dealValue, operator: exceeds, values: ["10000"] })`      |
| "qualified deals", "won leads" (bare stage names)                   | `add_condition({ field: dealStage, values: [<stage>] })`                                              |
| "add deal completion time to sequence 1"                            | `add_condition({ sequence_index: 0, field: dealCompletionTime })` (operator + values default in)      |
| "clear sequence 2" / "wipe the second branch"                       | `clear_sequence({ sequence_index: 1 })`                                                                |
| "delete sequence 3" / "kill the third path"                         | `delete_sequence({ sequence_index: 2 })`                                                               |
| "remove deal value from sequence 1"                                 | `remove_condition({ sequence_index: 0, field: dealValue })`                                            |
| "what's set up?", "explain my rules", "summarize sequence 2"        | `explain_current_rules`                                                                                |
| "list the fields", "which operators can I use?"                     | `list_available_fields`                                                                                |
| "default route to drop" / "route fallback to sequence 1"            | `set_default_routing`                                                                                  |
| Affirmative ("yes", "do it") / negative ("no", "never mind")        | Routed to pending-confirmation handlers (e.g. confirms a destructive op or accepts a mirror offer)     |

The parser tolerates plural typos throughout (`rules?`, `sets?`,
`branches?`) and treats *branch / path / track* as synonyms for *sequence*.
A bare currency amount (e.g. "$5,000") implies `dealValue`; a bare stage
name (e.g. "Qualified") implies `dealStage`.

### 7.3 Real-time preview

Every AI-driven mutation:

1. Lands in the rules pane *immediately* (before the chat reply animates
   in) — the right pane is the live preview.
2. Pulses purple on the affected sequence card and auto-scrolls it into
   view.
3. Records the assistant turn in the conversation history so the next
   prompt has full context.

The chat reply streams in token-by-token after the mutation so the
response feels generated rather than instant.

## 8. Special flow — "rule set for sequence N" (AND/OR clarification)

A client-side state machine that runs **before** the AI client to give
the user explicit AND/OR control over how a new rule joins a target
sequence.

**Step 1 — interception.** The editor parses the prompt for a pattern
matching `(rule set | ruleset | rule group | set of rules) +
sequence/branch N`.

**Step 2 — branch on existence.**

- **If Sequence N already exists** → no mutation; ask:
  > *"Sequence N already exists. Should I add the new rule as **AND**
  > (joined with the existing rules in that sequence) or **OR** (a
  > separate rule group)?"*

- **If Sequence N doesn't exist** → atomically create empty sequences up
  to index N (one `cloneConfig` + N pushes + one emit); pulse-highlight
  the new card; ask:
  > *"Created Sequence N. Would you like the first rule joined as
  > **AND** (single condition) or **OR** (lets you add alternative rule
  > groups later)?"*

**Step 3 — interpret the user's next reply.**

| Reply                                            | Action (mirrors the existing UI pills exactly)                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `AND` / `&` / `+`                                | `addEmptyConditionRow` — appends a new condition row to the *last* block, sets pending-fill slot, scrolls + focuses the field `<select>` |
| `OR` / `\|`                                      | `addBlock` — new OR-joined block with one empty condition row, same scroll-focus behaviour                                              |
| `cancel` / `never mind` / `stop`                 | Clears pending state — *"OK — leaving things as they are."*                                                                             |
| Anything else                                    | Clears pending state and falls through to normal AI interpretation, so the user can naturally redirect (e.g. "actually add deal value to sequence 1") |

**Why client-side.** The in-process stub backend is stateless and can't
inspect the current config. A real Claude backend would achieve the same
outcome via the system prompt + `explain_current_rules` tool — Claude
reads state, then asks. When the build is flipped to Lambda the
user-visible behaviour stays identical; the implementation just moves
server-side.

## 9. Lifecycle invariants

- **Minimum 1 sequence** — `delete_sequence` and the UI delete option
  both refuse the last sequence.
- **Auto-dissolve is OFF** for decision diamonds. They persist even if
  reduced to a single outgoing edge (unlike other branching nodes).
- **Empty blocks auto-collapse** when a condition is removed and would
  leave the block empty.
- **Default-routing self-heal** — if the sequence used as fallback is
  deleted, defaults to `__drop__`.
- **Self-healing on first prompt** — if the user's first AI prompt is a
  condition-add and no sequence exists yet, the relevant tool/handler
  seeds Sequence 1 first so the condition has somewhere to land.
- **Pulse highlight + auto-scroll** on every AI-driven mutation so the
  user can see exactly which sequence card changed (respects
  `prefers-reduced-motion`).
- **Atomic multi-sequence creation** — when "for sequence 5" is asked of
  a diamond with 1 sequence, sequences 2 through 5 are created in a
  single emit (one `cloneConfig` + N pushes + one emit). Calling
  `addSequence()` in a loop does not work because Vue propagates props
  on the next render tick, so each iteration would re-clone the same
  stale config and each emit would overwrite the previous.

## 10. Save & persistence

The editor's `config` prop is two-way bound (`v-model`) to the parent
automation builder. Every mutation — AI-driven or UI-driven — flows
through `emit('update:config', next)` immediately. **There is no
"discard" after a mutation** in this prototype; the Save button is
currently a sugar synonym for Close.

For a production version this is where you'd add explicit dirty-state
tracking, an "unsaved changes" indicator, and a discard-confirmation
dialog on Close.

## 11. Accessibility

- Sequence cards have `aria-labelledby` pointing at their title heading.
- Drag handles have `aria-label="Drag to reorder Sequence N"` plus
  keyboard `↑/↓` support.
- Streaming chat replies use `aria-live="polite"` so screen readers
  announce the assistant's text as it lands.
- AND/OR clarification text uses bold (`**AND**`/`**OR**`) — readable by
  both sighted and screen-reader users.
- Field `<select>` auto-focus on AND/OR action means keyboard users
  continue smoothly from chat → rule editing without a focus jump.
- Pulse animation is replaced with a static outline when
  `prefers-reduced-motion` is set.
- All in-canvas overlays (action menu, tooltips, picker) inverse-scale
  against the canvas zoom level via the `--canvas-zoom` CSS variable so
  text never shrinks below a readable size.

## 12. Architecture footnote

Files of interest, for engineers who need to dig in:

| Path                                                       | Role                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/automations/builder/DecisionDiamondEditor.vue`        | The editor itself — rules pane, chat panel, tool dispatcher, state machine. ~4,500 lines.                          |
| `src/automations/builder/AutomationBuilder.vue`            | Canvas surface, pan/zoom, node insertion, `decisionConfigs` reactive store.                                       |
| `src/decisionDiamond/engine.ts`                            | Pure functions: `insertDecisionDiamondAfter`, `syncGroupsToEdges`, `dissolveCollapsedDiamonds`.                    |
| `src/decisionDiamond/types.ts`                             | `DecisionDiamondConfig`, `DDGroup`, `DDBlock`, `DDCondition` type definitions.                                    |
| `src/lib/ai/aiTypes.ts`                                    | Anthropic Messages API wire format as TypeScript types.                                                           |
| `src/lib/ai/aiTools.ts`                                    | The 9 typed tool definitions (real Anthropic JSON Schema).                                                        |
| `src/lib/ai/aiSystemPrompt.ts`                             | Frozen CRM domain glossary + tool-use guidelines with `cache_control: { type: "ephemeral" }`.                     |
| `src/lib/ai/aiClient.ts`                                   | `streamChat()` async generator + `chat()` convenience drainer. Reads `VITE_AI_API_URL` — falls back to stub.       |
| `src/lib/ai/aiStubBackend.ts`                              | Claude-shape SSE event generator. Same protocol as the real backend; regex-driven planner.                        |
| `infra/ai-chat-lambda.ts`                                  | AWS Lambda template (Node 20, Function URL with response streaming). Forwards the same envelope to Anthropic.     |

To flip from stub → real Claude: deploy the Lambda
(steps in the file header), set `ANTHROPIC_API_KEY` on the function, set
`VITE_AI_API_URL=<lambda-url>` in `.env.local`, restart the dev server.
Same protocol, same types, same UX — only the brain changes.
