# DD v1 — Decision Diamond Improvement Handoff

This is the spec + implementation handoff for "Fork 1 / DD v1" of the Keap automation builder prototype. The reference React implementation lives at `/Users/chenc02/keap-prototype-x/`; this doc captures the design decisions, data models, flows, and behaviors so a fresh session can rebuild it in Vue + `@thryvlabs/dex-vue` inside `my-dex-prototype/`.

---

## 1. Mission

Make Decision Diamonds usable for **template authors** building "set it and forget it" automation campaigns for **field-service / trade verticals + healthcare**, by binding the diamond to a real business entity (Deal / Appointment / Job / Invoice / Company / Contact) instead of the legacy contact-only predicate engine.

The audience for the work is template authors. SBOs never open a DD; they pick a template the author shipped. So the diamond's UI must be authorable in a few clicks against a real entity schema.

---

## 2. Vertical scope (validated list)

11 of 12 are field-service / trades; healthcare is the outlier (HIPAA, different tech maturity).

| # | Vertical | Notes |
|---|---|---|
| 1 | Home Services / HVAC | Core segment |
| 2 | Roofers | |
| 3 | Plumbers | |
| 4 | Cleaners | |
| 5 | Healthcare (Dental, Physicians, Surgeons) | HIPAA |
| 6 | Pest Control | |
| 7 | Auto Repair | |
| 8 | Veterinary | |
| 9 | Septic Tank & Systems | |
| 10 | Tree & Shrub Services | |
| 11 | Asphalt & Paving | |
| 12 | Moving & Storage | |

**Not in scope:** salons, real-estate agents, coaches, consultants, e-commerce.

The pattern across this list: **appointment-driven, repeat-service cadence, quote → schedule → service → invoice → review → re-engage**. The diamond has to branch on those moments.

---

## 3. The premise: Object Model Expansion is the substrate

Local service businesses think in **deals, jobs, appointments, invoices** — not contacts and tags. Today's engine is contact-centric. Without OME, every diamond improvement is cosmetic.

Layered like this:

```
L0  Object Model Expansion (engine-wide)
     Deals / Companies / Jobs / Appointments / Invoices as first-class.
     Triggers, conditions, actions all read/write them.

L1a When triggers on entity events  L1b Then actions on entities
     (deal stage changed,                (create invoice,
     invoice paid, appt status…)         update deal stage…)

L2  Entity-aware Decision Diamonds
     Diamond declares boundEntity; rule cards scope to that entity's schema.

L3  Vertical Recipes (flow fragments)
     Declarative templates spanning When + Then + If, not just DD.

L4  Diamond subtypes / canvas legibility (Consent Gate, Cadence Split)
```

DD v1 ships **L2 in full** plus enough L0 to demo the engine shift. L1, L3, L4 are scoped behind it.

---

## 4. The 6 vertical-job use cases v1 must support

These are the test for whether the rule input flow is "complete":

| Vertical job | Requires | Engine pieces |
|---|---|---|
| Lead follow-up based on deal value | Diamond evaluates deal amount + stage | Deal.amount (currency), Deal.stage |
| Post-job review request | Trigger on invoice/deal completion | Invoice.paid OR Deal.won OR Job.completed |
| No-show handling | Trigger on appointment status + deal context | Appointment.status, Appointment→Deal.stage (cross-entity) |
| Estimate expiration follow-up | Diamond evaluates estimate age + status | Deal.stage, Deal.daysInStage |
| High-value deal routing | Diamond evaluates deal value → route to sequence | Deal.amount + multi-branch outgoing |
| Repeat business campaigns | Diamond evaluates order/transaction history | Contact.totalOrders, Contact.lifetimeValue, Contact.daysSinceLastOrder |

Anything not buildable end-to-end against these isn't done.

---

## 5. The flow

### "+ " picker
- Click any node's hover-`+` → picker pops up
- **Featured Decision-diamond card** at the top (purple-tinted, white diamond icon, one-line description: "Branch the flow on a deal, appointment, invoice, job, or contact.")
- Below: legacy When/Then standard list (contact-centric items from `automationIcons.json`)
- **Entity events/actions are NOT in the picker.** All entity hierarchy lives inside the diamond modal.
- Picking the diamond inserts a `decision`-type node and immediately opens the config modal.

### DD config modal — top to bottom

1. **Header.** Close `×` + title "Decision diamond" + kebab "More options" (uses the same `HeaderIconButton` as the page header — gray-1600).

2. **Branch by — entity hierarchy.** Always-visible grid of entity tiles. Each tile: glyph badge + entity label + field count.
   - **Hard-filtered (Level D)**: only entities that appear in the diamond's **connected workflow path** are shown. BFS in both directions from the diamond, decode each connected node's slug via `SLUG_TO_ENTITIES`, union the entity ids. Disconnected workflows on the same canvas don't bleed in.
   - Selected tile: 2px accent border, accent-tinted background, filled glyph badge, accent label, top-right checkmark.
   - Unselected tiles still clickable; hover previews accent border.
   - "Clear selection" link in the panel header when bound.
   - Empty state (no relevant entities): amber card asking the user to connect an upstream entity-aware node, with a **"Show all entities"** escape hatch (reveals the full grid for the session). When override is active, "Show only relevant" link appears.

3. **Rules-for cards.** One card per outgoing edge from the diamond (1:1 invariant — the auto-insert/dissolve passes maintain this; user-inserted diamonds with 0 outgoing are kept until the user wires branches).
   - Card header: "Rules for: …What rules must a contact meet to be allowed into the '`<targetSequenceName>`' sequence?" with a kebab dropdown ("Import rules from…", "Delete all rules"). Duplicate + Delete-rules icons appear when the card has at least one rule.
   - Empty card body: blue "+ Add a rule" CTA + an info banner ("If no rules are added here any contact will be allowed to run throughout this sequence.").
   - Once "Add a rule" is clicked, a block of conditions appears (AND-joined within block; OR-separator chip between blocks). "+ Add a rule" creates a new OR-joined block.

4. **Default routing footer.** "If contacts don't meet any of the rules defined above, where do you want them to go?" + a select.

### Rule row layout

`If the [<entity>'s|the] [Field ▾] [Operator ▾] [Value-input]` plus a remove `×` for non-first conditions. Progressive disclosure: each control only appears once the previous has a value. When `boundEntity` is set, Subject + Category dropdowns are hidden — the entity already implies them, and "If the deal's" / "If the appointment's" prefixes the row.

### Value-input behavior (`DDValueInput`)

The input control swaps based on `(operator, fieldType)`:

| Effective shape | Control |
|---|---|
| Unary op (`is empty`, `is tomorrow`, `is today`, `is in the past/future`) | Nothing — input is hidden |
| Number-shape op (`is at least N days ago`, `is within last N days`, `is within next N days`) | `<input type="number">` regardless of field type |
| Field has enum + value-as-field op | DEX select with the field's enum |
| Field type `currency` | `$`-prefixed numeric input (decimal, step 0.01) |
| Field type `number` | numeric input |
| Field type `date` | `<input type="date">` |
| Field type `datetime` | `<input type="datetime-local">` |
| Field type `boolean` | true/false select |
| Field type `text` or unresolved | text input |

Multi-value (`+ or`): existing values render as removable chips, the next-value control is the same type-aware input with `+ or` placeholder. Commit on Enter or blur. No `window.prompt`.

---

## 6. Data models

### Entity registry — `src/entities/registry.ts`

```ts
type FieldType = 'text' | 'number' | 'currency' | 'enum' | 'date' | 'datetime' | 'boolean' | 'reference'

type EntityField = {
  id: string
  label: string
  type: FieldType
  enum?: string[]
  references?: EntityId  // for type='reference'
}

type EntityEvent = {
  id: string                     // event slug (unique per entity)
  label: string                  // "Estimate sent, no response in N days"
  description: string            // one-line picker description
  verticals?: VerticalSlug[]     // optional vertical hints for recipes
}

type EntityAction = {
  id: string
  label: string
  description: string
  verticals?: VerticalSlug[]
}

type EntityId = 'contact' | 'company' | 'deal' | 'job' | 'appointment' | 'invoice'

type EntityDef = {
  id: EntityId
  label: string         // singular: "Deal"
  pluralLabel: string   // "Deals"
  glyph: string         // single-letter badge: "D"
  accentColor: string   // hex; used for badge fill, tile border, etc.
  fields: EntityField[]
  events: EntityEvent[]
  actions: EntityAction[]
}
```

Ship with these 6 entities and these accent colors:

| id | label | glyph | accent |
|---|---|---|---|
| contact | Contact | C | `#0EA5E9` |
| company | Company | B | `#7C3AED` |
| deal | Deal | D | `#16A34A` |
| job | Job | J | `#EA580C` |
| appointment | Appointment | A | `#DB2777` |
| invoice | Invoice | I | `#CA8A04` |

`ENTITY_ORDER` for tiles: deal, appointment, job, invoice, company, contact.

#### Field schemas (the v1 set)

```
Contact:
  firstName text · lastName text · email text · marketingConsent boolean
  lifecycleStage enum [Lead, Customer, Lost]
  totalOrders number · lifetimeValue currency · lastOrderDate date · daysSinceLastOrder number

Company:
  name text · industry text · lostDealsLast6mo number · totalRevenue currency

Deal:
  stage enum [New, Qualified, Estimate Sent, Estimate Signed, Scheduled, Won, Lost]
  amount currency · pipeline text · owner text
  responseStatus enum [No response, Replied, Booked]
  daysInStage number · stageEnteredAt date
  company reference→company

Job:
  status enum [Scheduled, In progress, Completed, Cancelled]
  serviceTier enum [Maintenance, Repair, Install]
  tech text · completedAt datetime
  deal reference→deal

Appointment:
  status enum [Scheduled, Completed, No-show, Cancelled, Rescheduled]
  type enum [Maintenance Tune-Up, Repair, Install, Estimate, Consultation]
  date date · tech text · duration number
  deal reference→deal · job reference→job

Invoice:
  status enum [Draft, Sent, Paid, Partial, Past due, Void]
  total currency · balance currency · dueDate date
  job reference→job
```

#### Events / actions (for L1 reference; not surfaced in v1 picker)

Listed in registry but the v1 prototype keeps them out of the `+` picker. Bring back when L1 (Whens/Thens on entity events) ships.

### Decision Diamond config — `src/decisionDiamond/types.ts`

```ts
type DDCondition = {
  id: string
  subject: string    // legacy: "Contact's"
  category: string   // legacy: "Contact Fields" / etc.
  field: string      // when bound to entity, this is the resolved field key
                     //   ("Stage", "Amount", "Deal: Stage" for one-hop refs)
  operator: string   // OPERATOR_OPTIONS label
  values: string[]   // committed values (chips); single-value ops use [0]
}
type DDBlock = { id: string; conditions: DDCondition[] }  // AND-joined
type DDGroup = {
  id: string
  targetFlowId: string   // outgoing-edge target id
  targetName: string     // outgoing target node title
  blocks: DDBlock[]      // OR-joined
}
type DecisionDiamondConfig = {
  groups: DDGroup[]
  defaultRouting: string         // either flowId or "__drop__"
  boundEntity?: EntityId
}
```

### Operator catalog — `src/decisionDiamond/dropdowns.ts`

```
equals · does not equal · is empty · is not empty
is greater than · is at least · is less than · is at most
is today · is tomorrow · is in the past · is in the future
is at least N days ago · is within last N days · is within next N days
```

`UNARY_OPERATORS` set (no value input): `isEmpty`, `isNotEmpty`, `isToday`, `isTomorrow`, `isInThePast`, `isInTheFuture`.

`OPERATOR_VALUE_SHAPE` mapping (value-input shape selector for `DDValueInput`):
- `unary` → no input
- `number` → numeric input regardless of field type (used by all `daysAgo*` / `daysFromNow*`)
- `asField` → input matches field type (default for equals/notEquals/comparisons)

---

## 7. Engine plumbing rules

### Diamond auto-insert / dissolve (already-built effect in canvas)

- **Auto-insert** when any source has 2+ outgoing edges and no diamond on at least one of them: insert a diamond between source and direct targets (route-through), or create a new diamond fronting the targets.
- **Dissolve** only diamonds with **exactly 1** outgoing edge (the collapsed-back-to-single case). Diamonds with **0** outgoing edges are kept (they're freshly user-inserted via the picker — waiting for the user to wire branches).
- **Groups stay 1:1 with outgoing edges.** Delete-icon on a Rules-for card clears the group's blocks instead of removing the card. "Delete all rules" in the kebab does the same. Duplicate is hidden — duplicating would break the 1:1 invariant.

### Slug → entity map (Level D filter helper)

Each canvas node's `name` is the legacy `automationIcons.json` slug (or, in future, `entity:<entityId>.<eventOrActionId>`). Map slugs to the entities they imply:

```
appointments        → appointment
pipeline-stage-is-moved → deal
quote-status        → deal
product-is-purchased → invoice
failed-purchase     → invoice, contact
create-an-invoice   → invoice
create-a-deal       → deal
appointment-timer   → appointment
assign-an-owner     → contact, deal
add-or-remove-from-sequence / apply-a-note / apply-or-remove-tag /
form-is-submitted / landing-page-is-submitted / lead-score-is-achieved /
tag-is-applied / task-is-completed / wordpress-opt-in /
email-link-is-clicked / get-email-opt-in / send-email / send-text-message /
set-field-value / field-timer / create-a-task → contact

(api, date-timer, delay-timer, send-an-http-request, empty-action-sequence: no entity)
```

When a node's slug starts with `entity:`, decode entity from the prefix.

### Connected-component walker

When opening the diamond modal, BFS from the diamond following both incoming and outgoing edges, collect every reachable node's entity set, union them, plus the diamond's currently-bound entity. That set is the relevance filter passed to the editor.

---

## 8. Visual / token notes (for the Vue + DEX rebuild)

In the Keap React prototype these are inline styles and hex codes. In the DEX-Vue rebuild, prefer DEX tokens.

| What | Current (React) | DEX equivalent |
|---|---|---|
| Kebab icon color | `var(--dex-color-gray-1600, #272727)` | `--dex-color-gray-1600` ✓ already DEX |
| Primary CTA blue | `#006ceb` | `--dex-color-blue-700` (Keap brand primary) |
| Selection accent purple (DD line) | `#8358F1` | check DEX purple scale |
| Connector default gray | `#CCCCCC` | `--dex-color-gray-400` |
| Card border / surface | `#E5E7EB` / `#fff` | `--dex-color-gray-200` / surface token |
| Empty-state amber banner | bg `#FFFBEB`, border `#FCD34D`, text `#78350F` | DEX warning palette |
| Empty-state dashed rule card | border `#D1D5DB` | `--dex-color-gray-300` |
| Featured "Decision diamond" card | bg `#F4F1FF`, border `#E0D7FA` | DEX violet/purple-50 + 100 |
| Rule-card surface | `#fff` on `#F9FAFB` modal body | DEX surface + subtle |

For DEX components, use these in place of hand-rolled equivalents:

- `DexButton` / `DexIconButton` for all buttons
- `DexInput` (or `DexTextField`) for the text/number/currency value inputs
- `DexSelect` for enum / category / subject / operator / field dropdowns
- `DexDatePicker` if available, else native `<input type="date">`
- `DexChip` for the value chips
- `DexModal` / dialog primitive for the diamond editor shell
- `DexBanner` / alert for the amber empty-state and info banners

Use `search_design_system` (Figma MCP) and the dex-mcp's `list_components` / `get_component` (when running from `my-dex-prototype/`) to confirm exact component names and prop contracts before wiring.

---

## 9. Implementation ordering for the Vue rebuild

1. **Skeleton & routing.** Match the Keap automation builder shell (canvas + node cards + hover-`+`). Most of this already exists in `my-dex-prototype/src/automations/` — extend it.
2. **Type-only port.** Drop the data models from §6 into `src/decisionDiamond/types.ts` and `src/entities/registry.ts`. Keep them framework-agnostic.
3. **Operator catalog + value shape map.** Port `dropdowns.ts` verbatim.
4. **`+` picker.** Standard list (legacy slugs from `automationIcons.json` if you carry it over) + featured Decision-diamond card. Picking the diamond → insert decision node → open modal.
5. **DD modal shell.** Header + close + kebab. Default routing footer.
6. **Branch-by entity panel.** Always-visible tile grid, hard-filtered to relevant entities, selected state, empty state with escape hatch.
7. **Rules-for card.** Header (kebab dropdown), empty state CTA, blocks (AND/OR semantics), inline rule rows.
8. **Rule row.** Progressive disclosure of Subject / Category / Field / Operator / `DDValueInput`. Cross-entity field expansion (one hop).
9. **`DDValueInput` Vue port.** Type/operator-aware control swap. Multi-value chips with inline next-value input.
10. **Auto-insert / dissolve effect.** Maintain 1:1 group↔edge invariant.
11. **Connected-component walker** for Level D filtering.

---

## 10. Reference files in `keap-prototype-x` (read these for behavior parity)

All in `/Users/chenc02/keap-prototype-x/`:

- `src/pages/AutomationBuilder.tsx` — single-file React implementation. Heavy but linear. Search for:
  - `function InlineAddPicker` — the `+` picker incl. featured DD card
  - `function DDValueInput` — type-aware input component
  - `function DecisionDiamondEditor` — the modal
  - `SLUG_TO_ENTITIES` — the slug→entity decoder
  - `entitiesForNodeName` — slug parser
  - `insertDecisionDiamondAfter` — picker → diamond → open-modal flow
  - "Pass 3: dissolve diamonds" — the auto-collapse rule
  - "Auto-insert decision diamond" effect — the 2+-outgoing rule
- `src/entities/registry.ts` — the exported entity registry (port verbatim, then drop React-specific imports if any).
- `src/decisionDiamond/dropdowns.ts` — operator catalog, country list, value option lookups.
- `src/data/automationIcons.json` — legacy when/then catalog.

The React prototype runs at `http://localhost:3000/my-automations/list/advanced` (`npm start` from `keap-prototype-x/`) for click-through verification.

---

## 11. What's intentionally NOT in v1

- **Entity events / actions in the `+` picker.** Removed by design (per design call). Re-introduce when L1 ships.
- **Recipes (Direction B / L3).** Vertical-shaped "Branching recipes" are the next layer; v1 has zero. Empty state for a fresh diamond is "Pick an entity" not "Pick a recipe."
- **Subtypes (Direction C / L4).** No Consent Gate, no Cadence Split, no diamond shape variants.
- **Engine evaluation.** All config is local state — no runtime, no XML serialization, no validation.
- **Cross-entity > one-hop.** Field resolver expands one reference hop only (Appointment → Deal.Stage). Two-hop chains are deliberately omitted to keep the field picker readable.
- **Multi-block `+ or` between groups across canvas branches.** Out of scope.
- **Save / Cancel / autosave.** Modal is "save on change."

---

## 12. Open questions for the rebuild session

1. Do recipes (L3) ship in v1.5 or held until L1 lands? Recommendation: hold until L1, so recipes can be real flow-fragments rather than DD-only seeds.
2. Where should the "Branch by" panel live visually if the modal becomes a side-rail (DEX pattern) rather than centered? Likely top-of-rail with sticky header; rules-for cards scroll below.
3. Date-relative ops with N value: do we want a combined "{N} days ago" input that reads "3 days ago" inline, or keep operator + numeric input as two controls? v1 keeps two; explore the inline form.
4. Should the diamond Type column from the cases above ("Repeat business") use Contact or Company as `boundEntity` by default? Contact in v1; revisit when company-level segmentation is more deliberate.

---

## 13. Quick-reference: how each use case is built end-to-end

| # | Use case | Branch by | Conditions (AND-joined unless noted) | Outgoing branches → Then |
|---|---|---|---|---|
| 1 | Lead follow-up by deal value | Deal | Amount `is greater than` `$X` · Stage `equals` Qualified/New | Send email / SMS / Start sequence |
| 2 | Post-job review request | (no diamond — straight chain) | — | When Job completed → Then Create invoice → Then Start sequence |
| 3 | No-show handling | Appointment | Status `equals` No-show · Deal: Stage `equals` Scheduled | Send SMS / Notify owner |
| 4 | Estimate expiration follow-up | Deal | Stage `equals` Estimate Sent · Days in Current Stage `is at least` 3 | Send follow-up SMS / Email |
| 5 | High-value deal routing | Deal | Amount `is greater than` `$X` (one card per tier) | Each tier → its own sequence |
| 6 | Repeat business | Contact | Total Orders `is at least` 2 · Days Since Last Order `is at most` 365 | Start re-engagement sequence |

If any of those can't be built end-to-end in the rebuild, the rebuild isn't done.

---

End of handoff.
