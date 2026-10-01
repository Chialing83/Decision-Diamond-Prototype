# HANDOFF — Keap Automation Builder Canvas (V1)

Everything you need to rebuild the canvas surface of `AutomationBuilder.tsx` in another project. Reference companion: `HANDOFF-DD-V1.md` covers the Decision Diamond modal in depth; this file is the canvas + interactions layer.

Stack expectations: React 19 + Vite + TypeScript, no animation library, no graph library. Icons come from `lucide-react`; design tokens from a Tailwind v4 + DEX palette but anything equivalent works. No backend.

---

## 0. File map

| Path | Purpose |
|---|---|
| `src/pages/AutomationBuilder.tsx` | Full canvas + all interactions (~8.9k lines, single file by design — keep it monolithic so state stays colocated) |
| `src/data/automationIcons.json` | Slug → label + raw SVG for the When/Then catalogs |
| `src/decisionDiamond/dropdowns.ts` | Operator catalog + value option lookups (DD modal) |
| `src/entities/registry.ts` | Entity definitions (Contact, Deal, Appointment, Job, Invoice, Company) |
| `HANDOFF-DD-V1.md` | Decision Diamond modal spec |

The route `'/my-automations/list/advanced/:automationId'` renders `AutomationBuilder` as a **standalone** full-page surface (no app shell / no sidebar).

---

## 1. Coordinate systems

There are three:

1. **Client space** — DOM pixel coordinates from pointer events. Origin = top-left of the viewport.
2. **Canvas-wrapper space** — pixels relative to the canvas container's bounding rect. Origin = top-left of `canvasWrapperRef`.
3. **Canvas space** — the pre-transform coordinate system where every node `(x, y)` lives. Origin = top-left of the surface BEFORE pan/zoom.

The surface is rendered with `transform: translate(pan.x, pan.y) scale(zoom)` and `transform-origin: top left`. So:

```ts
// canvas → screen (client)
screenX = rect.left + pan.x + zoom * canvasX
screenY = rect.top  + pan.y + zoom * canvasY

// client → canvas
canvasX = (clientX - rect.left - pan.x) / zoom
canvasY = (clientY - rect.top  - pan.y) / zoom
```

`clientToCanvas(clientX, clientY)` is the canonical inverse. Use it for every placement, hit-test, and pointer-anchored UI (pickers, menus, marquees).

---

## 2. Top-level state shape

```ts
// Nodes — what sits on the canvas
type BuilderNode = {
  id: string
  type: 'trigger' | 'action' | 'decision'
  title: string                  // user-visible label (multi-line, wraps, clamps to 5)
  subtitle?: string              // optional — shown under title
  name?: string                  // slug for entity mapping / preset lookup
  x: number; y: number           // canvas-space CENTER of the tile
  accent?: string                // tile chrome accent — green=When, blue=Then
  icon?: React.ReactNode
  warning?: boolean              // dot color → warning amber
  // status: ready/draft/published (per `STATUS_PALETTE`)
}

// Edges — connections between nodes
type BuilderEdge = { id: string; from: string; to: string; label?: string }

// Locked pairs — auto-spawned dependencies (e.g. Get email opt-in)
type LockedPair = { hostId: string; partnerId: string; edgeId: string }

// Camera
const [zoom, setZoom] = useState(0.5)              // [0.25, 2]
const [pan,  setPan]  = useState({ x: 0, y: 0 })
const [panMode, setPanMode] = useState(false)      // Tab toggles
const [isPanning, setIsPanning] = useState(false)

// Selection
const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
const [primarySelectedId, setPrimarySelectedId] = useState<string | null>(null)
const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null)
const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

// Mode flags
const [picker, setPicker]   = useState<{ originId; type; anchor } | null>(null)
const [menuAnchor, setMenuAnchor] = useState<{x,y} | null>(null)
const [marquee, setMarquee] = useState<{x1,y1,x2,y2} | null>(null)
const [connecting, setConnecting] = useState<{ originId; startX; startY; currentX; currentY; targetId } | null>(null)
const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null)

// Editors (one per kind)
const [decisionEditorId, setDecisionEditorId] = useState<string | null>(null)
const [purchaseEditorId, setPurchaseEditorId] = useState<string | null>(null)
const [appointmentEditorId, setAppointmentEditorId] = useState<string | null>(null)
const [pipelineEditorId, setPipelineEditorId] = useState<string | null>(null)

// Per-node configs (keyed by node id) — survive close/reopen
const [decisionConfigs,  setDecisionConfigs]  = useState<Record<string, DecisionDiamondConfig>>({})
const [purchaseConfigs,  setPurchaseConfigs]  = useState<Record<string, PurchaseTriggerConfig>>({})
const [appointmentConfigs, setAppointmentConfigs] = useState<Record<string, AppointmentGoalConfig>>({})
const [pipelineConfigs,  setPipelineConfigs]  = useState<Record<string, PipelineStageMoveConfig>>({})

// Toast / undo / status
const [toast, setToast] = useState<{ title; body } | null>(null)
const [lastAction, setLastAction] = useState<{ label; snapshot; anchor } | null>(null)
const [droppedTrigger, setDroppedTrigger] = useState<string | null>(null)

// Locked pairs
const [lockedPairs, setLockedPairs] = useState<LockedPair[]>([])
```

`useRef<HTMLDivElement | null>(null)` for `canvasWrapperRef` — used everywhere for `getBoundingClientRect()`.

---

## 3. Constants worth getting right on day one

```ts
// Tile geometry — 0.8× the previous scale; everything below is derived
const ICON_SIZE         = 48
const NODE_W            = 90      // tile width (also half-anchor radius for edges)
const NODE_H            = 90
const DIAMOND           = 90      // decision tile is a rotated square of this size
const STATUS_SIZE       = 30
const STATUS_OVERHANG   = 8
const TILE_RADIUS       = 22
const SELECTION_RING    = 6
const SELECT_ACCENT     = '#8358F1'  // purple selection stroke

// Labels (titles render below the tile, can wrap up to 5 lines)
const LABEL_WIDTH       = 373    // fixed-width clamp; long titles wrap inside
const LABEL_TOP_OFFSET  = 122    // px below tile top
const LABEL_FONT        = 26
const TOOLTIP_TOP_OFFSET = -75
const TOOLTIP_FONT      = 24

// Hover "+" affordance
const HOVER_ADD_SIZE    = 64

// Spacing
const PH_GAP            = 120    // edge-to-edge gap (placeholder, default node-to-node)
const LOCKED_PAIR_GAP   = 240    // wider gap between locked-pair members (host ↔ partner)
const PH_W              = 90     // placeholder card width

// Connector
const CHEVRON_W         = 9
const CHEVRON_H         = 6
const CONNECTOR_DEFAULT = '#9CA3AF'
const CONNECTOR_SELECTED = '#000000'

// Multi-select toolbar
const TOOLBAR_MARGIN    = 8

// Auto-focus / fit-to-view
const FOCUS_PADDING     = 48
```

`measureTitleVisualWidth(title)` — module-scope helper using a singleton `<canvas>` 2D context to measure the title's wrapped width at `LABEL_FONT` in `Tahoma / Segoe UI / Arial sans` (cap at `LABEL_WIDTH`, floor at `NODE_W`). Required for tidy-up packing and inline-add spacing.

---

## 4. Canvas surface (pan/zoom/grid)

A single absolutely-positioned `<div>` is the surface. Pan/zoom apply once on the surface; nodes, edges, marquee, and pickers live inside.

```tsx
<div
  ref={canvasWrapperRef}
  style={{ position: 'relative', overflow: 'hidden', cursor: ... }}
  onPointerDown={handleCanvasPointerDown}  // marquee / pan
  onPointerMove={...}
  onPointerUp={...}
>
  <div
    style={{
      position: 'absolute', inset: 0,
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      transformOrigin: 'top left',
      width: `${100 / zoom}%`, height: `${100 / zoom}%`,
    }}
  >
    <svg overflow="visible" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {edges.map(...)}
      {openLeaves.map(...)}    // dashed connector to placeholder
      {connecting && ...}       // live drag-to-connect preview
    </svg>
    {marquee && <MarqueeRect ... />}
    {nodes.map(n => <CanvasNode ... />)}
    {openLeaves.map(n => <InlineAddPlaceholder ... />)}
    {picker && <InlineAddPicker ... />}
    {primarySelectedId && menuAnchor && <NodeActionMenu ... />}
  </div>
  {toast && <Toast ... />}
  {droppedTrigger && <AnnounceToast ... />}
  <BottomToolbar zoom onZoomIn onZoomOut />
  <SelectionToolbar ... />
</div>
```

### 4.1 Pan

- **Hold Tab → pan mode** (`panMode = true`). Cursor becomes `grab`. Press-and-drag anywhere on canvas pans.
- **Active pan** (`isPanning = true`) → cursor `grabbing`. Always show grabbing cursor on pointer-down regardless of mode.
- A `keydown(Tab)` listener flips `panMode`; the same listener on `keyup` flips it back. `e.preventDefault()` so Tab doesn't focus an off-screen element.
- Pan gesture stores `{ startPanX, startPanY, startClientX, startClientY }` in a ref; on move: `setPan({ x: startPanX + dx, y: startPanY + dy })`.

### 4.2 Zoom

- `[0.25, 2]` clamped; step `0.1`. Updated by BottomToolbar `+ / -` buttons and the auto-focus logic.
- No mouse-wheel zoom (deliberate — prevents accidental zoom-out while scrolling a long config modal).

---

## 5. Node tile

`CanvasNode` is positioned absolutely at `node.x - NODE_W/2, node.y - NODE_H/2` (the `x,y` is the center).

Layers (top to bottom of the visual stack):
1. **Status halo** — soft outer glow, color from `STATUS_PALETTE[node.status]`.
2. **Tile chrome** — white card, `TILE_RADIUS` corners, accent edge on hover/selected.
3. **Icon** — `ICON_SIZE` SVG centered.
4. **Status dot** — small filled circle at top-right corner overhanging by `STATUS_OVERHANG` px.
5. **Selection ring** — only when `selectedNodeIds.has(id)`. Purple `SELECT_ACCENT`, `SELECTION_RING` px outline.
6. **Hover "+"** — visible on hover for non-latest open leaves (suppressed if this node already owns the inline-add placeholder).
7. **Title block** — `LABEL_WIDTH` wide, `LABEL_FONT`px, line-height 1.2, wraps + clamps to 5 lines with `…` overflow.
8. **Tooltip** — status tooltip on hover; **suppressed when multi-select toolbar is present** (toolbar shares the slot above the node).

### Title rules
- `width: LABEL_WIDTH; left: (NODE_W - LABEL_WIDTH)/2` — title centers on the tile but its block extends past the tile horizontally. Long titles wrap inside the box.
- `whiteSpace: 'normal'; wordBreak: 'break-word'; WebkitLineClamp: 5`.
- Decision titles are non-interactive (auto-generated from rules). Other titles are click-to-rename — pointerdown on the label stops propagation so it doesn't start a drag, then opens `RenameInput`.

### `RenameInput`
- `<textarea>` styled identically to the label block (same font, width, wrap).
- Commit on Enter (no Shift) or blur (when non-empty + changed).
- Cancel on Escape.
- Trims whitespace before commit.

### Node interactions
| Gesture | Effect |
|---|---|
| Pointerdown | Select node (replaces selection unless Shift held), close menu, primary becomes this id |
| Shift+Pointerdown | Toggle node in selection; anchor set to FIRST clicked if none |
| Click (no drag) | Open `NodeActionMenu` at cursor (canvas-space anchor) — only when selection size is 1 |
| Double-click | Open detailed editor (decision modal for `decision`, otherwise route by `name`: `product-is-purchased` / `appointments` / `pipeline-stage-is-moved` open dedicated trigger modals; locked-pair partner shows a "non-configurable" announce; everything else uses a placeholder announce) |
| Drag tile body | Move node — for locked-pair halves, partner translates by same delta |
| Drag "+" past threshold | Begin drag-to-connect (`beginConnect`) |
| Hover non-latest tile | Show hover "+" affordance |
| Hover "+" affordance | On click → open `InlineAddPicker` with `type = trigger? 'then' : 'when'` |

---

## 6. Edge rendering

A single `<svg overflow="visible" pointer-events: none>` holds all edges. Each edge `<g>` has:

1. **Invisible hit stroke** — `strokeWidth=15`, transparent, `pointer-events: stroke`. Click selects the edge (unless locked — see §10).
2. **Visible line** — `edgePath(a, b)` cubic bezier from `nodeAnchorRight(from)` to `nodeAnchorLeft(to)`.
3. **Chevron end-cap** — three-point polyline pointing into the target anchor.
4. **Lock badge** — only when the edge id appears in `lockedPairs` (see §10).

```ts
const nodeAnchorRight = n =>
  n.type === 'decision'
    ? { x: n.x + DIAMOND/2 * Math.SQRT2, y: n.y }
    : { x: n.x + NODE_W/2, y: n.y }
const nodeAnchorLeft = n =>
  n.type === 'decision'
    ? { x: n.x - DIAMOND/2 * Math.SQRT2, y: n.y }
    : { x: n.x - NODE_W/2, y: n.y }
```

```ts
function edgePath(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1) / 2
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}
```

### Drag-to-connect (live preview)
- `beginConnect(originId, clientX, clientY)` starts gesture.
- Window-level `pointermove` updates `connecting.currentX/Y` and hit-tests `[data-node-id]` under the cursor (excluding origin).
- Locked target → snap. Render bezier in `#000000` and the chevron only once locked.
- `pointerup` either commits a new edge to `targetId` or discards.

---

## 7. Inline-add placeholder

The **latest open leaf** (the most recently added node with no outgoing edges) docks a placeholder at `x = leaf.x + NODE_W/2 + PH_GAP + PH_W/2`, same y as leaf.

Variants:
- `'single'` for triggers — one `+ Then` pill.
- `'double'` for actions/decisions — stacked `+ When` (top, green) over `+ Then` (bottom, blue).

Clicking a pill opens `InlineAddPicker` with `originId = leaf.id` and `type ∈ {'when','then'}`.

### `InlineAddPicker` popover
- Anchored in canvas-space (`anchor: clientToCanvas(...)`).
- Search input at top.
- Catalog: `TRIGGERS` (When tab) from `automationIcons.json.when`, `ACTIONS` (Then tab) from `.then`.
- Featured row: **Decision Diamond** card with description.
- Picker closes on Escape, outside-click, pick, or surface scroll.

---

## 8. Insert paths (where new nodes come from)

Every insert path uses **title-aware horizontal stride**:

```ts
const titleAwareStride = (originTitle, newTitle, gap) => {
  const a = Math.max(NODE_W/2, measureTitleVisualWidth(originTitle)/2)
  const b = Math.max(NODE_W/2, measureTitleVisualWidth(newTitle)/2)
  return a + gap + b
}
```

### 8.1 `insertAfterOrigin(originId, payload)`
- Standard pick from `+` picker.
- New node at `origin.x + titleAwareStride(origin.title, payload.defaultName, PH_GAP)`, same y.
- Adds origin→new edge. Selects new node. Triggers config modal for slugs that require it (`product-is-purchased`, `appointments`, `pipeline-stage-is-moved`).

### 8.2 `insertDecisionDiamondAfter(originId)`
- Same stride pattern with `'Decision Diamond'` as the new title.
- Auto-opens the DD editor.

### 8.3 Locked-pair inserts (see §10)
- `insertGetEmailOptInLockedPair(originId, payload)` — picker variant.
- `dropEmailOptInLockedPair(payload, x, y)` — sidebar-drop variant (freestanding).
- Both delegate to `buildEmailOptInLockedPairCells(payload, hostX, hostY)`.

### 8.4 Sidebar drag-drop (`handleDropCellOnCanvas`)
- Drop coords come in canvas-wrapper pixels → divide by zoom for canvas-space → `clampToCanvas`.
- Locked-pair shortcut: if `payload.type === 'then' && payload.name === 'get-email-opt-in'`, route through `dropEmailOptInLockedPair`.
- Otherwise just build the node from payload and append.

---

## 9. Multi-select

### 9.1 Shift+Click
- Toggles membership in `selectedNodeIds`.
- `selectionAnchorId` adopts the FIRST node clicked when selection was empty; subsequent Shift+Clicks leave the anchor alone.

### 9.2 Shift+Drag marquee
- Pointerdown on empty canvas with `shiftKey` starts a marquee. Document-wide `user-select: none` lock applied during gesture so header/sidebar text doesn't bleed-highlight.
- Marquee rectangle drawn at `pointer-events: none`, `z-index: 5` (above edges, below nodes).
- On pointerup: union all nodes whose tile center falls inside marquee with current selection. Anchor = topmost-leftmost in the union.

### 9.3 Selection toolbar (icon-only, floating above selection)
- Visible when `selectedNodeIds.size >= 2`.
- Anchored to:
  - **Shift+Click selection** → above the FIRST clicked node (`selectionAnchorId`).
  - **Shift+Drag selection** → above the topmost-leftmost node.
- Layout: tile center → toolbar bottom = `TOOLBAR_MARGIN` (8 px) above the node's top edge. `transform: translate(-50%, -100%)`.
- Three icon buttons, each with hover tooltip pill (`#272727` bg, white 12-px text, 8 px above button):
  1. **Duplicate** — `duplicateSelection()` (clones land at `+120/+40` offset; locked pairs duplicate together with a fresh lock entry).
  2. **Tidy up** — `tidyUpSelection()` (see §11).
  3. **Delete** — `deleteSelection()` (red ink; expands locked partners first; cleans configs).
- Status tooltips on selected nodes are **suppressed** when this toolbar is present.

### 9.4 Toast + Undo
- Every multi-select mutation calls `snapshotForUndo(label)` first, captures `{nodes, edges, decisionConfigs, lockedPairs, selectedNodeIds, primarySelectedId}` + a top-left anchor.
- `setToast({ title, body })` renders a DEX-style toast bottom-right with an **Undo** action that calls `undoLastAction()`. Auto-dismisses after 4 s via `useEffect` cleanup.
- One-shot undo (no redo history). The next mutation replaces `lastAction`.

---

## 10. Locked pairs (Get email opt-in)

Auto-spawned dependency: picking Then `get-email-opt-in` produces a **host + partner pair** that always travels together.

### 10.1 Data model
```ts
type LockedPair = { hostId: string; partnerId: string; edgeId: string }
const [lockedPairs, setLockedPairs] = useState<LockedPair[]>([])
```

### 10.2 Pair construction
```ts
function buildEmailOptInLockedPairCells(payload, hostX, hostY) {
  const host = {
    ...buildNodeFromPayload(payload, hostX, hostY),
    title: 'Email Confirmation Request',       // override display
    icon: <IconSvg svg={STACK_LAYERS_SVG} />,
    // underlying slug stays 'get-email-opt-in' for entity mapping
  }
  const partner = {
    id: newId(),
    type: 'trigger',
    title: 'Confirm Email',
    name: 'confirm-email',
    x: hostX + titleAwareStride(host.title, 'Confirm Email', LOCKED_PAIR_GAP),
    y: hostY,
    accent: SUCCESS_GREEN,
    icon: <IconSvg svg={CHECKBOX_SVG} />,
  }
  const edgeHostToPartner = { id: newId(), from: host.id, to: partner.id }
  return { host, partner, edgeHostToPartner }
}
```

### 10.3 Spawn paths
- **Inline picker** → `insertGetEmailOptInLockedPair`: adds origin→host edge + the pair, in one render.
- **Sidebar drop** → `dropEmailOptInLockedPair`: free-standing pair, no incoming edge.

### 10.4 Semantics

| Action | Behavior |
|---|---|
| Move host | Partner translates by same delta |
| Move partner | Host translates by same delta |
| Delete host | Removes both + the lock entry |
| Delete partner | Removes both + the lock entry |
| Duplicate either (multi-select) | Both clone with a fresh `LockedPair` |
| Tidy up half-selection | `expandWithLockedPartners(selection)` adds the missing half before placement |
| Click locked edge | No-op (the connector hit stroke returns early when `lockedPair !== null`) |
| Open editor on partner | Shows toast: *"Confirm Email is automatically created and managed as part of the opt-in flow."* (non-configurable, per `St.configurable === '0'` in the Keap source) |

### 10.5 Lock badge (`LockedEdgeBadge`)
- Rendered at the bezier midpoint of any locked edge.
- White circle r=22, padlock body 16×12, shackle radius 5 (2× the original size).
- Owns hover state — shows a foreignObject pill: *"Locked dependency — Confirm Email is auto-managed."*
- `pointer-events: auto` on the badge group, `cursor: help`.

### 10.6 Extending — registering new locked pairs
The infrastructure is generic. To add another locked dependency:
1. Add a similar `build*LockedPairCells(...)` builder with the pair's display rules.
2. Wire it into the picker's `onPick` (and `handleDropCellOnCanvas` if needed).
3. The rest — `LockedPair` registry, edge rendering, drag-together, delete-together, duplicate-with-pair, tidy expansion, undo snapshotting — already covers it.

---

## 11. Tidy-up algorithm

Goal: lay the selection out cleanly while preserving sequence topology + sibling order.

### 11.1 Component detection
- Build adjacency from sub-edges (only edges with both endpoints in selection).
- DFS to extract connected components.

### 11.2 Per-component placement → `(row, col)`

Linear chain (`every in-deg ≤ 1 && every out-deg ≤ 1`):
- Order via DFS from in-deg=0 roots. Unreachable nodes appended in original-pos order.
- Place at `row=0, col=nextCol+i`.

Branching component:
- Tree-walk from roots (sorted by `y, x`). First child shares parent's row; subsequent siblings claim `maxRowUsed + 1`.
- Cycle remnants get fresh rows.

### 11.3 Side-by-side packing
- Sort components by **average x** (left-to-right preserves the user's mental map).
- `nextCol += maxColRel + tailCols + 1` after each component.

### 11.4 Tail registry (`tailColsByHostId`)
- Inline-add placeholder reserves +1 col on its host (if host is in selection).
- Locked-pair partner reserves +1 col on its host **only if** host is selected but partner is not (the half-select case after `expandWithLockedPartners` already covers most cases).

### 11.5 Per-column max-width packing (the title-aware step)
Instead of a fixed `strideX = NODE_W + PH_GAP`:
```ts
for each col c in placement:
  colWidth[c] = max( NODE_W, max measureTitleVisualWidth(node.title) for nodes in col c )
if placeholder virtual col present:
  colWidth[placeholderCol] = max(colWidth[placeholderCol], PH_W)

colCenterRelX[0] = colWidth[0] / 2
for c in 1..maxCol:
  gap = colsContainLockedPairTransition(c-1, c) ? LOCKED_PAIR_GAP : PH_GAP
  colCenterRelX[c] = colCenterRelX[c-1] + colWidth[c-1]/2 + gap + colWidth[c]/2

blockW = colCenterRelX[maxCol] + colWidth[maxCol]/2
```

- `strideY = NODE_H + PH_GAP` (rows aren't packed by height; titles clamp vertically so this is rare in practice — the hook exists if needed).
- Block is positioned at `(centroidX - blockW/2, centroidY - blockH/2)`.

### 11.6 Auto-focus AFTER tidy (minimal camera move)
Build the bbox of `moved` in canvas-space including title extents:
```ts
halfW         = max(NODE_W/2, measureTitleVisualWidth(node.title)/2)
labelBottom   = NODE_H/2 - NODE_H + LABEL_TOP_OFFSET + LABEL_FONT * 1.2 * 5  // ~233 px
topExtent     = NODE_H/2
bottomExtent  = max(NODE_H/2, labelBottom)
// also include placeholder tail: hostX + NODE_W/2 + PH_GAP + PH_W
```

Then:
1. **Zoom only if needed** — if `zoom*bboxW > availW || zoom*bboxH > availH`, set `newZoom = clamp(min(availW/bboxW, availH/bboxH), 0.25, 2)`. Otherwise keep zoom.
2. **Anchor zoom on bbox center** — if zoom changed, adjust pan so the bbox center stays pinned to the same screen position (no jump).
3. **Minimal pan** — for each axis, if `screenLeft < PADDING` shift right by `PADDING - screenLeft`; if `screenRight > viewW - PADDING` shift left by overflow. Same for Y.
4. **Only commit changes** — `setZoom` only if differs, `setPan` only if differs. A tidy that already fits = no camera motion.

---

## 12. Decision Diamond

Full spec in `HANDOFF-DD-V1.md`. Canvas-side responsibilities:

- Diamond node renders as a rotated tile (`type === 'decision'` branches in node geometry and edge anchors).
- Double-click → `openDecisionEditor(id)`.
- Seeds `decisionConfigs[id]` on first open from outgoing edges (one group per target).
- `reconcileDiamondAfterSave(id)` updates the canvas after Save:
  - `appointments` → fork into N siblings (one per rule) if rules ≥ 2.
  - Otherwise update title + per-edge chips.
  - Forked diamonds share `forkGroupId` so opening any sibling shows the full rule list.

The auto-reconcile effect dissolves an `aggregated`-strategy diamond when it has only one outgoing edge (and re-promotes when it gains a second).

---

## 13. Trigger config modals (per-slug)

Three slugs auto-open a dedicated config modal on insert and re-open via the action menu's *View and edit*:

- `product-is-purchased` → `PurchaseConfig` modal (product picker, payment type, amount).
- `appointments` → `AppointmentGoalConfig` modal (when condition, type).
- `pipeline-stage-is-moved` → `PipelineStageMoveConfig` modal (pipeline, stage, when condition).

State: `xConfigs: Record<nodeId, XConfig>` plus a `xEditorId` for "which is currently open". Draft-based edit:
- Open seeds a working draft.
- Save commits draft → config.
- Close without save discards.

Per-rule entity presets in the Decision Diamond read these (`derivePresetFor(slug, upstreamNodeId, purchaseConfigs, appointmentConfigs)`) to specialize fields (e.g. drop the `Type` row when an appointment trigger already pinned one).

---

## 14. AI assistant scaffolding (DD modal)

Two affordances inside the Decision Diamond editor:

1. **Top prompt** — "Describe your routing" text input + **Generate** button + four quick-pick template chips. Calls `mockAiSeedConditions(prompt, preset)` to seed rules into `decisionConfigs[id].presetRules` with provenance.
2. **Per-rule ✨ button** — opens an inline AI panel anchored to the rule. Same mock seeder, applies to one rule only.

AI-seeded rules show a **purple provenance pill** ("AI") in the rule header to distinguish from user-built rules.

`DDPresetRuleSet` carries `aiPrompt?: string` for round-tripping the AI input.

---

## 15. Bottom toolbar

Three clusters along the bottom of the canvas:

### Left cluster (4 icon buttons, outline variant)
- Keyboard shortcuts
- Notes
- Search on canvas
- Fit to view

### Center pill (zoom)
- Zoom-out icon — `BottomBarIconButton` transparent variant
- `{Math.round(zoom*100)}%` label
- Zoom-in icon — transparent variant

### Right cluster
- "Help & support" pill with blue text + 54 unread badge (red)

### `BottomBarIconButton` styling rule (matters!)
- DEX's `DexIconButton` has too low-contrast hover — replaced with this custom button.
- At rest: white surface, 1px `#E5E7EB` border, subtle shadow, ink `#4A4A4A`.
- On hover: bg `#F1F2F5`, border `#C9CED5`, ink `#0F1724` — clearly readable.
- Tooltip: dark `#272727` pill, white 12-px text, 8 px above on hover, `role="tooltip"`, `z-index: 10`.
- Variants: `outline` (own chrome) and `transparent` (no chrome — used inside the zoom pill so the two zoom buttons read as a segmented control).

---

## 16. Keyboard shortcuts

| Key | Effect |
|---|---|
| **Tab** (hold) | Toggle pan mode (cursor `grab`). Releasing toggles it back. |
| **Escape** | Close picker / menu / open editor; cancel rename; cancel marquee |
| **Shift + Click on canvas node** | Toggle in multi-select |
| **Shift + Drag on empty canvas** | Marquee select |
| **Enter** in rename | Commit (if non-empty and changed) |
| **Shift + Enter** in rename | Newline (rename is a `<textarea>`) |
| **Backspace / Delete** when nodes selected | (Not wired by default — easy to add) |

---

## 17. Rendering order inside the surface (z-stack)

From back to front:
1. SVG edges (`pointer-events: none` on root; per-edge `pointer-events: stroke` on hit strokes)
2. Marquee rectangle (`z-index: 5`)
3. Nodes (`<CanvasNode>`)
4. Inline-add placeholders
5. Picker popover
6. Node action menu (single-node only)
7. Selection toolbar (multi-select)
8. Toast / announce
9. Bottom toolbar (outside the transformed surface — fixed in canvas-wrapper space)

---

## 18. Implementation checklist (rebuild on a new project)

A reasonable build order for a Claude Code session:

1. **Scaffold + tokens** — Tailwind theme + DEX-equivalent CSS variables. Pull the constants in §3 into a shared `canvas-tokens.ts`.
2. **Canvas surface + pan/zoom** — single `canvasWrapperRef` + transformed inner div. `clientToCanvas` helper. Tab-to-pan listener. Bottom toolbar (use the §15 button to avoid the readability bug).
3. **Node tile + edges** — `CanvasNode` with title-wrap + status halo + selection ring. `edgePath` bezier. Hit-stroke + chevron. Hover "+" affordance.
4. **Catalog + picker** — `automationIcons.json`. `InlineAddPicker` popover. `InlineAddPlaceholder` docking to latest open leaf.
5. **Insert paths** — `insertAfterOrigin` + `titleAwareStride`. `insertDecisionDiamondAfter`.
6. **Drag-to-connect** — `beginConnect` + window listeners + snap-to-target.
7. **Multi-select** — Shift+Click toggle, Shift+Drag marquee, selection toolbar with anchored tooltip buttons.
8. **Snapshot + Undo + Toast** — `snapshotForUndo` includes `lockedPairs`. Toast auto-dismiss.
9. **Tidy-up** — components → placement → per-column packing → auto-focus (minimal pan/zoom).
10. **Locked pairs** — `LockedPair` registry, `buildEmailOptInLockedPairCells`, `LockedEdgeBadge`, drag-together, delete-together, duplicate-together, tidy expansion.
11. **Decision Diamond modal** — see `HANDOFF-DD-V1.md`.
12. **Trigger config modals** — purchase / appointments / pipeline (each a draft-based editor with auto-open on insert).
13. **AI scaffolding** — top prompt + per-rule ✨ + provenance pill.
14. **Sidebar drag-drop** — `handleDropCellOnCanvas` with the locked-pair shortcut.

---

## 19. Edge cases worth catching early

- **Title-overlap on adjacent sequences** — must use `measureTitleVisualWidth` in tidy AND insert paths, not `NODE_W` alone.
- **Marquee text bleed** — `document.body.style.userSelect = 'none'` for the duration of the marquee gesture; also `e.preventDefault()` on the pointerdown and `getSelection()?.removeAllRanges()` on start.
- **Pre-amend hook commits** — the locked-pair edge auto-creates on top of any pending `setEdges` update; don't read `edges` from the React closure inside an updater function — pass deltas in a single `setEdges(prev => ...)`.
- **`latestNode` definition** — `nodes[nodes.length - 1]` is the freshest because every insert appends. After auto-spawning a locked pair (host then partner), `partner` becomes the latest open leaf and owns the placeholder. Don't break this invariant.
- **Decision diamond + auto-dissolve** — the reconcile effect dissolves diamonds with only one outgoing edge UNLESS they carry `presetRules` (forked siblings preserve their position). Tag intentionally-staying diamonds with `presetRules`.
- **Zoom-anchored pan jumps** — when you change zoom programmatically (auto-focus or BottomToolbar `+/-`), anchor the rescale around a meaningful point (bbox center, cursor) so the view doesn't pop.
- **Don't recenter on tidy by default** — the user's explicit instruction is *no auto-center*. Only adjust the camera the minimum amount needed to bring out-of-view sequences back in.

---

## 20. Things deliberately NOT in this prototype

- No persistence — `lastAction` is a one-shot undo, no redo.
- No backend / no real validation — `Kn` / `Xn` walkers in the Keap source treat locked pairs as one atomic unit during ready-state checks; this prototype doesn't have a ready-state pass.
- No nested sequences — the Keap funnel editor's `methodLocked` sequence contains internal `start`+`timerDelay` flow items; here the host is a single atomic node.
- No email template editor — the Keap flow auto-opens the email template modal after a locked-pair drop (`shouldAutoOpenModal`); skipped here.
- No real funnel-validator. Ready-state badge is a static prop on the node, not computed.

Skip these for the rebuild unless they're explicitly in scope.
