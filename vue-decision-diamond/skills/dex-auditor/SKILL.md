---
name: dex-auditor
description: Audit UI code in this project against the Thryv DEX Design System and propose swaps for anything that isn't aligned. Use whenever the user asks to "audit DEX", "check DEX compliance", "find non-DEX components", "swap to DEX", "DEX-ify this", reviews a page/component for design-system fit, or invokes /dex-auditor. Also trigger when the user shares a screen/file and asks whether it follows the design system, or when they want to know which raw HTML elements, custom CSS values, or third-party UI primitives should be replaced with Dex* components and --dex-* tokens. Always verify proposed replacements through the dex-design-system MCP tools before suggesting them.
---

# DEX Auditor

Audit UI source files in this workspace, surface anything that does not align with the Thryv DEX Design System (`@thryvlabs/dex-vue` / `@thryvlabs/dex-react`, plus `--dex-*` design tokens), and propose verified DEX replacements. By default, produce a report first and only apply edits after the user approves.

## When this skill runs

Trigger this skill when the user asks to audit, review, lint, or "DEX-ify" UI code — even casually ("does this look right?", "what's not on the design system here?"). Also trigger when they invoke `/dex-auditor`. If the user only asks a one-off question about a single component, prefer the lighter `dex-prototyping` skill instead.

## Inputs

- **Scope.** If the user passes paths or a glob, audit those. Otherwise default to all of `src/` under the current working directory. For monorepo-style siblings (e.g. `keap-crm/`, `keap-prototype-x/`) only include them if the user asks.
- **Framework.** Detect from the project's `package.json` — `@thryvlabs/dex-vue` ⇒ Vue, `@thryvlabs/dex-react` ⇒ React. If both are present, ask which to target. Pass this framework to every MCP call so suggestions match the project.

## Workflow

Follow these steps in order. Don't skip the MCP verification step — that's the whole point of the audit, and guessing component names from memory is the failure mode this skill exists to prevent.

### 1. Establish the catalog

Before scanning, call the DEX MCP server to ground your suggestions in what actually exists:

- `mcp__dex-design-system__list_components` with the detected framework — cache the names you see, you'll match against them.
- `mcp__dex-design-system__list_themes` once — so you know which `data-theme` values are valid if the audit touches theming.

You don't need to fetch every component up front. Use `search_components` and `get_component` on demand when you find a candidate to swap.

### 2. Scan for non-DEX patterns

Walk the in-scope files (`.vue`, `.tsx`, `.jsx`, `.ts`, `.js`, `.css`, `.scss`) and flag these patterns. Each one is a *candidate* — a thing that probably has a DEX equivalent, not a guaranteed swap.

**Component-level smells**
- Raw HTML interactive elements: `<button>`, `<input>`, `<select>`, `<textarea>`, `<dialog>`, `<details>`, native `<a>` styled as a button.
- Headless/third-party primitives used directly: Radix, Reka, Headless UI, Vuetify, PrimeVue, Element Plus, shadcn — anything that overlaps with a DEX component.
- Locally re-implemented UI: components in `src/` named `Button`, `Modal`, `Dialog`, `Tooltip`, `Tabs`, `Toast`, `Avatar`, `Card`, `Badge`, `Input`, `Select`, `Checkbox`, `Radio`, `Switch`, `Drawer`, `Menu`, `Spinner`, `Table` (without the `Dex` prefix).
- Icon imports from `lucide-react`, `@heroicons`, `react-icons`, `@iconify`, etc. when DEX exposes its own icon set — verify with `search_components` for `Icon`.

**Token-level smells (in templates, JSX, and style blocks)**
- Hard-coded colors: hex (`#1f2937`), `rgb(...)`, `rgba(...)`, `hsl(...)`, named colors (`red`, `slategray`).
- Hard-coded spacing/sizing in `px`, `rem`, or `em` for paddings, margins, gaps, radii, font sizes, line heights, shadows — wherever a `--dex-spacing-*`, `--dex-radius-*`, `--dex-font-*`, or `--dex-shadow-*` token would fit.
- Tailwind utility classes that bake in raw values (e.g. `p-[18px]`, `text-[#1f2937]`, `rounded-[6px]`) when a DEX token covers it.
- Inline `style=""` blocks setting any of the above.

**Theming smells**
- Hard-coded `data-theme` strings that aren't in `list_themes`.
- Bypassing DEX theme providers / context.

Skip generated code (`dist/`, `node_modules/`, build artifacts) and anything inside `*.test.*` / `*.spec.*` unless the user explicitly includes them.

### 3. Verify a DEX equivalent exists

For every candidate, before reporting it as a swap, confirm DEX has something that fits:

- Component candidates → `mcp__dex-design-system__search_components` with a keyword (e.g. `"modal"`, `"toast"`), then `mcp__dex-design-system__get_component` on the best match to read its real props/slots/events.
- Token candidates → `mcp__dex-design-system__search_tokens` (or `get_token` if you already know the name) to find the closest semantic token. Prefer semantic tokens (e.g. `color.surface.subtle`) over raw palette tokens (e.g. `color.gray.100`) when both exist.

If nothing in DEX maps cleanly to the candidate, **do not invent one** — record it under "Gaps" in the report so the user can raise it with the design-system team (`#ask-dex-design-system`).

### 4. Produce the report

Always produce this report before touching files. Use this exact structure:

```
# DEX audit — <scope summary>

Framework: <react|vue>   Files scanned: <n>   Findings: <n>   Gaps: <n>

## Findings
### <relative/file/path.vue>
- L<line>: <short description of the non-DEX pattern>
  Current:  <minimal code excerpt>
  Suggest:  <Dex* component or --dex-* token>
  Why:      <one line — what the DEX replacement gives you (a11y, theming, consistency)>
  Verified: <MCP call(s) used — e.g. get_component(DexModal, vue)>

## Gaps (no clean DEX equivalent)
- <file:line> — <what you looked for, what was missing>

## Suggested next step
Reply "apply <file>" / "apply all" to let me make the swaps, or "skip <id>" to drop a finding.
```

Cite every finding with `file:line` so the user can click through. Keep code excerpts to one or two lines — this is a report, not a diff dump.

### 5. Apply swaps only after confirmation

Default behavior: do not edit files until the user confirms. When they say go (`apply`, `apply all`, `yes`, `do it`, naming specific findings, etc.):

- Re-fetch the target component with `get_component` if you haven't already this session, so the prop/slot names you write are correct.
- Make the smallest viable edit per finding. Don't reformat surrounding code, don't restructure props that aren't part of the swap, don't bulk-rename imports beyond what's required.
- Group edits by file. After each file, briefly note what changed.
- If a swap requires a non-trivial behavioral change (e.g. a DEX component fires events with different names than the headless primitive being replaced), pause and surface the diff before continuing — don't quietly change semantics.

If the user asks to apply everything at once without seeing the report first, push back gently and produce the report anyway — the report is the artifact that lets them trust the edits.

## What counts as "verified"

A suggestion is verified when you've called `get_component` (or `get_token`) in the current session and have the props/values open in front of you. A name you remember from earlier in the project, or guessed from the URL pattern, is not verified. The cost of a wrong MCP call is small; the cost of a confidently-wrong swap is the user losing trust in the audit.

## Edge cases and judgement

- **A Tailwind class is using a DEX value indirectly.** If the project's Tailwind config maps `p-4` → `var(--dex-spacing-200)`, leave it alone. Only flag utilities that bake in raw numbers (`p-[18px]`).
- **The custom component is intentional.** If a file imports a local `Button.vue` but it's clearly a thin wrapper around `DexButton` (e.g. for a project-specific default), flag it as informational, not as a swap target.
- **There are many findings of the same kind.** Group repeated patterns under one entry per file with a count, rather than listing 40 identical color-token findings line by line.
- **The user shares a screenshot or Figma URL instead of code.** This skill is for source code. Point them at the design review skills (`design:design-critique`, `design:design-system`) and stop.

## Related skills

- `dex-prototyping` — lighter-weight skill for *building* with DEX. Use that when the user is composing something new and hasn't asked for an audit.
