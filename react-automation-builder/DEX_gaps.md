# Dex Component Gaps & Deferred Migrations

Running log of known gaps in `@thryvlabs/dex-react` that blocked or complicated
migration, plus pieces intentionally deferred because they're higher-risk. Fetch
this when resuming migration work.

---

## Load-bearing

- **`src/main.tsx:3`** — `import './dex-require-shim'` MUST remain the first line.
  Removing/reordering it breaks every dex import at runtime.

---

## Deferred migrations (high-risk, need follow-up)

### Overlays
- **`src/components/pipeline/DealModal.tsx:50`** — custom modal → `DexModal` +
  `DexModalContent` / `DexModalHeading` / `DexModalBody` / `DexModalFooter`.
  Risk: currently route-driven (`useNavigate` to close). Need to wire
  `open`/`onOpenChange` to route state without double-firing navigation on
  backdrop click + Escape.
- **`src/components/contacts/ContactPanel.tsx:72`** — right-pane → `DexDrawer`
  (`DexDrawerContent` / `DexDrawerBody` / `DexDrawerHeading`). Risk: today it's
  a side-by-side pane inside a CSS grid/flex, not an overlay. Swapping to
  DexDrawer changes stacking (portal-based), focus trapping, and close-on-ESC
  behavior. Non-trivial visual diff.
- **`src/components/layout/Sidebar.tsx:168`** — optional: secondary nav panel
  → `DexDrawer`. Only worthwhile if we want the nav to overlay content instead
  of displacing it.

### Layout primitives
- `DexBox` has no `display`, `flex-direction`, `height`, `width`, `background`,
  or `overflow` props — only padding via the spacing scale (`'0'`, `'025'`,
  `'050'`, `'075'`, `'100'`, `'125'`, `'150'`, `'200'`, `'250'`, `'300'`,
  `'400'`, `'500'`, `'600'`, `'700'`, `'800'`). For page shells that need
  `display:flex; flex-direction:column; height:100vh; overflow:hidden`, we
  fall back to inline `style`, which undercuts the token benefit.
- `DexStack` is **column-only**. There is no `direction="row"`. For horizontal
  layouts use `DexInline` (separate component). The original plan listed
  "AppShell → DexStack (horizontal)" — implemented as DexInline.
- Page padding values in this app (`28px 40px 0`, `20px 40px 40px`, `14px 24px
  0`) don't cleanly map to the spacing scale tokens. Kept as inline `style` on
  `DexBox`.

### Tables
- `DexTableCell` and `DexTableHeaderCell` do **not** accept a `colSpan` prop.
  Empty-state rows with `colSpan={N}` must stay as native `<tr>/<td>` (see
  `src/pages/Automation.tsx` empty state). Worth filing upstream.
- `width` on `DexTable*Cell` must be a **string** (`"160px"`), not a number.
  Numbers fail `TS2322`.
- `DexTableCell` does not accept arbitrary text `color` style shortcuts — wrap
  content in a `<span style={{ color }}>…</span>`. (Previously seen in
  `AdvancedAutomationRow`'s `unpublished` case; that component and
  `AutomationRow` were removed in the Addendum F refactor — the automations
  list now uses the Tailwind-first `DataTable` + `StatusBadge` primitives.)

### Tags
- `DexTag` accent colors: `blue, navy, green, red, orange, yellow, gray, aqua,
  emerald, purple, pink, beige, forest`. Semantic colors: `primary, secondary,
  danger, warning, success, neutral`. `'gray'` is accent-only — semantic is
  `'neutral'`.

---

## Token-only items (advisory — no component swap)

Carry these forward when touching affected files; not worth dedicated passes.

- **Button hover filter**: inline `filter: brightness(...)` → drop in favor of
  `DexButton` variants (solid/outline/transparent handle hover internally).
- **Custom badge hex colors**: `#E02500`, `#1C831E`, `#9CA3AF` → map to
  `--ds-*` tokens (or use `DexStatus`/`DexTag` semantic variants).
- **Inline `fontSize` / `fontWeight`** across pages → `DexText` variants.
- **Plain `<hr>` or 1px-border separator divs** → `DexDivider`. (Note: current
  codebase has **zero** `<hr>` tags; the 1px borders are mostly on table rows
  and headers which are now owned by `DexTable*`.)

---

## Completed (phase 3)

- Logos: `KeapLogo` → `DexKeapLogo`.
- Avatars: PrimaryNav, ContactPanel, ContactRow, MessageRow, DealCard →
  `DexAvatar`.
- Tags / status: Sidebar badges + Beta, MessageRow unread dot, Automation rows
  on/off, ContactPanel tag chips, Pipeline filter chip → `DexTag` /
  `DexStatus`.
- Cards / progress: StatCard → `DexCard` + `DexCardTitle`; KanbanColumn
  progress → `DexProgress`.
- Tables: Marketing (`<table>`, `<tr>/<td>`) and Automation (both Easy +
  Advanced rows, page shell) → `DexTable` family.
- Links: KanbanColumn "Add a deal" → `DexLink`.
