# Decision Diamond — Entity Expansion Spec

**Audience.** Engineering — front-end and back-end.
**Companion to.** `DECISION-DIAMOND-LOGIC.md` (broader UX reference). This
doc is the actionable spec for the entity-expansion change only.
**Status.** Draft for review.
**Last updated.** 2026-06-12.

---

## 1. Context

### 1.1 Today (production)

A Decision Diamond (DD) evaluates rules **only against contact
attributes**, regardless of which trigger feeds it. Examples of the
contact attributes available today: Tag, First name, Last name, Email,
Phone, custom fields, etc.

This works for triggers that fire on contact-shaped events, but it is
limiting when the trigger carries a richer entity (Appointment, Quote,
Pipeline movement, Product purchase). Today the user can't route a
deal based on the **stage that was just entered**, or a quote based on
its **status**, etc. — they have to fall back to contact tags as a
proxy.

### 1.2 What changes

A DD's available rule fields become a function of **(a) Contact +
(b) the entity carried by the upstream trigger**. The DD inspects its
incoming edge to discover which trigger sits upstream; that trigger
contributes its own attribute set in addition to Contact.

Concretely: dropping a DD downstream of `Appointment` lets the user
build rules on either **Contact** *or* **Appointment** attributes —
no other entities are offered.

### 1.3 In-scope triggers

This spec covers the four CRM triggers below. Any other trigger
continues to behave as it does today (Contact only).

| Slug                         | Entity        | Trigger title (UI)      |
| ---------------------------- | ------------- | ----------------------- |
| `appointments`               | Appointment   | Appointments            |
| `pipeline-stage-is-moved`    | Pipeline move | Pipeline stage is moved |
| `quote-status`               | Quote         | Quote status            |
| `product-is-purchased`       | Product       | Product is purchased    |

---

## 2. Core rule (one sentence)

> **A Decision Diamond surfaces, as its first input dropdown, the
> union of `Contact` plus the entity attached to the closest upstream
> trigger. Picking one entity narrows the second input dropdown to
> that entity's attributes.**

If the closest upstream node is not one of the four triggers in §1.3,
the DD falls back to Contact-only (current production behavior).

---

## 3. UI contract

### 3.1 Condition row layout

Each condition row in a DD rule set has **three input fields**:

```
[ Entity / Field ]   [ Operator ]   [ Value ]
```

- **Field 1 — Entity / Field selector.** Single dropdown. The label is
  "If the". Its options are grouped by entity:
  - Group A: the upstream entity's attributes (only for `appointments`,
    `pipeline-stage-is-moved`, `quote-status`, `product-is-purchased`).
  - Group B: Contact attributes (always present).

- **Field 2 — Operator.** Single dropdown. Options depend on the
  `inputType` of the field picked in Field 1 (see §6).

- **Field 3 — Value.** A typed input that depends on (Field, Operator)
  (see §6).

### 3.2 Dropdown grouping

The first dropdown is a **single grouped list**, not two separate
dropdowns. Visual sketch:

```
┌────────────────────────────────┐
│  APPOINTMENT                   │   ← group heading (uppercase, muted)
│    Appointment event           │
│    Appointment type            │
│                                │
│  CONTACT                       │
│    Tags                        │
│    First name                  │
│    Email                       │
│    ...                         │
└────────────────────────────────┘
```

### 3.3 Behavior when the upstream trigger changes

If the user re-wires the canvas so a different upstream trigger feeds
the DD:

- Previously-configured conditions that reference fields belonging to
  the now-absent entity become **invalid** — show them in an error
  state (red border + inline message "This field no longer applies to
  this trigger"). The user must remove or change them before Save is
  allowed.
- Contact-based conditions remain valid (Contact is always available).
- This is a save-time validation; it does not block editing.

### 3.4 No upstream trigger

If the DD is **not** downstream of any of the four supported triggers
(or has no upstream trigger at all), only the Contact group appears.
This matches today's production behavior — backwards compatible.

---

## 4. Per-trigger attribute matrix

The numbers in parentheses next to each field name are the **stable
field IDs** the front-end and back-end must agree on for persistence
and rule evaluation. These are not user-facing.

### 4.1 Appointments — `appointments`

| Field ID                | Label              | Input type | Required when                                            | Enum values                                                                                                              |
| ----------------------- | ------------------ | ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `appointment.event`     | Appointment event  | enum       | always                                                   | `Schedules`, `Reschedules`, `Cancels`                                                                                    |
| `appointment.type`      | Appointment type   | enum       | always (dynamic — pulled from tenant's appointment-types | Live list from the appointment-types API. No hardcoded values.                                                           |

Field-order rule: there is **no dependency** between `appointment.event`
and `appointment.type`. Either can be used standalone or in an AND
block.

### 4.2 Pipeline stage is moved — `pipeline-stage-is-moved`

| Field ID              | Label     | Input type | Required when                       | Enum values                                                                                |
| --------------------- | --------- | ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `pipeline.direction`  | Direction | enum       | always                              | `Into`, `Out of`                                                                           |
| `pipeline.pipeline`   | Pipeline  | enum       | always (dynamic — from pipelines API| Live list from the pipelines API.                                                          |
| `pipeline.stage`      | Stage     | enum       | always (dependent on `pipeline.pipeline`) | The stage list scoped to the selected pipeline. Empty until `pipeline.pipeline` is set. |

Field-order rule: `pipeline.stage` is **dependent** on
`pipeline.pipeline`. The Stage dropdown MUST be disabled (placeholder
text "Select a pipeline first") until Pipeline is set, and MUST be
cleared whenever Pipeline changes.

### 4.3 Quote status — `quote-status`

| Field ID       | Label        | Input type | Required when | Enum values                            |
| -------------- | ------------ | ---------- | ------------- | -------------------------------------- |
| `quote.status` | Quote status | enum       | always        | `Sent`, `Viewed`, `Accepted`           |

This trigger exposes a single attribute. The first dropdown still
groups Contact below it; the upstream group just has one entry.

### 4.4 Product is purchased — `product-is-purchased`

| Field ID                | Label          | Input type | Required when                                                                                          | Enum values                                                                                                                                  |
| ----------------------- | -------------- | ---------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `product.purchaseType`  | Purchase type  | enum       | always                                                                                                 | `Product`, `Any purchase`                                                                                                                    |
| `product.products`      | Products       | enum       | **only when** `product.purchaseType == Product` (per `conditionalOn`)                                  | Live list from the products API.                                                                                                             |
| `product.paymentType`   | Payment type   | enum       | always                                                                                                 | `Credit Card (charge now)`, `Credit Card (Manual)`, `Check`, `Cash`, `Money Order`, `Adjustment`, `Include $0 invoices`, `Any payment type`  |

Field-order rule: `product.products` is **conditional** on
`product.purchaseType == 'Product'`. If `Any purchase` is selected, the
Products field MUST be hidden from the first dropdown's option list.

### 4.5 Contact (shared across all triggers)

Contact attributes are **always** offered as a second group regardless
of upstream trigger. They are unchanged from today's production. They
include but aren't limited to:

| Field ID                | Label                | Input type | Enum / format                                  |
| ----------------------- | -------------------- | ---------- | ---------------------------------------------- |
| `contact.tags`          | Tags                 | enum-multi | Live list from the tags API                    |
| `contact.firstName`     | First name           | text       | —                                              |
| `contact.lastName`      | Last name            | text       | —                                              |
| `contact.email`         | Email                | text       | —                                              |
| `contact.phone`         | Phone                | text       | —                                              |
| `contact.customField.*` | Tenant custom fields | varies     | Defined per tenant; passthrough from CRM API.  |

**Backwards compatibility:** existing production conditions that store
contact attributes without the `contact.` prefix MUST continue to be
read correctly. New conditions MUST be written with the prefix.

---

## 5. Operator matrix

Operator options are driven by the field's `inputType`. Same rules
apply for every entity.

| Field inputType | Operators surfaced                                                                                            | Value control                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `enum`          | `equals`, `does not equal`, `is empty`, `is not empty`                                                        | Dropdown of the field's enum                   |
| `enum-multi`    | `contains any`, `contains all`, `contains none`, `is empty`, `is not empty`                                   | Multi-select chips                             |
| `text`          | `equals`, `does not equal`, `contains`, `does not contain`, `begins with`, `ends with`, `is empty`, `is not empty` | Free-text input                            |
| `number`        | `equals`, `does not equal`, `exceeds`, `less than`, `between`, `is empty`, `is not empty`                     | Number input (range = two inputs for `between`) |
| `date`          | `before`, `after`, `between`, `is empty`, `is not empty`                                                      | Date picker (range = two pickers for `between`) |
| `boolean`       | `is true`, `is false`                                                                                         | None                                           |

---

## 6. Data model

### 6.1 Condition shape (persisted)

```json
{
  "id": "c_abc123",
  "field": "appointment.event",
  "operator": "equals",
  "values": ["Schedules"]
}
```

- `field` — stable field ID from §4.
- `operator` — string token from §5.
- `values` — array of strings. Even single-value operators (`equals`)
  use an array of length 1. `between` uses length 2. `is empty` /
  `is not empty` use length 0.

### 6.2 Rule set / sequence shape

A DD has N **sequences**. Each sequence has one or more **blocks**;
within a block, conditions are AND-joined; between blocks, OR-joined.
**First-match-wins** routing: the first sequence whose rules match
sends the record down that branch; non-matchers fall through to
**default routing**.

```json
{
  "diamondId": "d_xyz",
  "boundEntity": "appointment",
  "groups": [
    {
      "id": "g_seq1",
      "targetFlowId": "n_then1",
      "targetName": "Confirmation cadence",
      "blocks": [
        {
          "id": "b_1",
          "conditions": [
            { "field": "appointment.event", "operator": "equals", "values": ["Schedules"] },
            { "field": "appointment.type",  "operator": "equals", "values": ["15-Minute Initial Consultation"] }
          ]
        }
      ]
    }
  ],
  "defaultRouting": "__drop__"
}
```

- `boundEntity` is the closest upstream trigger's entity slug. The
  back-end uses this to validate that `field` IDs in `conditions` are
  legal for this DD (Contact + the bound entity, and only those).
- `defaultRouting` is either `__drop__` (drop the record) or a target
  flow ID.

### 6.3 Stable field IDs (alphabetical)

```
appointment.event
appointment.type
contact.customField.<id>
contact.email
contact.firstName
contact.lastName
contact.phone
contact.tags
pipeline.direction
pipeline.pipeline
pipeline.stage
product.paymentType
product.products
product.purchaseType
quote.status
```

These IDs MUST remain stable across versions — they are persisted in
saved automations.

---

## 7. Editor state machine

State per condition row, driven by which fields are set:

```
   ┌──────────────┐ user picks field    ┌──────────────────┐
   │  EMPTY       ├────────────────────►│  FIELD_PICKED    │
   └──────────────┘                     └──────────────────┘
                                                │ user picks operator
                                                ▼
                                        ┌──────────────────┐
                                        │  OPERATOR_PICKED │
                                        └──────────────────┘
                                                │ user picks value
                                                ▼
                                        ┌──────────────────┐
                                        │  COMPLETE        │
                                        └──────────────────┘
                                                │
                                                ▼
                                        Eligible to evaluate /
                                        contributes to "is configured"
```

A condition is **complete** when `field`, `operator`, and `values`
are all set. Incomplete conditions are visually flagged but do not
block save — only "no complete condition in any sequence" blocks save.

### 7.1 Field-change side effects

When the user changes `field` on an existing row:

1. If the new field's `inputType` differs from the old one, **reset
   operator and values** to empty.
2. If the new field's `inputType` matches and the previous operator is
   still in the new field's operator list, **keep the operator**.
3. Always clear `values` when `field` changes — values are field-typed.

### 7.2 Operator-change side effects

- Switching `is empty` / `is not empty` ↔ value operators MUST reset
  `values` (length 0 ↔ length 1+).
- Switching `between` ↔ single-value operators MUST reset `values`
  (length 2 ↔ length 1).

### 7.3 Pipeline dependency

When `field` is `pipeline.stage`, the value dropdown's enum is
sourced from the stages of whichever pipeline is selected in the
same sequence's `pipeline.pipeline` condition (if any). If no
`pipeline.pipeline` condition exists in the same sequence, the
`pipeline.stage` field MUST be disabled with placeholder "Pick a
Pipeline first" (or surfaced as an invalid-config inline error).

### 7.4 Product dependency

When the user picks `product.products` in the first dropdown, the
editor MUST ensure that the same sequence also has a
`product.purchaseType == Product` condition (insert it automatically
or block with an inline message). The DD must not save a sequence
that has `product.products` without the qualifying purchaseType.

---

## 8. API contract

### 8.1 Read — list available fields for a DD

```
GET /api/automations/{automationId}/diamonds/{diamondId}/fields
```

Returns the fields the editor should surface in the first dropdown,
already grouped:

```json
{
  "boundEntity": "appointment",
  "groups": [
    {
      "label": "Appointment",
      "fields": [
        { "id": "appointment.event", "label": "Appointment event", "inputType": "enum",
          "enumOptions": ["Schedules", "Reschedules", "Cancels"] },
        { "id": "appointment.type",  "label": "Appointment type",  "inputType": "enum",
          "enumOptions": ["..."]  /* loaded from appointment-types API */ }
      ]
    },
    {
      "label": "Contact",
      "fields": [ /* contact attributes, including tenant custom fields */ ]
    }
  ]
}
```

The back-end MUST compute `boundEntity` by walking the closest
upstream trigger of `diamondId`. If no supported trigger is upstream,
return only the Contact group.

### 8.2 Write — save a DD config

```
PUT /api/automations/{automationId}/diamonds/{diamondId}
Body: { boundEntity, groups, defaultRouting }
```

Validation the back-end MUST enforce:

1. Every `field` in `conditions` either starts with `contact.` OR
   matches the bound entity's prefix (`appointment.`, `pipeline.`,
   `quote.`, `product.`). 400 with `{error: "invalid-field-for-entity"}`
   if violated.
2. `product.products` may only appear in a sequence that ALSO has
   `product.purchaseType == Product`. 400 with
   `{error: "missing-product-purchaseType-qualifier"}` otherwise.
3. `pipeline.stage` may only appear with a matching
   `pipeline.pipeline` in the same sequence. 400 with
   `{error: "missing-pipeline-qualifier"}` otherwise.
4. `defaultRouting` must be `__drop__` or a node id that exists in the
   automation.

### 8.3 Runtime evaluation

When a trigger fires and a record enters the DD, the back-end:

1. Loads the DD config.
2. For each sequence in order, evaluates blocks (OR of ANDs). Returns
   the first matching sequence's `targetFlowId`.
3. If none match, returns `defaultRouting`.
4. Records that fail to match any sequence AND have
   `defaultRouting == '__drop__'` are not advanced further.

---

## 9. Acceptance criteria

A change is shippable when ALL of the following hold:

### 9.1 Behaviour

- [ ] Dropping a DD downstream of `appointments` makes Appointment
      attributes appear in the first dropdown's Appointment group, with
      Contact also present. No other entity groups appear.
- [ ] Same for `pipeline-stage-is-moved` → Pipeline group + Contact.
- [ ] Same for `quote-status` → Quote group + Contact.
- [ ] Same for `product-is-purchased` → Product group + Contact.
- [ ] DD downstream of any other trigger shows Contact only.
- [ ] Changing the upstream trigger after rules are configured marks
      now-invalid conditions in an error state and blocks Save until
      they're removed or changed.
- [ ] `pipeline.stage` MUST be disabled until `pipeline.pipeline` is
      set; changing the pipeline clears the previously-selected stage.
- [ ] `product.products` is only offered when `product.purchaseType ==
      Product`.

### 9.2 Data

- [ ] Saved configs persist `boundEntity` and the stable field IDs
      listed in §6.3.
- [ ] Reading a saved config back populates the editor correctly,
      including dependent fields.
- [ ] Existing production automations (Contact-only) keep working —
      no migration required for `boundEntity` (server treats missing
      as "no entity bound, contact only").

### 9.3 Validation

- [ ] Server rejects saves that mix entity fields with the wrong
      `boundEntity` (error codes per §8.2).
- [ ] Server rejects saves missing the Product purchaseType qualifier
      when `product.products` is used.
- [ ] Server rejects saves missing the Pipeline qualifier when
      `pipeline.stage` is used.

### 9.4 AI assistant (front-end only — out of scope for the back-end
ticket)

- [ ] Smart-pill suggestions for AND/OR additions in a DD scoped to
      one of the four triggers come from that trigger's attribute set,
      not Deal fields. (Already shipped in the POC prototype — code
      reference: `pickSmartConditionPills`, `recipesForSequence` in
      `DecisionDiamondEditor.vue`.)

---

## 10. Migration / rollout

### 10.1 Compatibility plan

1. **Phase 0 — Read path tolerant.** Server gains the ability to read
   and return `boundEntity`. Old records without it default to
   `null` (= Contact only).
2. **Phase 1 — Write path.** Editor starts writing `boundEntity` on
   new / re-saved DDs. Old DDs keep working unchanged.
3. **Phase 2 — Validation.** Server starts enforcing §8.2 validation
   rules. This is the only change that can break a save that
   previously succeeded; ship after Phase 1 has been live for at
   least one release cycle.
4. **Phase 3 — Editor UI.** Front-end ships entity-aware dropdown.
   Falls back gracefully when the API doesn't return groups.

### 10.2 Out of scope

- Cross-trigger DDs (e.g. a DD downstream of BOTH Appointment AND
  Quote). The closest upstream trigger wins; no union of entities is
  offered. If you need both, use two separate DDs.
- The "Test" modal local evaluator. The POC prototype includes one;
  production may or may not.
- AI assistant. The contracts above don't depend on AI features.

---

## 11. Prototype reference

A working reference implementation of all of §3 through §7 lives in
the `decision-diamond-poc-v1` Vue prototype. Specifically:

| Concern                         | File                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Closest-upstream-trigger walk   | `src/decisionDiamond/engine.ts` (`upstreamTriggerSlug`)                           |
| Per-trigger field schemas       | `src/decisionDiamond/triggerAttributes.ts`                                        |
| Contact attribute set           | `src/decisionDiamond/contactAttributes.ts`                                        |
| Editor UI (first-dropdown group)| `src/automations/builder/DecisionDiamondEditor.vue` (`FIELD_OR_CONTACT_OPTIONS`)  |
| Save-time validation hook       | `src/automations/builder/AutomationBuilder.vue` (`onEditorSave`)                  |
| Local-only rule evaluator       | `src/automations/builder/TestDiamondModal.vue`                                    |

Open the live prototype:
https://beaver1109.github.io/decision-diamond-poc-v1/

---

## 12. Questions for review

1. Should `boundEntity` be computed server-side on read, or persisted
   on write? Persisting is simpler for the editor but requires
   re-computing whenever the canvas is rewired.
2. Should `product.products` auto-insert the `product.purchaseType ==
   Product` qualifier, or block save with an inline error? The POC
   prototype currently does neither; the spec proposes inline error.
3. For tenants with very large pipelines / product catalogues, do we
   need server-side search inside the value dropdowns? The POC
   surfaces a flat list.
4. Are there any production triggers beyond the four listed that
   should expose their own entity? If yes, this spec is extensible —
   add a row to §4 and a field schema.
