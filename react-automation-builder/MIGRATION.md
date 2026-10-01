# UI Primitives Migration

New Tailwind-first primitives live under `src/components/ui/`. They are
additive — the existing `@thryvlabs/dex-react` components are untouched and
continue to power most of the app. Use the new primitives for new dashboard
work and greenfield pages.

Gallery: `/dev/ui` (standalone route, no AppShell).

---

## Stack notes

- **Tailwind v4**. Tokens live in `src/index.css` inside an `@theme { ... }`
  block — there is no v3-style `tailwind.config.js`. The `@tailwindcss/forms`
  plugin is loaded via `@plugin "@tailwindcss/forms";` in the same file.
- **Utilities**: `cn(...)` in `src/components/ui/cn.ts` wraps `clsx` +
  `tailwind-merge`. Use it for conditional classes so later classes win
  conflicts.
- **Icons**: `lucide-react`. Always size icons explicitly (`h-4 w-4`) and mark
  decorative icons `aria-hidden="true"`.

## Design tokens (new)

| Token                  | CSS custom property                 | Tailwind class example           |
| ---------------------- | ----------------------------------- | -------------------------------- |
| Surface / canvas       | `--color-surface`, `--color-canvas` | `bg-surface`, `bg-canvas`        |
| Borders                | `--color-border(-strong)`           | `border-border`, `border-border-strong` |
| Text                   | `--color-ink(-muted|-soft)`         | `text-ink`, `text-ink-muted`     |
| Brand / accent         | `--color-brand`, `--color-accent`   | `bg-brand`, `text-accent`        |
| Status                 | `--color-danger`, `--color-success` | `text-danger`, `bg-success`      |
| Radii                  | `--radius-card|btn|pill`            | `rounded-card`, `rounded-btn`, `rounded-pill` |
| Shadows                | `--shadow-card(-hover|-focus)`      | `shadow-card`, `shadow-card-hover`, `shadow-focus` |
| Font                   | `--font-sans`                       | `font-sans` (already on `body`)  |
| Metric type            | `--text-metric`                     | `text-metric`                    |
| Card padding / gutter  | `--spacing-card`, `--spacing-gutter`| `p-card`, `gap-gutter`           |

## Components

- `Card` — compound: `Card`, `Card.Header`, `Card.Meta`, `Card.Body`,
  `Card.Footer`. Variants: `kpi | list | empty | progress` (declarative;
  controls skeleton shape and `data-variant`, not the frame). Pass
  `loading` for a skeleton.
- `Button` — variants `primary | secondary | ghost | danger`; sizes
  `sm | md | lg`; props `loading`, `leftIcon`, `rightIcon`, `fullWidth`.
- `IconButton` — required `aria-label`. Sizes `sm` (32px, grows to 44px
  touch target on `sm:` breakpoint) / `md` (40px). Supports the same variants
  as `Button` plus `default`.
- `KebabMenu` — overflow menu built on `IconButton` + a lightweight
  outside-click/Escape handler (no Radix or Headless UI dependency).
- `DashboardGrid` — page wrapper: `max-w-[1440px]`, fluid padding, 12-col
  grid with `gap-gutter`.
- `GridItem` — responsive `span` via a static class lookup so Tailwind's
  scanner detects every class. **Do not** string-concatenate spans.

## Before / after cheatsheet

| Before (inline / hex)                      | After (Tailwind token)             |
| ------------------------------------------ | ---------------------------------- |
| `style={{ background: '#FFFFFF' }}`        | `bg-surface`                       |
| `style={{ background: '#F4F4F7' }}`        | `bg-canvas`                        |
| `style={{ color: '#111827' }}`             | `text-ink`                         |
| `style={{ color: '#6B7280' }}`             | `text-ink-muted`                   |
| `style={{ color: '#9CA3AF' }}`             | `text-ink-soft`                    |
| `style={{ border: '1px solid #E5E7EB' }}`  | `border border-border`             |
| `style={{ borderRadius: 12 }}`             | `rounded-card`                     |
| `style={{ borderRadius: 8 }}`              | `rounded-btn`                      |
| `style={{ boxShadow: '0 1px 2px ...' }}`   | `shadow-card`                      |
| `style={{ padding: 20 }}` (card inner)     | `p-card`                           |
| `style={{ gap: 16 }}` (grid gutter)        | `gap-gutter`                       |
| custom modal/button hover focus ring       | `focus-visible:shadow-focus`       |
| `<div className="flex">` + ad-hoc gap      | `Card` / `DashboardGrid` / `GridItem` |

## Span lookup — GridItem usage

```tsx
<GridItem span={{ base: 12, sm: 6, md: 4, lg: 3, xl: 2 }}>…</GridItem>
```

Maps to `col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3 xl:col-span-2`
via `Record<SpanValue, string>` lookups. Adding a new breakpoint means adding
a new lookup object (not a new template string).

## Renamed / removed props

Nothing removed — primitives are new. If you adopt a primitive in an existing
file, preserve `data-testid` and analytics handlers verbatim; all primitives
forward `...rest` HTML props.

## Dashboard page

`src/pages/Dashboard.tsx` is refactored onto the new primitives. It renders
inside the existing `<AppShell />` (which still owns the dex-based sidebar),
so the main content area is the new `<DashboardGrid>` + `<GridItem>` layout.

Layout spans used:

| Card                                 | Span                                     |
| ------------------------------------ | ---------------------------------------- |
| KPI (Contacts, New leads, … Broadcast)| `{ base:12, sm:6, md:4, lg:3, xl:2 }`   |
| Tasks, Recent activity               | `{ base:12, lg:6, xl:4 }`                |
| Appointments, Reviews (empty)        | `{ base:12, md:6, lg:6, xl:4 }`          |
| Email health (progress)              | `{ base:12, md:6, lg:4 }`                |

Focus-ring note: Tailwind v4 won't auto-generate a `shadow-*` utility for
`focus-visible:` from `--shadow-focus`. The primitives use the arbitrary-value
form: `focus-visible:shadow-[var(--shadow-focus)]`.

## Sidebar & MobileTabBar

Both are exported from `src/components/ui/` and previewed in `/dev/ui`.
They are **not** wired into production routing in this pass — the existing
`<AppShell />` + dex-based `<Sidebar />` continues to own navigation for all
routes, and nesting two sidebars would break layout. Adoption path:

1. Decide whether to replace `AppShell` globally or fork a dashboard-only
   shell.
2. If forking: add a wrapper that renders `<Sidebar />` + `<MobileTabBar />`
   and wraps main with `lg:pl-[72px] pb-16 lg:pb-0`, then route `/dashboard`
   to the new shell instead of `<AppShell />`.

## Deliberately **not** done in this pass

- No replacement of the production `<AppShell />` / dex sidebar — see above.
- No Tailwind v3 `tailwind.config.js` — does not apply to v4; tokens are in
  `@theme` instead.

## Dependencies added

```
npm install clsx tailwind-merge lucide-react @tailwindcss/forms
```

No other new deps.
