# DEX prototyping

Use this skill when building or extending UI with the Thryv DEX Design System in this project.

## MCP server (required for accurate component usage)

The DEX Design System MCP server exposes live component docs and tokens. Prefer it over guessing from memory.

1. Call `list_components` to see available DEX components.
2. Call `get_component` before using any component you have not verified in this session.
3. Call `search_tokens` to find the right design token for spacing, color, typography, etc.

## Imports and naming

- Components are prefixed with `Dex`. Import from `@thryvlabs/dex-react` in React projects or `@thryvlabs/dex-vue` in Vue projects.
- Follow the import paths and usage shown in MCP `get_component` responses.

## Styling

- Use `--dex-*` CSS variables for styling, not raw hex colors, unless the design explicitly requires an exception.
- Prefer semantic tokens and existing DEX patterns over one-off styles.
