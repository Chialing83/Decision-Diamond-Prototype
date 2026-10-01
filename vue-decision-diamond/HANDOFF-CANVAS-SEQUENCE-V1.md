# HANDOFF — Canvas Sequence Tile: sizes, positions, hover, click

A focused spec for the **node tile** on the canvas. Everything you need to reproduce a single sequence cell with the right size, the right neighbour spacing, and the exact hover / click visual states.

All coordinates are in **canvas-space** (pre pan/zoom). The tile's `(x, y)` is the **center** of the tile body.

---

## 1. Tile size + anchor

```ts
const NODE_W      = 90    // tile width
const NODE_H      = 90    // tile height
const DIAMOND     = 90    // decision: rotated square of this size
const TILE_RADIUS = 22    // tile border-radius
const ICON_SIZE   = 48    // main icon centered in tile (filled 53% of tile)
```

Tile bounding box in canvas-space:

```
left   = x - NODE_W / 2
top    = y - NODE_H / 2
right  = x + NODE_W / 2
bottom = y + NODE_H / 2
```

- Tile body is **white** (`#FFFFFF`) with `border-radius: 22px`.
- **Drop shadow:** `0 4px 0 rgba(0,0,0,0.5)` — flat, no blur, 4-px Y offset, 50 % opacity.
- Decision nodes rotate the tile body by `45deg scale(0.707)` so the rotated corners stay inside the `NODE_W × NODE_H` bounding box. Icon and label stay un-rotated.
- Icon is centered (`translate(-50%, -50%)`) and tinted with `accent`:
  - **Trigger / When:** `#22A06B` (success green)
  - **Action / Then:** `#2F6FED` (primary blue)
  - **Decision:** `#2F6FED` (primary blue) — also the fallback diamond glyph fill.

### Status bullseye (top-right corner)

```ts
const STATUS_SIZE     = 30
const STATUS_OVERHANG = 8

// position relative to the tile's top-left
left = NODE_W - STATUS_SIZE + STATUS_OVERHANG   // = 68
top  = -STATUS_OVERHANG                          // = -8
```

So the bullseye **overhangs the tile's top-right corner by 8 px on both axes**. SVG `viewBox="0 0 16 16"`: outer circle `r=8` (halo), inner circle `r=4` (dot). Palette:

| status | halo | dot | tooltip text |
|---|---|---|---|
| `setupRequired` | `#FFC8B8` | `#E02500` | Setup required |
| `readyToPublish` | `#FFE8AF` | `#EFBB06` | Ready to publish |
| `published` | `#C8F0C8` | `#36A635` | Published |

---

## 2. Title label (below the tile)

```ts
const LABEL_WIDTH      = 373    // fixed clamp width — long titles wrap inside
const LABEL_TOP_OFFSET = 122    // px BELOW the tile's top edge
const LABEL_FONT       = 26
const LABEL_LINE_H     = 1.2     // CSS line-height
const LABEL_MAX_LINES  = 5
```

Label block style:

```css
position: absolute;
width: 373px;
left:   (NODE_W - LABEL_WIDTH) / 2;     /* = -141.5 — extends past the tile */
top:    LABEL_TOP_OFFSET;                /* = 122 */
text-align: center;
font-size: 26px;
line-height: 1.2;
white-space: normal;
word-break: break-word;
display: -webkit-box;
-webkit-box-orient: vertical;
-webkit-line-clamp: 5;
overflow: hidden;
```

- Color: editable label → `#000`, decision (auto-generated) → `rgba(0,0,0,0.6)`.
- Vertical extent of the label: from `tile-top + 122` down to about `tile-top + 122 + (5 × 26 × 1.2)` ≈ `tile-top + 278`.
- Total visual height of one sequence (tile + label, max) ≈ `NODE_H + 233` = **323 px** in canvas-space.

**Title is click-to-rename** for non-decision nodes:
- `pointer-events: auto` on the label.
- `onPointerDown` stops propagation so it doesn't start a drag.
- `onClick` invokes `onRequestRename`, which swaps the label for a `<textarea>` with the same geometry/font.

### Rename input rules
- Auto-focus + select-all on mount.
- Commit on **Enter** (no Shift) or **blur** (only if non-empty and changed).
- Cancel on **Escape**.
- Newline allowed with **Shift+Enter**.

---

## 3. Spacing between sequences (neighbour positions)

### 3.1 Default gap (`PH_GAP`)

```ts
const PH_GAP = 120   // edge-to-edge whitespace between adjacent tiles
```

Two short-titled tiles sit at **center-to-center = `NODE_W + PH_GAP` = 210 px**.

### 3.2 Locked-pair gap

```ts
const LOCKED_PAIR_GAP = 240   // edge-to-edge between locked-pair members
```

Locked pair (e.g. *Email Confirmation Request* → *Confirm Email*) sit at **center-to-center = `NODE_W + LOCKED_PAIR_GAP` = 330 px** when short titles, or wider per §3.3.

### 3.3 Title-aware stride (required when titles can wrap)

The fixed `NODE_W + GAP` is **wrong** for wide titles like "Email Confirmation Request" — the title block is up to `LABEL_WIDTH = 373` wide and would overlap the neighbour's label. Use title-aware stride at every insert path:

```ts
function titleAwareStride(originTitle, newTitle, gap) {
  const a = Math.max(NODE_W / 2, measureTitleVisualWidth(originTitle) / 2)
  const b = Math.max(NODE_W / 2, measureTitleVisualWidth(newTitle)   / 2)
  return a + gap + b   // center-to-center distance
}
```

`measureTitleVisualWidth(title)` uses a singleton `<canvas>` 2D context, fonts `'26px Tahoma, "Segoe UI", Arial, sans-serif'`, wraps word-by-word at `LABEL_WIDTH`, returns the widest wrapped line, **floor `NODE_W`** and **cap `LABEL_WIDTH`**.

### 3.4 Vertical row stride

Rows (for tidy-up / branching layouts) use:

```ts
strideY = NODE_H + PH_GAP   // = 210 (center-to-center vertical)
```

---

## 4. Inline-add placeholder (the dashed `+` card past the latest open leaf)

Dimensions:

```ts
const PH_W         = 90     // placeholder card width
// height: 90 for 'single' (single + Then), 157 for 'double' (+When over +Then)
const PH_BTN_SIZE  = 38     // inner glyph (just the "+")
const PH_BTN_PAD   = 13     // halo around the glyph; total button = 64×64
const PH_BTN_GAP   = 3      // vertical gap between the two halo buttons
```

Position relative to the latest open leaf:

```
phCenterX = leaf.x + NODE_W / 2 + PH_GAP + PH_W / 2
phCenterY = leaf.y
```

Single variant (trigger origin) → one `+ Then` button (blue glyph).
Double variant (action/decision origin) → stacked `+ When` (green) over `+ Then` (blue).

---

## 5. Hover state — node tile

State variables inside `CanvasNode`:

```ts
const [hovered, setHovered] = useState(false)        // tile body + hover bridge + "+" share this
const [hoverAddTooltip, setHoverAddTooltip] = useState(false)  // ONLY when cursor is on the "+" button
const hoverCountRef = useRef(0)                       // counts enters/leaves across the three zones
```

Three hover zones share one counter so cursor movement between them doesn't flicker `hovered → false → true`:
1. The tile body itself
2. An invisible **hover bridge** spanning the 8-px gap between the tile's right edge and the "+" button
3. The "+" button

`onAreaEnter`: `hoverCountRef.current += 1; if (count === 1) setHovered(true)`
`onAreaLeave`: `hoverCountRef.current -= 1; if (count === 0) setHovered(false)`

### What changes on hover

| Element | Default | Hovered |
|---|---|---|
| Tile body | `box-shadow: 0 4px 0 rgba(0,0,0,0.5)` | Same shadow — **no fill or shadow change on hover**. Tile chrome is steady. |
| Cursor | `grab` (or `grabbing` while dragging) | `grab` |
| Status tooltip (40 px above tile) | `opacity: 0`, `pointer-events: none` | `opacity: 1` after a 120 ms ease — IF not dragging, no "+" tooltip showing, not in multi-selection |
| Hover "+" button (right side) | `opacity: 0`, `pointer-events: none` | `opacity: 1` after 120 ms — only when `showHoverAdd` (suppressed on the latest open leaf, which already owns the inline-add placeholder) |
| Hover bridge | `opacity: 0`, `pointer-events: none` | `opacity: 1`, `pointer-events: auto` |
| `+` glyph tooltip | hidden | shows **"Drag to connect or click to add"** only when `hoverAddTooltip` is true |

### Status tooltip styling

```
position:    absolute, left: 50%, top: -75 (TOOLTIP_TOP_OFFSET), translateX(-50%)
background:  #2C2C2C
color:       #FFFFFF
font:        24 px Proxima Nova
padding:     18 px 28 px
border-radius: 18
white-space: nowrap
opacity transitions on hover (~120 ms)
```

### Hover "+" button geometry

```
left:   NODE_W + 8                       // 8-px gap past the tile's right edge
top:    (NODE_H - HOVER_ADD_SIZE) / 2    // vertically centered against tile
width:  HOVER_ADD_SIZE = 64
height: HOVER_ADD_SIZE = 64
```

Glyph: black `+` on `rgba(0,0,0,0.09)` circle background. Two gestures:
- **Click (no drag)** → opens `InlineAddPicker` at cursor.
- **Drag past 3 px** → starts drag-to-connect with origin pinned to the button's center in canvas-space.

The "+" is **suppressed on the latest open leaf** (`showHoverAdd = false`) because that node already owns the inline-add placeholder — two affordances in the same slot would fight.

### Status tooltip suppression
The tooltip is **hidden** when any of these are true:
- `dragging` is in progress
- `hoverAddTooltip` is true (the "+" tooltip already occupies the slot above the tile)
- `inMultiSelection` (the multi-select toolbar anchors to the same slot)

---

## 6. Click / selection state

State at parent level:

```ts
const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
const [primarySelectedId, setPrimarySelectedId] = useState<string | null>(null)
const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null)
const [connecting, setConnecting] = useState<...>()
```

### Click semantics

| Gesture | Result |
|---|---|
| **Plain click** (no Shift, no drag) | `selectedNodeIds = {n.id}`, `primarySelectedId = n.id`, `selectionAnchorId = n.id`, close menu, deselect any edge. After ~120 ms (no drag detected), open `NodeActionMenu` anchored at cursor. |
| **Shift + Click** | Toggle `n.id` in `selectedNodeIds`. `selectionAnchorId` adopts this node IFF no anchor was set yet (selection was empty). |
| **Double-click** | Open detailed editor (`openDecisionEditor` for decision, slug-specific modal for known triggers, "non-configurable" announce for locked partners, placeholder announce otherwise). |
| **Drag tile body** | Move node (`onMove(node.id, x, y)`). Locked-pair partner travels by same delta. While dragging, suppress selection commit on pointerup. |
| **Drag right of tile** (the hover "+") past 3 px | Begin `connecting` gesture — live bezier preview from button center to cursor, snap-to-target node within hit radius. |

### Visual treatment when selected

A 6-px purple ring sits **outside** the tile's rounded rectangle, rendered as a non-inset box-shadow so it composes with the tile drop-shadow:

```ts
const SELECTION_RING = 6
const SELECT_ACCENT  = '#8358F1'

const tileShadow = '0 4px 0 rgba(0,0,0,0.5)'
const ringColor  = connectTarget ? '#000000'
                : selected        ? SELECT_ACCENT
                                  : 'transparent'
const selectionRing = `, 0 0 0 ${SELECTION_RING}px ${ringColor}`
boxShadow = tileShadow + selectionRing
```

Important: the ring is **reserved (transparent)** even when not selected so toggling never reflows layout — only the color changes.

### Drop-target focus (during drag-to-connect)

While `connecting !== null` and the cursor is over a valid target node:
- That node's `connectTarget` prop becomes `true`.
- Its ring color flips to **`#000000`** (black), which **takes precedence over the purple selection ring** so the user can see exactly which node a release would connect to even if it's already selected.

### Click on canvas background (deselect)

A pointerdown that lands on the canvas wrapper, but NOT on a node or edge, clears selection:
- `setSelectedNodeIds(new Set())`
- `setPrimarySelectedId(null)`
- `setSelectionAnchorId(null)`
- `setSelectedEdgeId(null)`
- `setMenuAnchor(null)`

Unless **Shift+pointerdown** — then a marquee gesture starts instead.

### Single-node action menu

When `selectedNodeIds.size === 1` AND a plain click happened (no drag), a `NodeActionMenu` opens at the cursor anchor in canvas-space. Items per node type:

- Action / trigger: `View and edit`, `Settings`, `Duplicate`, `Rename`, `Delete`
- Decision diamond: `View and edit`, `Settings`, `Delete` (no rename / duplicate)
- Locked-pair partner: `View and edit` short-circuits to a "non-configurable" toast; delete cascades to both halves.

The menu is **suppressed when `selectedNodeIds.size > 1`** — multi-select uses the floating toolbar above the anchor node instead.

---

## 7. Multi-select visual (≥ 2 selected)

When `selectedNodeIds.size >= 2`:
1. **Per-node selection rings** stay on for every selected node (same 6-px purple).
2. **Status tooltip** is suppressed on all selected nodes.
3. **Action menu** is closed.
4. A **floating toolbar** appears anchored above the anchor node:
   - `selectionAnchorId` if user is in **Shift+Click** mode → first-clicked node
   - Topmost-leftmost selected node if the selection came from a **Shift+Drag marquee**
5. Toolbar layout:
   ```
   transform: translate(-50%, -100%)
   bottom-of-toolbar = top-of-anchor-node - TOOLBAR_MARGIN
   TOOLBAR_MARGIN = 8
   ```
6. Three icon buttons: **Duplicate · Tidy up · Delete**. Each has its own hover tooltip (dark `#272727` pill, white 12-px text, 8 px above button).

---

## 8. Drag-to-connect — visual feedback

| State | Visual |
|---|---|
| Idle | Hover "+" visible on hover; no preview. |
| Dragging, no target locked | Black bezier line from button center to cursor; **no chevron** (the tail is the cursor itself). |
| Dragging, hovering a valid target | Same black line, **plus a chevron** snapping to the target's left anchor; the target's selection ring turns black (`connectTarget = true`). |
| Release on target | Commit edge `from = originId`, `to = targetId`. |
| Release in empty space | Discard. |

The preview SVG is owned by the parent (not the node), so it draws on top of every node.

---

## 9. Z-order summary (back → front)

```
1. SVG edges (lock badge layer on top of any locked edges)
2. Open-leaf dashed connector to the inline-add placeholder
3. Live drag-to-connect preview
4. Marquee rectangle (z-index: 5)
5. Nodes (CanvasNode)
6. Inline-add placeholders
7. InlineAddPicker popover
8. NodeActionMenu (single-node only)
9. Selection toolbar (multi-select)
10. Toasts / announce
11. Bottom toolbar (outside the transformed surface)
```

---

## 10. Reference: complete numeric table

| Token | Value | What it controls |
|---|---|---|
| `NODE_W` | 90 | Tile width |
| `NODE_H` | 90 | Tile height |
| `DIAMOND` | 90 | Decision rotated-square size |
| `TILE_RADIUS` | 22 | Tile border-radius |
| `ICON_SIZE` | 48 | Main icon size |
| `STATUS_SIZE` | 30 | Bullseye SVG box |
| `STATUS_OVERHANG` | 8 | Bullseye overhang past tile corner |
| `LABEL_WIDTH` | 373 | Title block width |
| `LABEL_TOP_OFFSET` | 122 | Title block top, relative to tile top |
| `LABEL_FONT` | 26 | Title font-size |
| Label line-height | 1.2 | Wrap line height |
| Label max lines | 5 | Title clamp |
| `TOOLTIP_TOP_OFFSET` | -75 | Status tooltip top |
| `TOOLTIP_FONT` | 24 | Status tooltip font-size |
| `HOVER_ADD_SIZE` | 64 | Hover "+" button hit area |
| Hover "+" gap from tile | 8 | px between tile right and "+" left |
| `PH_GAP` | 120 | Default edge-to-edge gap |
| `LOCKED_PAIR_GAP` | 240 | Locked-pair edge-to-edge gap |
| `PH_W` | 90 | Placeholder card width |
| `PH_BTN_SIZE` | 38 | Placeholder inner glyph |
| `PH_BTN_PAD` | 13 | Placeholder halo |
| `PH_BTN_GAP` | 3 | Placeholder stacked-button gap |
| `SELECTION_RING` | 6 | Selection ring thickness |
| `SELECT_ACCENT` | `#8358F1` | Selection ring color |
| `connectTarget` ring | `#000000` | Drop-target ring color |
| Tile drop shadow | `0 4px 0 rgba(0,0,0,0.5)` | Flat shadow, no blur |
| Tile fill | `#FFFFFF` | — |
| Trigger accent | `#22A06B` | When green |
| Action accent | `#2F6FED` | Then blue |
| Tooltip background | `#2C2C2C` | Dark pill |
| `TOOLBAR_MARGIN` | 8 | Multi-select toolbar gap above anchor |

---

## 11. Visual checklist when rebuilding

- [ ] Tile is `90 × 90` white card with `border-radius: 22` and the flat `0 4px 0 rgba(0,0,0,0.5)` shadow.
- [ ] Icon is exactly `48 × 48`, centered, tinted by `accent`.
- [ ] Status bullseye is `30 × 30` SVG, overhanging top-right corner by 8 px each side.
- [ ] Title is `373` px wide, `26` px font, max 5 lines, centered horizontally on the tile (block extends past the tile by `~141.5` px each side because `(90 - 373)/2 = -141.5`).
- [ ] Selection toggles a `6 px` purple ring (`#8358F1`) on the box-shadow without reflowing.
- [ ] Drop-target ring is black (`#000000`) during drag-to-connect, and **takes precedence** over the purple selection ring.
- [ ] Hover state shows status tooltip + hover "+" + bridge; uses a shared 3-zone enter/leave counter so cursor transit between them never flickers.
- [ ] Inline-add placeholder docks at `leaf.x + NODE_W/2 + PH_GAP + PH_W/2` on the leaf's row.
- [ ] All insert paths (picker + sidebar drop + locked pair) use `titleAwareStride` so wide titles don't overlap neighbours.
- [ ] Locked pair edge-to-edge gap is `LOCKED_PAIR_GAP = 240` (not `PH_GAP`).
- [ ] When a multi-selection is active, status tooltips are suppressed and the toolbar takes the slot above the anchor node with `TOOLBAR_MARGIN = 8` px clearance.

This is the visual contract — once these are right, the rest of the canvas (tidy-up, locked pairs, AI, modals) plugs in cleanly per `HANDOFF-CANVAS-V1.md`.
