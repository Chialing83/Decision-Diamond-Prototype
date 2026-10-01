# AGENTS.md

You are an expert in HTML, CSS, TypeScript, JavaScript, Tailwind CSS, Radix UI and Reka UI.

This repository is **my-dex-prototype** — a **DEX Design System prototyping workspace**: a standalone Vite **Vue** project that consumes published `@thryvlabs/dex-*` packages from npm. Use it for exploratory UI and design-system iteration, not as a production application template. Prefer composing those packages over reimplementing the design system in this repo.

## Dev environment

- Install dependencies: `pnpm install` (or `npm install` / `yarn` if you prefer).
- Start the dev server: `pnpm dev`
- Production build: `pnpm build`
- Preview production build: `pnpm preview`
- Linting: run `pnpm lint` when a `lint` script exists in `package.json` (ESLint may live under `eslint.config.*`).

## Testing

- The generated workspace exposes `dev`, `build`, and `preview` only. When you add tests, prefer Vitest with Testing Library and a `test` script (for example `pnpm test`).
- Focus on behavior and accessibility; use clear `describe` blocks and descriptions.

## Project structure

- Single Vite project; source under `src/`.
- Import UI from the `@thryvlabs/dex-*` entries in `package.json` — typically `@thryvlabs/dex-react` or `@thryvlabs/dex-vue`; Vue apps also use `@thryvlabs/dex-core` with `dex-vue`.
- Keep prototype-specific layout and styling here; reach for DEX components and tokens before custom CSS.
- Do not fork or duplicate design-system components; add thin wrappers only when needed.

## Code style

- Strict TypeScript, type-first where it helps, no `any` (prefer `unknown` or real types).
- Follow ESLint and Prettier; conventional commits; kebab-case files, PascalCase components.
- Prefer named exports; default export is fine for the Vite entry (e.g. `App`). Group imports: packages, then aliases, then relative paths. Avoid circular dependencies.

## UI and components

- **Compose DEX first** — use package exports and documented patterns before building new UI.
- Prefer small, focused components and composition over inheritance.
- For interactive UI that DEX does not provide, build on Radix (React) or Reka (Vue) for accessibility instead of bespoke ARIA; keep behavior and presentation easy to follow.
- **React:** functional components and hooks; `forwardRef` when refs matter; avoid `React.FC`; `memo` when it measurably helps.
- **Vue:** Composition API and `<script setup>`; `defineOptions` for `name` when useful; solid prop typing.

## Styling

- Prefer component props over custom CSS; then DEX tokens and Tailwind. Use DEX tokens as CSS variables, e.g. `var(--dex-spacing-100)`.

## Design system reference

- Use the **DEX prototyping** skill under `skills/dex-prototyping/` and the configured MCP server to explore components, docs, and tokens before unfamiliar UI work.

## Design tokens and theming

- Use tokens and theme variables from `@thryvlabs/dex-*`. Follow this workspace’s `data-theme` / provider patterns for light, dark, or brand themes.

## Accessibility

- Aim for WCAG 2.1 AA where it matters for your UI.
- Do not weaken focus order, labels, or ARIA from DEX or primitives for styling shortcuts.
- Use semantic HTML and exercise keyboard flows for interactive pieces.

## Performance

- Tree-shake imports from `@thryvlabs/dex-*`; use route-level or feature-level dynamic imports when it helps; watch bundle impact of new dependencies.

## Documentation

- Keep `README.md` focused on run, build, and any env vars or registry auth.

## Version management and dependencies

- DEX versions are pinned in `package.json` — upgrade deliberately and re-check UI.
- Keep React or Vue within peer ranges required by `@thryvlabs/dex-*`.
- Prefer small, reviewable changes unless a larger change is explicitly in scope.

## Design system support

- Report DEX defects, gaps, or upgrade questions through your team’s normal channel (`#ask-dex-design-system` on Slack), not only as one-off prototype workarounds.
