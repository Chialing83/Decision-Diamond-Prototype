# Keap Automation — Full Handoff

End-to-end spec for the **Automation tab → list view → canvas builder** surface in the Keap prototype, scoped to be sufficient to rebuild the feature byte-faithfully in another project. Complements `HANDOFF-DD-V1.md` (which goes deeper on the Decision Diamond modal alone).

Reference implementation lives at `/Users/chenc02/Claude on new mac/my-dex-prototype/keap-prototype-x/`.

---

## 0 · TL;DR file manifest — what to copy

These are the only files the Automation surface actually owns. Copy them verbatim into the new project, install the dependencies in §13, and route per §1.

| Path | Lines | Role |
|---|---:|---|
| `src/App.tsx` | 96 | Routing — relevant routes shown in §1 |
| `src/pages/Automation.tsx` | 524 | List page (Easy / Advanced tabs, table, search, mobile cards) |
| `src/pages/AutomationBuilder.tsx` | ~7,940 | Canvas builder — single-file implementation containing **everything** (palette, canvas, nodes, edges, all 4 modals, picker, action menu, DD preset registry, mock-AI seeder). The biggest file. |
| `src/data/mockData.ts` | 251 | Mock automations + types (`Automation`, `AdvancedAutomation`) |
| `src/data/automationIcons.json` | 155 | When/Then trigger + action catalog (slugs, labels, inline SVGs) |
| `src/entities/registry.ts` | 462 | Mock object-model registry: Contact / Deal / Company / Job / Appointment / Invoice with fields, events, actions, accent colors |
| `src/decisionDiamond/dropdowns.ts` | 205 | Operator catalog + country list (used by DD modal) |
| `src/styles/automation-builder.css` | 33 | A few global tweaks the canvas relies on |
| `src/components/ui/*` | — | `Tabs`, `DataTable`, `Row`, `Th`, `StatusBadge`, `KebabMenu`, `IconButton`, `Button` — the list page uses these. If your target project has equivalents, swap; otherwise copy. |

Shared layout components (`AppShell`, `Sidebar`, `PrimaryNav`) are NOT scoped to Automation — they're the app-wide chrome. Copy them if the target project doesn't already have its own shell.

---

## 1 · Routing

`src/App.tsx` (excerpt — drop in verbatim):

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Automation from './pages/Automation'
import AutomationBuilder from './pages/AutomationBuilder'

<BrowserRouter>
  <Routes>
    <Route path="/" element={<AppShell />}>
      {/* … other app routes … */}

      {/* Automation list — shows the tab/table page */}
      <Route path="my-automations">
        <Route index element={<Navigate to="/my-automations/list/easy" replace />} />
        <Route path="list/easy" element={<Automation />} />
        <Route path="list/advanced" element={<Automation />} />
      </Route>

      {/* (Optional placeholder routes for sibling pages) */}
      <Route path="automation">
        <Route path="templates" element={<Placeholder />} />
        <Route path="zapier" element={<Placeholder />} />
        <Route path="ai-assistant" element={<Placeholder />} />
        <Route path="preferences" element={<Placeholder />} />
      </Route>
    </Route>

    {/* Standalone full-page route — no AppShell/sidebar */}
    <Route
      path="/my-automations/list/advanced/:automationId"
      element={<AutomationBuilder />}
    />
  </Routes>
</BrowserRouter>
```

Two URL patterns matter:

- `/my-automations/list/easy` and `/my-automations/list/advanced` — same component, the tab state derives from the path.
- `/my-automations/list/advanced/:automationId` — full-page builder, **outside** AppShell. The `automationId` is read with `useParams()` and used only to title the page (mock data is matched against `advancedAutomations`).

---

## 2 · Data models

### 2.1 `mockData.ts`

```ts
export interface Automation {
  id: string
  name: string
  status: 'Draft' | 'Active' | 'Disabled'
  lastUpdated: string  // free-form date string
}

export interface AdvancedAutomation {
  id: string
  name: string
  category: string
  status: 'Draft' | 'Published'
  activeContacts: number
  publishDate: string  // free-form (e.g. "Not published" or "1/28/2026, 4:11 pm")
  numericId: number
}

export const advancedAutomations: AdvancedAutomation[] = [
  { id: 'adv1', name: 'DD Test',               category: 'Jialing',       status: 'Draft',     activeContacts: 0, publishDate: 'Not published',        numericId: 3000 },
  { id: 'adv2', name: 'Jialing test font',     category: 'Jialing',       status: 'Published', activeContacts: 0, publishDate: '1/28/2026, 4:11 pm',   numericId: 2888 },
  { id: 'adv3', name: 'Friday testing',        category: 'Enrique',       status: 'Published', activeContacts: 0, publishDate: '3/27/2026, 12:07 pm',  numericId: 2996 },
  { id: 'adv4', name: 'tETS 3',                category: 'Uncategorized', status: 'Draft',     activeContacts: 0, publishDate: 'Not published',        numericId: 2990 },
  { id: 'adv5', name: 'Test CUS-12997 FF OF',  category: 'Uncategorized', status: 'Draft',     activeContacts: 0, publishDate: 'Not published',        numericId: 2992 },
  { id: 'adv6', name: 'Test CUS-12997',        category: 'Uncategorized', status: 'Draft',     activeContacts: 0, publishDate: 'Not published',        numericId: 2988 },
]

export const automations: Automation[] = [
  { id: 'au1', name: 'My automation (13 April 2026)',       status: 'Draft',    lastUpdated: '4/14/2026, 4:30 pm' },
  { id: 'au2', name: 'Internal form: Untitled form 1032',   status: 'Draft',    lastUpdated: '3/24/2026, 12:15 pm' },
  // … etc, see source
]
```

### 2.2 `entities/registry.ts` (used by Decision Diamond)

Defines six entities — Contact, Company, Deal, Job, Appointment, Invoice — each with: id, label, pluralLabel, glyph (single letter for the canvas badge), accentColor, fields (typed schemas with optional enums and reference pointers), events (When triggers), actions (Then actions).

| Entity | Glyph | Accent | Key fields |
|---|---|---|---|
| Contact | C | `#0EA5E9` | firstName, lastName, email, marketingConsent, lifecycleStage, totalOrders, lifetimeValue, lastOrderDate, daysSinceLastOrder |
| Company | B | `#7C3AED` | name, industry, lostDealsLast6mo, totalRevenue |
| Deal | D | `#16A34A` | stage (enum), amount (currency), pipeline, owner, responseStatus (enum), daysInStage, stageEnteredAt, company (ref) |
| Job | J | `#EA580C` | status (enum), serviceTier (enum), tech, completedAt, deal (ref) |
| Appointment | A | `#DB2777` | status (enum), type (enum), date, tech, duration, deal (ref), job (ref) |
| Invoice | I | `#CA8A04` | status (enum), total, balance, dueDate, job (ref) |

Copy the file verbatim — the canvas and modal both consume it.

### 2.3 `decisionDiamond/dropdowns.ts`

Operator catalog:

```ts
OPERATOR_OPTIONS = [
  equals · does not equal · is empty · is not empty
  is greater than · is at least · is less than · is at most
  is today · is tomorrow · is in the past · is in the future
  is at least N days ago · is within last N days · is within next N days
]
UNARY_OPERATORS = { isEmpty, isNotEmpty, isToday, isTomorrow, isInThePast, isInTheFuture }
```

Plus a full ISO `COUNTRY_OPTIONS` list (~250 entries) used when the value picker resolves to a country field.

### 2.4 `automationIcons.json`

The legacy When/Then trigger + action catalog. 13 trigger slugs + 17 action slugs. Each entry: `{ title, slug, svg }`. Inline `<svg>` strings are 24×24 with their fill color baked in. Used by the inline `+` picker.

| When slugs | api · appointments · email-link-is-clicked · failed-purchase · form-is-submitted · landing-page-is-submitted · lead-score-is-achieved · pipeline-stage-is-moved · product-is-purchased · quote-status · tag-is-applied · task-is-completed · wordpress-opt-in |
| Then slugs | add-or-remove-from-sequence · apply-a-note · apply-or-remove-tag · appointment-timer · assign-an-owner · create-a-deal · create-a-task · create-an-invoice · date-timer · delay-timer · field-timer · get-email-opt-in · send-an-http-request · send-email · send-text-message · set-field-value · empty-action-sequence |

---

## 3 · Automation list page (`pages/Automation.tsx`)

A single page rendering both the **Easy** and **Advanced** automations as a tabbed list. Tab state derives from the URL.

### 3.1 Page anatomy

```
┌─ AppShell (sidebar + topbar) ─────────────────────────────┐
│ ┌─ <main className="max-w-1400 mx-auto px-4/6 py-3/4"> ─┐ │
│ │ <PageHeader>                                           │ │
│ │   "My automations" (h1, 32/48, normal weight)          │ │
│ │   [Create an automation ▾]  (primary button)            │ │
│ │ </PageHeader>                                          │ │
│ │ <Tabs items=[Advanced, Easy] value=tab onChange=…>     │ │
│ │ <Toolbar>                                               │ │
│ │   [🔍 Search …][🎛 Filter][Category ▾ (advanced only)]│ │
│ │ </Toolbar>                                              │ │
│ │ <DataTable>                                             │ │
│ │   <thead>  ... sortable headers ...                     │ │
│ │   <tbody>  ... AdvancedRow or EasyRow per item ...       │ │
│ │ </DataTable>                                            │ │
│ │ <MobileList> (md: hidden)                               │ │
│ └─────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 3.2 Tabs

Two tabs: `Advanced`, `Easy`. Each updates the URL (`navigate(/my-automations/list/${tab}, { replace: true })`). Tab change clears the row selection.

### 3.3 Toolbar

- **Search input** (315 px wide on sm+, full width on mobile). Filters by `name` (case-insensitive substring). Placeholder reads `Search {tab} automations`.
- **Filter icon button** (placeholder action).
- **Category dropdown** (advanced tab only).

### 3.4 Table — Advanced tab

Columns: checkbox · Advanced automation (name) · Category · Status · Active contacts · Publish date (lg+) · ID (lg+) · kebab actions.

- **Sortable**: name, category, publishDate, numericId. Header button cycles `asc → desc → none`. Default `name asc`.
- **Selection**: row checkbox toggles membership in a `Set<string>` of ids. Header checkbox toggles all visible. Tab change clears.
- **Row click** (interactive, not on checkbox/kebab): `navigate(/my-automations/list/advanced/${row.id})` — opens the full-page Builder.
- **Status pill**: `Published` → green/active style; `Draft` → gray.
- **Publish date** "Not published" renders in `text-ink-muted`; real dates in `text-ink`.
- **Kebab**: Edit · Duplicate · Publish/Unpublish · Delete (danger).

### 3.5 Table — Easy tab

Columns: checkbox · Easy automations · Status · Last updated · kebab actions.

- Sortable: name, lastUpdated.
- Status: `Active` (green) / `Draft` (gray) / `Disabled` (red-tinted).
- Kebab: Edit · Duplicate · Delete (danger).
- Rows are NOT navigable (no canvas for easy automations in this prototype).

### 3.6 Mobile (`<md`)

The `<DataTable>` is hidden and replaced by `<MobileList>` of `<MobileCard>`s — one card per row, whole-card tap target on Advanced (navigates to builder). Each card shows title, status badge, category (advanced), and a meta line (`{publishDate} · ID {numericId}` or `{lastUpdated}`).

### 3.7 Sort helper

```ts
function nextDir(dir): 'asc' → 'desc' → 'none' → 'asc'
function sortRows<T>(rows, key, dir): T[]
  // 'none' returns input
  // numeric keys: numeric compare
  // string keys: localeCompare with { numeric: true }
  // 'desc' reverses
```

---

## 4 · Automation canvas (`pages/AutomationBuilder.tsx`)

A standalone full-page route (`/my-automations/list/advanced/:automationId`). The single file contains **everything**: top bar, sidebar palette, canvas, nodes, edges, all 4 modals, picker, action menu, DD preset registry, mock AI seeder, fork reconcile logic.

The Builder's URL has **no AppShell** — it's chrome-free intentionally (the top bar is its own header).

### 4.1 Top bar (~72 px)

Left: × close button + title + sub-row (category · Draft pill). Title is the matched automation's `name`. Close navigates back to `/my-automations/list/advanced`.

Right cluster: save timestamp · "Try new automation features" toggle · Reporting button · kebab (More options) · Publish button.

Font: `Sul Sans, Helvetica, Arial, sans-serif`. Default text color: `#0F1724`. Border-bottom: 1px `#E7E7E7`. Bg: white.

### 4.2 Left sidebar palette

Two-tab catalog (When / Then). Each tab shows a vertical scrollable list of trigger/action cells, dragged onto canvas to place a node. Cells use the SVG from `automationIcons.json` (green tint for When, blue tint for Then).

Tabs above the list switch the catalog. Toggle the panel collapsed/expanded with a small chevron button.

### 4.3 Canvas

A pannable / zoomable surface that hosts node tiles + SVG edges. Default zoom 50% (`scale(0.5)`). Pan = mouse-drag on empty canvas (no wheel scroll). Zoom is controlled by the bottom toolbar.

Canvas-space coords are pre-zoom; the wrapper applies a single CSS transform.

#### 4.3.1 Node tile

```
┌─ tile ───────────────┐
│   ┌─────────┐       │
│   │  icon   │       │     icon (48×48 in canvas-space)
│   └─────────┘       │
│                     │
└─────────────────────┘
   <label below>
```

- Size: ~218×148 (canvas-space) for triggers/actions; diamonds are 168×168 rotated 45° (scale 0.707 to fit).
- Border: 1px gray.
- Shadow: subtle.
- Selection: 4 px purple ring (`#8358F1`). Black ring when targeted by drag-to-connect.
- Status badge (top-right): bullseye `setupRequired` (red), `readyToPublish` (yellow), `published` (green) — driven by `node.status`.
- **Title block** under the tile: max width 168 (display ≈ 168px @ 50% zoom), wraps to 5 lines with `-webkit-line-clamp`; decision-diamond titles render in `rgba(0,0,0,0.6)` and are **non-editable**; others render in `#000` and are click-to-edit.
- Click title (non-decision) → enters inline rename via `<textarea>` (autofocus, select-all, Enter commits, Esc cancels, ≥8px padding top/bottom). Same effect as menu → Rename.
- Hover affordance: a "+" button to the right of the tile lets the user pick the next step (only on non-latest nodes); hover shares a counter so the gap to the button doesn't drop hover.
- Drag the tile body to move; pointer-down with movement starts drag. Plain click selects (purple ring); Shift+Click adds to multi-select; second click on a single-selected node opens the action menu at the cursor.
- Double-click → opens detailed editor (DD modal for diamonds; Purchase / Appointment / Pipeline modals for their slugs; otherwise announce-only).

#### 4.3.2 Edges

Cubic-bezier paths. Same-row edges are straight; cross-row use S-curves (`+100 / -100` control x-offsets). Chevron end-cap (15×9, color `#CCCCCC` default, `#8358F1` selected). 15px-wide transparent hit stroke for clicks.

Click an edge → selects it (purple line + chevron). Click empty canvas to deselect.

##### Branch chip on diamond outgoing edges

If the source is a Decision Diamond and `decisionConfigs[from.id]` exists with `presetRules`, render a chip at the edge midpoint via `<foreignObject>`:

- White pill, `1px #E5E7EB` border, 999px radius, subtle shadow
- 280px max width, ellipsis on overflow
- Two-line content: bold `Rule N · entity` on top, muted summary below (e.g. `Amount is at least $1,000 · Stage equals Won`)
- Edges past `presetRules.length` get an italic `Otherwise` chip
- `pointer-events: none` (chip never intercepts edge clicks)

For forked siblings, the chip resolves the rule via `config.forkRuleIndex` instead of edge index.

#### 4.3.3 Inline "+" picker

Click the hover "+" → opens a 600×700 popover anchored at the cursor in canvas-space. Header search input + scrollable list. Featured **Decision diamond** card sits at the top (purple, diamond icon, one-line description); below it the legacy When/Then catalog filtered by query. Picking the diamond inserts a `decision` node and opens the DD modal immediately. Picking any other slug calls `insertAfterOrigin(originId, payload)` and may auto-open the matching config modal.

Picker tab routing:
- Trigger `+` → Then catalog
- Action / Decision `+` → When catalog (yes — the inverse — so the user can intersperse)

#### 4.3.4 Auto-insert / dissolve passes

A `useEffect` keyed on `[edges, nodes]` runs three passes whenever the graph changes:

1. **Pass 1 — route-through**: if a source has 2+ outgoing and one of them is already a diamond → route the other (non-diamond) outgoing edges to originate from the diamond.
2. **Pass 2 — create diamond**: a non-decision source with ≥2 outgoing edges to non-diamond targets gets a new diamond inserted between source and targets. Position = midway between source and centroid of targets.
3. **Pass 3 — dissolve**: diamonds with **exactly 1** outgoing edge (route-through collapse) get removed and their incoming source(s) reconnected directly to the target. **Diamonds with 0 outgoing are NOT dissolved** — those are freshly user-inserted via the picker and survive until the user wires branches. Diamonds with `presetRules` (forked siblings) also survive single-outgoing.

A `changed` flag prevents infinite loops; if no pass mutated state, no setNodes/setEdges call.

#### 4.3.5 Drag-to-connect

From the hover "+" button, the user can press-and-drag to draw a connector preview line. While dragging, window-level pointermove tracks the cursor, `document.elementsFromPoint` finds a `[data-node-id]` to target. The preview line is a 2.8 px black bezier with a chevron end-cap matching real edges. Targeting a node ring goes black; releasing on a node commits an edge (deduplicated by from/to).

#### 4.3.6 Node action menu

Single-node click (no Shift, no drag) anchors a menu at the cursor in canvas-space. 248×56 row items per action: icon + label + arrow. Decision diamonds get a trimmed menu (no Settings/Duplicate/Rename — only View, Delete).

Items: View and edit · Settings · Duplicate · Rename · Delete (red).

Action handlers:
- `view` → opens the appropriate modal (DD modal for decision, Purchase modal for `product-is-purchased`, Appointment modal for `appointments`, Pipeline modal for `pipeline-stage-is-moved`). Closes the action menu first so it doesn't sit stranded behind the modal.
- `rename` → sets `renamingNodeId` to enter inline edit (guarded against decision diamonds).
- `delete` → drops node + all incident edges.
- `duplicate` → clones the node 120 px right, 40 px down.

### 4.4 Bottom toolbar

Floating pill at bottom-center. Zoom in / Zoom out / Reset (50%) / Fit-to-screen. Shows current zoom %.

---

## 5 · Modals — common shell conventions

All four config modals share the same outer shell to keep the experience consistent:

- Backdrop `rgba(0,0,0,0.4)`; modal anchored in the upper-third (12vh paddingTop, `align-items: flex-start`).
- Shell: 540–640 px wide, white, 12 px radius, **three-layer shadow** `0 24px 38px 3px rgba(0,0,0,0.14), 0 9px 46px 8px rgba(0,0,0,0.12), 0 11px 15px -7px rgba(0,0,0,0.2)`.
- `overflow: visible` on the inner shell + body so dropdowns can extend past the modal boundary.
- Header (**56 px**, 8 px padding, 1 px `rgba(0,0,0,0.09)` bottom border): close × (40×40 icon button, `#444`) · title (h4, 20/normal weight, line-height 20, `#444`) · primary Save button (40 px, 11/15 padding, 8 px radius, `#006CEB`, white text, font 14/600/16, disabled at 0.4 alpha until required fields are set).
- Body bg white, 24 px padding, rounded bottom corners.
- Font: `Sul Sans`. Text colors: primary `rgba(0,0,0,0.824)`, muted `rgba(0,0,0,0.6)`, icon `rgb(44,44,44)`.
- Escape closes the topmost open dropdown first; only closes the modal when no dropdown is open. Clicking outside the inner shell closes the modal.

### Summary block (all modals)

Sits at top of body, marginBottom 20:
- "Summary" label: 12/16, weight 400, `rgba(0,0,0,0.6)`
- Body text: 14/20, `rgba(0,0,0,0.824)`, marginTop 4

### Dropdown input shells

All goal-trigger modals use a Material-floating-label outlined input:

| State | Border | Label position | Label color |
|---|---|---|---|
| Default (empty, closed) | 1 px `#CCCCCC` | inside field, vertically centered, `left: 16` | 14/20, `rgba(0,0,0,0.6)` |
| Active (dropdown open) | **2 px `#006CEB`** (padding -1 px each side to compensate) | top border, `top: -9 / left: 12` | 12/16 weight 600, **`#006CEB`** |
| Filled (closed with value) | 1 px `#CCCCCC` | top border (notched) | 12/16 weight 400, `rgba(0,0,0,0.6)` |

150 ms ease transition on top / font-size / color. Field height **42 px** (consistent across all modals as of v1). 8 px radius. Right padding 36 px to reserve space for the absolutely-positioned chevron. The chevron rotates 180° + turns blue on active.

### Dropdown menu (popover)

`position: absolute`, `top: calc(100% + 6px)`, full width of trigger, 12 px radius, 240 px max-height, `1px rgba(0,0,0,0.2)` border, three-layer shadow `0 8px 10px 1px rgba(0,0,0,0.14), 0 3px 14px 2px rgba(0,0,0,0.12), 0 5px 5px -3px rgba(0,0,0,0.2)`, `z-index: 50`.

Items 8/16 padding, three states:

| State | Background | Text |
|---|---|---|
| Default | white | dark `rgba(0,0,0,0.824)` |
| Hover (not selected) | `rgba(0,0,0,0.08)` | dark |
| Selected | solid `rgb(0,108,235)` | white |

Each item can have a small two-line content (title 14/20 + subtext 12/16 muted). Subtext uses `color: inherit, opacity: 0.7` so it dims to white-at-70% in the selected state.

Required-asterisk red: `#d0021b`, font-weight 600, `marginLeft: 2`.

---

## 6 · "When a purchase is made" trigger modal

**Slug**: `product-is-purchased`. **Auto-opens** when picked from the inline `+` picker; re-opens via the action menu's "View and edit".

State per node id in `purchaseConfigs: Record<string, PurchaseTriggerConfig>`:

```ts
type PurchaseTriggerConfig = {
  purchaseType: 'product' | 'any' | null
  productIds: string[]
  paymentTypeIds: string[]
}
// Defaults seed two pre-selected payment chips:
//   ['cc-now', 'include-zero']
```

Body sections (top-to-bottom):

1. **Summary** — "This is used to move a contact into or out of an action sequence based on a purchase they've made."
2. **Select purchase type** (required) — single-select. Options: `Product` (subtext "When a specific product is purchased"), `Any purchase` (subtext "When any purchase is made").
3. **Select products** — multi-select chips-in-input, **only visible** when type = `Product`. 10 mock products grouped by category (`Uncategorized` / `Service` / `Subscription`). Typing filters and **bold-highlights** matched substrings.
4. **Payment type (optional)** — multi-select chips-in-input. Always visible after step 2 is set. 8 mock options including the two pre-seeded ones (`Credit Card (charge now)`, `Include $0 invoices`) plus `Credit Card (Manual)`, `Check`, `Cash`, `Money Order`, `Adjustment`, `Any payment type`. Subtext on each option ("Run when payment type is made by …").

Behavior:
- **Save** enabled iff `purchaseType` is set AND (type !== 'product' OR `productIds.length > 0`).
- On Save: persist draft, `console.log` JSON, close.
- Chips render as 28-tall pills `0/4/4/12` padding, margin `4 8 4 0`, `rgba(0,0,0,0.06)` bg, 36 px radius, 12/18 text, 16×16 × button.

Chips in input use the **notched-outline + multi-select wrapper** pattern; chevron sits absolute right 8 inside the input-container.

---

## 7 · "Appointment" goal modal

**Slug**: `appointments`. Same auto-open + view-action wiring.

```ts
type AppointmentGoalConfig = {
  whenContact: 'Schedules' | 'Reschedules' | 'Cancels'
  appointmentTypeId: string | null
}
const blankAppointmentGoalConfig = (): AppointmentGoalConfig => ({
  whenContact: 'Schedules',           // default = Schedules
  appointmentTypeId: null,
})
```

Body sections:

1. **Summary** — "This is used to move a contact into or out of an action sequence when an appointment is booked, canceled, or rescheduled."
2. **When a contact** (required) — single-select. Options: `Schedules` (default) / `Reschedules` / `Cancels`. Uses **above-field bold label** (14/700) not notched outline.
3. **an** (required) — single-select with red `*` asterisk. 30 mock appointment types, each with name + duration subtext (e.g. "60-Minute Coaching Call with Jialing Chen / 60 minutes").
4. **Pro-tip callout** — `#D6F0FF` background, 8 px radius, 12 px padding, info-circle icon + text + "Learn more" button (`rgba(0,0,0,0.06)` bg, external-link icon, opens `https://help.keap.com/help/campaign-goals-appointments` in a new tab).

Save enabled iff `appointmentTypeId` is set.

This modal predates the floating-label transition — labels stay above the field, only the **color** turns blue on active (no movement of the label itself).

---

## 8 · "Pipeline stage move" trigger modal

**Slug**: `pipeline-stage-is-moved`.

```ts
type PipelineStageMoveConfig = {
  whenMoving: 'Into' | 'Out of' | null
  pipelineId: string | null
  stageId: string | null
}
```

Three required notched-outline dropdowns + pro-tip callout:

1. **When moving** (required) — `Into` / `Out of`.
2. **Pipeline** (required) — three mock pipelines:
   - **Sales Pipeline**: New / Qualified / Estimate Sent / Estimate Signed / Scheduled / Won / Lost
   - **Onboarding Pipeline**: Welcome / Kickoff / Training / Active
   - **Renewals Pipeline**: Upcoming / Outreach Sent / Negotiating / Renewed / Churned
3. **Stage** (required) — **disabled** (`#F5F5F5` bg, `cursor: not-allowed`) until a Pipeline is picked. Options come from `selectedPipeline.stages`. **Clears** when Pipeline changes (stage id wouldn't resolve under a new pipeline).
4. **Pro-tip** — *"If the goal is selected to trigger when a Deal is moved 'Into' a stage, it won't trigger when creating a Deal in that stage either manually or through Easy/Automation Builder. The Deal must instead be moved from another stage into that stage to trigger the goal. For a solution that will trigger based on the Deal's starting stage, you can use an Easy Automation 'Deal enters stage' trigger."* — same callout style as Appointment, with "Learn more" → `https://help.keap.com/help/campaign-goals-pipeline-stage-move`.

Save enabled iff all three required fields are set.

---

## 9 · Decision Diamond modal (`/pages/AutomationBuilder.tsx` → `DecisionDiamondEditor`)

The deepest modal. **See `HANDOFF-DD-V1.md` for the design rationale and full preset registry**. This section covers what to copy and how the wiring fits the canvas.

### 9.1 State

Per diamond node id:

```ts
type DDPresetRuleSet = {
  id: string
  entityKey?: 'primary' | 'contact'             // per-rule entity tab (Option C)
  conditions: DDPresetCondition[]
  aiPrompt?: string                              // provenance for AI-generated rules
}
type DDPresetCondition = {
  id: string
  fieldId: string
  operator: string
  values: string[]
  valueJoin?: 'or' | 'and'
}
type DecisionDiamondConfig = {
  groups: DDGroup[]
  defaultRouting: string
  boundEntity?: EntityId
  presetRules?: DDPresetRuleSet[]
  forkGroupId?: string
  forkRuleIndex?: number
}
```

### 9.2 Modal body — three nested scopes

```
Summary text (auto-derived from upstream)
[ ✨ Describe your routing       ] [Generate]    ← Option A — top AI bar
[High-value won][Stalled][Onboarding][Win-back]  ← template chips
Helper text
┌─ Rule 1 [Deal ▾] — if the deal  [✨] [×] ─┐
│  ✨ Generated · "high value won deals" · Edit │
│  If the [Amount ▾] [is at least ▾] [chips +or+and]│
│  AND If the [Stage ▾] [equals ▾] [Won]            │
│  + And                                             │
│  Or  (pill on hairline — group boundary)          │
└────────────────────────────────────────────────────┘
┌─ Rule 2 [Contact ▾] — if the contact  [✨] [×] ─┐
│  Lifecycle Stage [equals] [Customer]              │
│  + And                                             │
│  Or                                                │
└────────────────────────────────────────────────────┘
+ Add rule          2 of 10
```

**Scope 1 — value-level** (`.may-or-and-wrapper`): lowercase `+ or` / `+ and` inline buttons after the value cell. Each click sets `condition.valueJoin` and commits the current draft as another chip. Chips render with a small inline `Or` / `And` label between them based on `valueJoin`.

**Scope 2 — rule-level**: a single capitalized `+ And` link on its own line below the last condition. Adds another condition (a free-form picker for field/operator/values) inside the same rule.

**Scope 3 — group-level**: an `Or` pill (`31×24`, `#F0F0F0` bg, 6 px radius) on a 1 px `#DDDDDD` hairline rendered **inside each rule card's footer**. Plus the `+ Add rule` ghost button below the stack — creates a new rule (group). Max **10** rules per diamond.

### 9.3 AI assistant (mock — keyword regex stub)

`mockAiSeedConditions(prompt, preset)` returns `DDPresetCondition[]` based on regex hits:

| Keywords | Seeded |
|---|---|
| high value / premium / enterprise / large / big | Amount ≥ $5,000 |
| over $X / above $X / more than $X | Amount > X (extracted) |
| won / closed-won / sold / signed / sale | Stage = Won |
| lost / win-back / churn | Stage = Lost |
| stalled / stuck / no-movement / stagnant | Days in Stage > 14 |
| onboarding / new-customer / first-time | Stage = Won + Amount < $5,000 |
| (none) | one empty condition on the first preset field |

Two surfaces consume the same seeder:
- **Option A** — top-of-modal "Describe your routing" input + Generate. **Replaces the entire `presetRules`** with a single rule seeded from the prompt; stores `aiPrompt` on the rule.
- **Option B** — per-rule `✨` button in the rule header. Opens an in-card prompt panel (purple-tinted bg, lavender border, autofocus input, Cancel / Generate). Replaces **just this rule's** conditions.

After AI generation, rules show a `✨ Generated · "<prompt>"` pill that re-opens the prompt for refinement (truncates at 48 chars).

Both surfaces opt in via `preset.showTemplatesToggle: true` — only the Pipeline-stage-is-moved preset enables them today.

### 9.4 Rule preset registry

```ts
const RULE_PRESETS: Record<string, RulePreset> = {
  'product-is-purchased':    { entity: 'Deal',        header: 'If the deal',        fields: [Amount, Stage] },
  'pipeline-stage-is-moved': { entity: 'Deal',        header: 'If the deal',        fields: [Amount, Stage, Days in Current Stage], showTemplatesToggle: true },
  'appointments':            { entity: 'Appointment', header: 'If the appointment', fields: [Type, Date] },
}
const CONTACT_PRESET = { entity: 'Contact', header: 'If the contact', fields: [Lifecycle Stage, Marketing Consent, Lifetime Value, Total Orders, Days Since Last Order] }
```

`derivePresetFor(slug, upstreamNodeId, purchaseConfigs, appointmentConfigs, pipelineConfigs)` returns the base preset with the **upstream config baked in**:
- `product-is-purchased` + `Any purchase` → adds a `Product` field
- `product-is-purchased` + specific products → summary names the products
- `appointments` + specific type → drops `Type` field, summary names the appointment
- `pipeline-stage-is-moved` + specific stage → drops `Stage` field, summary names the pipeline/stage

Per-rule entity (Option C — kept): each rule's header has a small `DDSelect` (width 150) listing the primary entity + `Contact`. Switching wipes that rule's `conditions`. `presetForRule(rule, primary)` resolves the active preset per rule.

### 9.5 Fork behavior

When the user clicks Save on a diamond connected to a fork-eligible trigger (`appointments` or `pipeline-stage-is-moved`) and `rules.length >= 2`, `reconcileDiamondAfterSave` **forks the diamond into N siblings**:

- Each sibling carries the full `presetRules` array (redundant copy) plus its own `forkRuleIndex`
- All siblings share a `forkGroupId`
- Incoming edges are replicated — every upstream points to every sibling
- Outgoing edges distributed by index (first sibling gets first edge, etc.)
- Siblings stack vertically with 140 px stride
- **Existing siblings keep their positions** on subsequent reconciles (only newly-added siblings get fresh positions at the bottom of the column)
- Deleting the last rule of a group removes the whole group (no empty groups)
- The dissolve pass skips diamonds with `presetRules` so single-outgoing forked siblings survive

Editing any sibling shows the full rule list — `onChange` propagates the new `presetRules` to every sibling in the group on every edit.

### 9.6 Title rules

`reconcileDiamondAfterSave` updates each diamond's title:
- 0 rules → `Decision Diamond` (or `{Entity} · Decision Diamond` with preset)
- 1 rule with summary → `{Entity} · Rule 1: {summary}` (entity comes from the rule's own preset)
- ≥2 aggregated → `{Entity} · {N} rules`
- Forked sibling → `{Entity} · Rule N: {summary}`

Title display rule (all nodes): wraps to multi-line, **clamps to 5 lines** with `-webkit-line-clamp`, `wordBreak: break-word`, max width 168 display-px (LABEL_WIDTH constant). Decision-diamond titles render in muted `rgba(0,0,0,0.6)` and are **non-editable** (rename hidden from menu).

---

## 10 · Visual / token reference

| Token | Value |
|---|---|
| Primary blue (Save / CTAs) | `#006CEB` (a.k.a. `#006ceb`) |
| Active border (open dropdown) | `#006CEB` 2 px |
| Default input border | `#CCCCCC` 1 px |
| Field bg | `#FFFFFF` |
| Text primary | `rgba(0,0,0,0.824)` |
| Text muted | `rgba(0,0,0,0.6)` |
| Title heading | `#444` (h4 20/400/lh20) |
| Required asterisk | `#d0021b` |
| Info-callout bg | `#D6F0FF` |
| Subtle button bg | `rgba(0,0,0,0.06)` |
| Modal radius | 12 px |
| Field radius | 8 px |
| Chip radius | 36 px (28 height) |
| Modal shadow | `0 24px 38px 3px rgba(0,0,0,.14), 0 9px 46px 8px rgba(0,0,0,.12), 0 11px 15px -7px rgba(0,0,0,.2)` |
| Menu shadow | `0 8px 10px 1px rgba(0,0,0,.14), 0 3px 14px 2px rgba(0,0,0,.12), 0 5px 5px -3px rgba(0,0,0,.2)` |
| Header border-bottom | `1px solid rgba(0,0,0,0.09)` |
| Field height | 42 px (all goal modals) |
| Header height | 56 px |
| Modal width | 540 px (Pipeline) / 640 px (Purchase, Appointment, DD) |
| Connector gray | `#CCCCCC` |
| Selected purple (DD / edge) | `#8358F1` |
| Canvas LABEL_WIDTH | 373 canvas-space (≈168 display @ 50% zoom) |
| Canvas LABEL_FONT | 26 canvas-space |
| Canvas NODE_W / NODE_H | constants in `AutomationBuilder.tsx` |
| AI accent (Generate / pills) | `#8358F1` / `rgba(131,88,241,0.08)` |
| Font family (modals) | `"Sul Sans", Helvetica, Arial, sans-serif` |
| Font family (DD modal — earlier rev) | `"Proxima Nova", Inter, system-ui, sans-serif` (now reverted to Sul Sans for parity) |

---

## 11 · Modal interaction matrix

| Modal | Auto-open trigger | View action | Required fields | Save semantics |
|---|---|---|---|---|
| **Purchase** | `+` picker → `product-is-purchased` | Action menu → View and edit on a `product-is-purchased` node | `purchaseType` + (`productIds` when type=product) | Persist draft, log JSON, close |
| **Appointment** | `+` picker → `appointments` | Action menu → View and edit on `appointments` node | `appointmentTypeId` | Same |
| **Pipeline** | `+` picker → `pipeline-stage-is-moved` | Action menu → View and edit on `pipeline-stage-is-moved` node | `whenMoving` + `pipelineId` + `stageId` | Same |
| **Decision Diamond** | `+` picker → "Decision diamond" featured card, OR auto-insert from 2+ outgoing edges (Pass 2) | Action menu → View and edit on any `type: 'decision'` node | — (save always enabled) | Live `onChange` propagation; Save closes; `reconcileDiamondAfterSave` runs to update titles / forks |

Action menu always closes when a modal opens (`setMenuAnchor(null)`).

---

## 12 · Implementation contracts (the bits that are easy to miss)

These are the small invariants that, if you skip them, the behavior breaks.

1. **Dissolve excepts 0-outgoing AND `presetRules`-bearing diamonds.** Only diamonds with **exactly 1** outgoing edge are dissolved. Picker-inserted diamonds start at 0 outgoing and must survive. Forked siblings have 1 outgoing each and must also survive.
2. **`presetForRule` (Option C) vs `derivePresetFor` (upstream-aware).** The chain is: `upstreamSlug → derivePresetFor(...) → primaryPreset → presetForRule(rule, primary)` per rule. Don't short-circuit either.
3. **`forkGroupId` propagation in `onChange`.** When the user edits a forked diamond, parent's `onChange` walks ALL siblings sharing `forkGroupId` and rewrites `presetRules` on each. Without this, opening sibling 2 after editing sibling 1 shows stale data.
4. **Reconcile preserves existing sibling positions.** Only newly-added siblings get fresh y coords (anchored to the bottom of the existing column). User-dragged positions stay.
5. **Branch chips use `forkRuleIndex` when set, edge-index otherwise.** Forked siblings have 1 outgoing edge; the rule it represents is `presetRules[forkRuleIndex]`, not `presetRules[edge-index]`.
6. **Comparator switch wipes trailing values + `valueJoin`** when the new operator is unary.
7. **Delete last condition of a rule → delete the whole rule** (unless it's the last rule in the diamond; that one is kept so the modal isn't empty).
8. **Title clamp & editability**: every node label uses `-webkit-line-clamp: 5` + `wordBreak: break-word`. Inline rename uses `<textarea>` with `maxHeight = lineHeight * 5`. Decision diamonds have `pointer-events: none` and muted color on the title — non-editable.
9. **Modal body needs `overflow: visible`** so dropdown popovers can escape the modal boundary. The overlay (outer) handles scroll instead.
10. **Floating label transition**: `top` + `font-size` + `color` transition with 150 ms ease. `paddingLeft/Right` swap by 1 px when border thickens (1 → 2 px) to avoid layout twitch.
11. **Mock AI uses regex on the prompt** — single function, swap for an LLM call later.
12. **Required-asterisk is `#d0021b` with weight 600**, `marginLeft: 2`, inline `<span>` inside the label.

---

## 13 · Dependencies (`package.json`)

The Builder is just React + React Router. No external state library, no UI kit dependency at runtime.

```json
"dependencies": {
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "react-router-dom": "^6.x"
}
```

For the list page, you'll either bring your own `Tabs / DataTable / Row / Th / StatusBadge / KebabMenu / IconButton / Button` or copy them from `src/components/ui/*`. They're plain Tailwind-styled primitives.

Tailwind v4 is used for the list page styling. The Builder uses inline styles (no Tailwind dependency).

---

## 14 · Build & run

```bash
cd <project-root>
npm install
npm start   # Vite dev server at :3000 — script is `start`, not `dev`
```

The Builder is at `http://localhost:3000/my-automations/list/advanced/<automationId>` (any id from `advancedAutomations` works — e.g. `adv1`).

---

## 15 · Step-by-step rebuild plan for a fresh project

1. Drop `react-router-dom` + the routes from §1 into your `App.tsx`.
2. Copy `src/data/mockData.ts`, `src/data/automationIcons.json`, `src/entities/registry.ts`, `src/decisionDiamond/dropdowns.ts`, `src/styles/automation-builder.css`.
3. Copy `src/pages/Automation.tsx` + any `src/components/ui/*` primitives it imports (or substitute equivalents from your DEX kit).
4. Copy `src/pages/AutomationBuilder.tsx` whole-file. It's self-contained except for the four files in step 2 and the `BuilderNode` icon helpers (`IconSvg`, `sizedSvg`) which live in the same file.
5. Verify routing: `/my-automations/list/easy`, `/my-automations/list/advanced`, `/my-automations/list/advanced/:id`.
6. Smoke-test the four modals: pick each trigger from the `+` picker; confirm auto-open + View-and-edit; confirm Save validates required fields.
7. Smoke-test the DD modal: insert manually via the picker; check the fork behavior for appointments + pipeline (≥ 2 rules → fork); check AI + chip seeders on pipeline.
8. Confirm titles wrap to 5 lines, inline rename works on non-decision nodes, branch chips render on diamond outgoing edges.

That's the entire surface.
