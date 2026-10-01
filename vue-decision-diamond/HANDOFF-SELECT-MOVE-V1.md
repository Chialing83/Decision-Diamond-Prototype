# HANDOFF — Funnel Editor Select & Move (Single + Multi)

A behavioral and visual spec for selection and movement on the Konva-based funnel canvas, derived from live inspection of the production editor. Pairs with the connector spec and with `HANDOFF-CANVAS-V1.md` / `HANDOFF-CANVAS-SEQUENCE-V1.md`.

This document is the contract for re-implementing select + move on a fresh canvas (Konva or any 2-D scenegraph) — the production behaviors that work, the one notable gap to fix, and the standard improvements worth adding during the rebuild.

---

## 1. Anatomy of a Node

Every selectable / movable thing on the canvas is a `Konva.Group` carrying these attributes verbatim:

```js
{
  "data-qa":   "cell-group",
  "data-type": "cell-group",
  draggable:   true,
  listening:   true,
  x, y,
}
```

The group has four children in the typical case:
1. An inner artwork `Group` (Image + status dot `Rect`)
2. A `Text` label below the icon
3. One or two `Label` shapes for floating badges ("Unpublished changes", branch tags like "Yes" / "No", etc.)
4. The selection `Rect` (inserted as the **first** child when selected; absent otherwise)

Each group is wired with these listeners:
`contextmenu`, `mouseenter`, `mouseleave`, `dragstart`, `dragmove`, `dragend`, `dblclick`, `mousedown`, `touchstart`

Stage-level listeners do the heavy lifting:
`wheel`, `click`, `contextmenu`, `mousedown`, `mousemove`, `mouseup`, `dragend`, `dragmove`, `touchstart`

The stage itself is `draggable: true` with `dragDistance: 3` — that's how **panning** works (see §7).

---

## 2. Selection Visual — exact specification

Selection is rendered as an inserted `Konva.Rect` placed as the **first child** of the cell-group, sized to wrap the node icon (48 × 48 canvas units, matching the icon footprint). The editor does **not** use a Konva.Transformer anywhere.

```js
{
  cornerRadius: 12,
  width: 48, height: 48,
  stroke: '#8358f1',          // brand purple
  strokeWidth: 3,
  fill: '#fff',                // primary selected
  shadowColor: 'black',
  shadowOffsetX: 0, shadowOffsetY: 2,
  shadowOpacity: 0.5,
  perfectDrawEnabled: false,
  shadowForStrokeEnabled: false,
}
```

### Two visual variants observed

| Variant | When | Visual |
|---|---|---|
| **Active selection** | Most cases, including shift+click multi-select | `fill: '#fff'` — icon is masked behind a white card with purple border + soft drop shadow |
| **Secondary / inactive selection** | Editor reopened with a previously persisted multi-selection | `fill: 'transparent'` — purple ring only, no white card |

**Implementation choice:** when **persisting** multi-selection across save/reload, render non-primary members with `fill: 'transparent'`. For **interactive** multi-select within a session, use `fill: '#fff'` for all.

The selection `Rect`'s z-position inside the cell-group is **below** the icon `Image` so the icon paints over the white fill. The 3-px stroke extends outward (Konva default), giving the visible purple ring.

---

## 3. Single Select

**Trigger:** left click anywhere inside the cell-group's hit area (Konva.Group hit-test is the union of its Image + Label children).

**Behavior on click:**
1. Clear any existing selection set.
2. Add this group to the selection set.
3. Insert/show the selection `Rect` inside the group with `fill: '#fff'`.
4. Open the inline context popover anchored just to the right of the node, containing rows:
   - **View and edit**
   - **Settings**
   - **Duplicate**
   - **Rename**
   - **Delete**
   - A status toggle **Ready ⇄ Draft**
5. The popover is a Vue/HTML element layered above the canvas — positioned via the node's screen-space client rect.
6. Show the **"Unpublished changes"** tooltip above the node if the node has dirty state (driven by per-node dirty flag, not a global one).

**On hover (`mouseenter`):**
- Show a circular **"+"** affordance to the right of the selected node (the connector-insertion glyph; see connector spec §6). Hides on `mouseleave`.

**Click outside any node (empty canvas):** clears selection AND closes the popover.

**`Escape`:** does **not** close the popover in the inspected editor. **Fix in rebuild** — implement Escape close. It's expected UX and a clear improvement.

---

## 4. Single Move (drag)

`dragstart` triggers on `mousedown` then movement past Konva's `dragDistance: 3`. Anything below 3 px of motion before `mouseup` is treated as a click. This is exactly why a fast viewport drag with no real pixel travel was interpreted as a click in testing.

### Behavior

**`dragstart`:**
- Keep the selection halo on the node (it moves with the group).
- Suppress the context popover for the duration of the drag.

**`dragmove`:**
- The cell-group's `(x, y)` updates continuously.
- Connectors **re-route live:** every connector whose source or target is this node recomputes its points (per the bezier formula from the connector spec, §3) on each frame; `layer.batchDraw()` is called.
- Other connectors are untouched.
- **No grid snap during drag** — the node tracks the cursor smoothly.

**`dragend`:**
- The cell-group's `(x, y)` is **snapped to the 48-pixel sub-grid** (all 32 inspected cells have `x % 48 === 0 && y % 48 === 0`).
- Note: the layout-row pitch is **96** but snapping is at the finer **48** resolution to allow half-row drops.
- After snap, the connectors recompute one more time against the snapped coordinate.
- The popover does **not** reopen automatically; selection is preserved but the popover stays closed until the next explicit click on the node.

### Snap pseudocode

```js
group.on('dragend', () => {
  const snap = 48
  group.x(Math.round(group.x() / snap) * snap)
  group.y(Math.round(group.y() / snap) * snap)
  recomputeConnectorsFor(group.id())
  layer.batchDraw()
  emit('node:moved', { id, x: group.x(), y: group.y() })
})
```

### Drag bounds

The drag is **not bounded** (`dragBoundFunc` is unset): nodes can be moved to negative canvas coordinates (e.g. one cell in the inspected graph sits at `y: -96`). If the project requires a positive bounding box, attach a `dragBoundFunc` returning a clamped position.

---

## 5. Multi Select

Two mechanisms tested:

### 5.1 Shift+click — **works**

Click a node, then shift+click another. Both nodes show selection halos (`fill: '#fff'`, purple ring on both). **No popover** is shown for the multi-selection (the popover only appears on the most recent single-select; subsequent shift+clicks dismiss it).

**Toggle semantics:** shift+click on an already-selected node should **remove it** (standard pattern). The inspected app's selection set is independent of the popover, so re-implement with:

```js
if (set.has(id)) set.delete(id)
else            set.add(id)
```

### 5.2 Rubber-band / marquee — **NOT supported**

A `mousedown → drag` on empty canvas pans the entire stage (`stage.draggable = true`). There is no marquee rectangle, no banded selection visual, no post-drag selection.

**To add marquee in the rebuild:**
1. Disable `stage.draggable`, **OR**
2. Only trigger panning when a modifier is held (e.g. Space-hold or middle-mouse), and add a custom marquee drawn into the top layer:

```js
new Konva.Rect({
  stroke: '#8358f1',
  dash:   [4, 4],
  fill:   'rgba(131, 88, 241, 0.08)',
})
```

The marquee intersects-tests cell-group client rects on `mouseup`.

### 5.3 Cmd/Ctrl + A — **NOT bound**

Select All is not bound in the inspected editor. **Add it in the rebuild** as a quality-of-life win.

---

## 6. Multi Move (drag multiple) — **PRODUCT GAP, fix in rebuild**

### Observed behavior

Multi-move is **NOT supported**. With two Sequence nodes selected via shift+click, dragging one of them moves only that one; the other remains in place. The selection halos persist on both, but the drag is per-node.

This is almost certainly a **product gap** rather than a deliberate design choice.

### Desired behavior (rebuild target)

**`dragstart` of any node in the selection set:**
1. Capture every selected node's initial `(x0_i, y0_i)`.
2. Capture the dragged node's initial `(x0_drag, y0_drag)`.

**`dragmove`:**
1. Compute `(dx, dy) = (drag.x() - x0_drag, drag.y() - y0_drag)`.
2. For each **other** selected node, set `node.x(x0_i + dx); node.y(y0_i + dy)` **without firing their own drag events** — use `node.setAttrs(...)` directly, not `startDrag`.
3. Recompute connectors for ALL nodes in the selection.
4. `layer.batchDraw()`.

**`dragend`:**
1. Snap the dragged node to the 48-grid.
2. Recompute `(dx, dy)` as the **snapped delta**, and apply to every other selected node.
3. Recompute connectors a final time.
4. Emit `nodes:moved` with array of `{id, x, y}`.

### Konva tip

Avoid calling `node.startDrag()` on the siblings — Konva supports only one active drag at a time and it will fight your synthetic events. **Use raw attr writes instead.**

---

## 7. Panning & Zoom Interaction

**Panning:** `stage.draggable: true` — empty-canvas drag pans the stage.

**Zoom:** presumably via the `− / +` controls in the bottom toolbar (the 50 % indicator suggests the inspected graph was rendered at 50 % — though the live Konva stage reported `scale: 1`, so the displayed "50%" is a CSS-driven container scale (`cssScaleX ≈ 1.0`, which doesn't reconcile with the toolbar number — likely the toolbar displays a saved-zoom value that hasn't been applied yet, or zoom is implemented purely on `stage.scale()`).

### Rebuild: clean zoom

Implement zoom by mutating `stage.scaleX / scaleY` symmetrically and adjusting `stage.position` to zoom around the cursor. The wheel-event handler is already attached at stage level.

- Clamp zoom **25 % – 200 %**.
- While the stage is being panned, suppress all hover affordances (the connector "+" icons, the per-node "+" hover) until `dragend` to prevent flicker.

---

## 8. Keyboard

### Required bindings

| Key | Action |
|---|---|
| **Escape** | Deselect all, close popover **(FIX: today it does not close the popover)** |
| **Delete / Backspace** | Delete each selected node (with confirm modal listing affected connectors) |
| **Cmd/Ctrl + A** | Select all cell-groups **(NEW)** |
| **Arrow keys** | Nudge selection by 48 in that direction **(NEW)** |
| **Shift + Arrow** | Nudge by 96 (one full grid cell) |
| **Cmd/Ctrl + D** | Duplicate selected nodes 96 px down-right |
| **Cmd/Ctrl + Z / Shift + Z** | Undo / redo (currently not bound; inspected editor ignored Cmd+Z) |

---

## 9. Event API for the Rebuild

```ts
type NodeId = string

interface SelectionAPI {
  set(ids: NodeId[]): void          // replace
  add(id: NodeId): void
  remove(id: NodeId): void
  toggle(id: NodeId): void          // for shift+click
  clear(): void
  primary(): NodeId | null          // most-recently-added
  all(): NodeId[]
  on(event: 'change', cb: (ids: NodeId[]) => void): void
}

interface DragAPI {
  on(
    event: 'dragstart' | 'dragmove' | 'dragend',
    cb: (payload: { ids: NodeId[]; dx: number; dy: number; snapped?: boolean }) => void,
  ): void
}

interface PopoverAPI {
  open(id: NodeId, anchorRect: DOMRect): void
  close(): void
  // emits 'view' | 'settings' | 'duplicate' | 'rename' | 'delete' | 'toggleReady'
}
```

- `SelectionAPI` owns the canonical set.
- `DragAPI` is invoked from the group's Konva listeners.
- `PopoverAPI` is the Vue/React HTML overlay; it must reposition on `dragmove` and `wheel` (zoom) so it stays anchored if the popover is left open during a move (or simply close it on drag, which is what the inspected app does).

---

## 10. Z-Order & Hit Test

Per-layer painting order (bottom → top):
1. **Connectors**
2. **Cell-groups**
3. **Floating overlays** (status dots, "Unpublished changes" tag)
4. **Marquee rect** (when multi-marquee implemented)

The selection `Rect` is **inside the cell-group below the icon Image**. The "+" hover affordance is on the connector layer (anchored to the connector endpoint), **not** on the cell-group.

`hitStrokeWidth` is **not used** on cell-groups — Konva's default group hit-test (union of children) is enough because the rounded card icon is 48 × 48 and visually crisp. No need to enlarge.

---

## 11. Acceptance Tests

A reviewer should be able to verify:

1. **Single click** on a node draws a `#8358f1` purple ring (3 px) with `cornerRadius: 12`, white fill, soft drop shadow, AND opens the popover with the 5 actions + Ready toggle.
2. **Click on empty canvas** clears selection and closes the popover.
3. **Drag a single selected node:** connectors update live, no snap during drag, snap to 48-px grid on `dragend`, popover stays closed afterward.
4. **Shift+click** adds a second node to the selection set; both render with `fill: '#fff'` purple rings; popover is dismissed.
5. **Drag any node in a multi-selection:** ALL selected nodes translate by the same `(dx, dy)`; their connectors all update live; all snap to the 48-grid on `dragend` simultaneously.
6. **Drag on empty canvas** pans the stage; cursor changes to `grabbing`. (Optional improvement: only pan with Space-hold or middle-mouse, leaving left-drag for marquee.)
7. **Delete on a multi-selection** prompts confirmation and removes all selected nodes plus their connectors.

---

## 12. File Layout Suggestion

```
src/funnel/
  selection/
    SelectionStore.ts       // set/add/remove/toggle, emits 'change'
    SelectionHalo.ts        // Konva.Rect factory + attach/detach
    NodePopover.vue         // anchored HTML overlay
  drag/
    DragController.ts       // single + multi drag, snap, connector recompute
    snap.ts                 // export const NODE_SNAP = 48
  stage/
    PanZoom.ts              // wheel + stage.draggable management
    Marquee.ts              // optional rubber-band layer
  keymap.ts                 // §8 bindings
```

---

## 13. Gaps and Improvements summary

| # | Item | Status in production | Fix in rebuild |
|---|---|---|---|
| 1 | Escape closes popover | ❌ no | ✅ yes |
| 2 | Marquee (rubber-band) multi-select | ❌ no | ✅ optional but recommended; gate stage panning behind Space/middle-mouse |
| 3 | Cmd/Ctrl + A | ❌ no | ✅ yes |
| 4 | Multi-drag (drag any selected → all move) | ❌ no | ✅ **highest-value gap to fix** |
| 5 | Arrow-key nudge | ❌ no | ✅ yes (48-px step; Shift = 96) |
| 6 | Cmd/Ctrl + Z undo | ❌ no | ✅ yes |
| 7 | dragBoundFunc / positive-only canvas | ❌ no | ⚠️ project-dependent |
| 8 | Zoom around cursor with 25–200 % clamp | ⚠️ inconsistent | ✅ yes |

---

That's the complete behavioral, visual, and architectural contract for **selecting and moving sequences** on the canvas — single and multiple — including the one notable bug-or-gap to fix (multi-drag) and the standard improvements (Escape closes popover, marquee selection, Cmd+A, arrow-nudge, Cmd+Z).

Pair this with `HANDOFF-CANVAS-V1.md` (full canvas architecture), `HANDOFF-CANVAS-SEQUENCE-V1.md` (tile sizes / hover / click visuals), and `HANDOFF-DD-V1.md` (Decision Diamond modal) for a complete rebuild package.
