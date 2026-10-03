# Decision Diamond Prototype

Two independent prototypes exploring **Decision Diamond** behavior and the
surrounding automation builder UX. Each lives in its own folder with its own
dependencies and dev server — they do not share runtime code.

```
.
├── react-automation-builder/   # React + Vite — Keap-style automation builder + Tidy Up demo
└── vue-decision-diamond/       # Vue 3 + Vite — Decision Diamond POC against @thryvlabs/dex-vue
```

## For Claude: how to fire up either prototype

Clone the repo, change into the prototype folder, install, and start the dev
server. Each prototype uses its own package manager preference but both will
work with plain `npm`.

### React — automation builder with Tidy Up demo

```bash
cd react-automation-builder
npm install
npm run start        # vite dev server, http://localhost:3000
```

Deep-link routes:
- `/` → redirects to the automations list
- `/my-automations/list/advanced/adv1` → "Messy flow_Manual" canvas (Tidy Up hidden)
- `/my-automations/list/advanced/adv2` → "Messy flow_Tidy up tool" canvas (Tidy Up enabled)

Build-time env flags for producing isolated single-canvas deploys:
- `VITE_FORCED_AUTOMATION_ID=adv1` or `adv2` — locks every route to that canvas
- `VITE_BASE_PATH=/some-subpath/` — subpath prefix for GitHub Pages hosting
- `VITE_CLOSE_URL=/some/list/` — where the canvas close (X) button goes in a
  single-canvas build, e.g. back to the Vue prototype's automation list

Example — build the Tidy-up-only isolated bundle used by the demo site:
```bash
VITE_BASE_PATH=/messy-flow-tidy-up/ VITE_FORCED_AUTOMATION_ID=adv2 npm run build
```

See [react-automation-builder/README.md](react-automation-builder/README.md)
for architecture notes, the Tidy Up algorithm, and the handoff docs.

### Vue — Decision Diamond POC

```bash
cd vue-decision-diamond
npm install
npm run dev          # vite dev server, http://localhost:4200
```

Decision Diamond editor and routing exploration against the Thryv DEX design
system (`@thryvlabs/dex-vue`, `@thryvlabs/dex-core`). All three `@thryvlabs/*`
packages are installed from the public npm registry — no internal workspace
required.

Supporting design/behavior docs are at the folder root:
- [DECISION-DIAMOND-LOGIC.md](vue-decision-diamond/DECISION-DIAMOND-LOGIC.md)
- [DECISION-DIAMOND-ENTITY-EXPANSION-SPEC.md](vue-decision-diamond/DECISION-DIAMOND-ENTITY-EXPANSION-SPEC.md)
- `HANDOFF-*.md` — iterative handoff notes between prototype milestones

### Common prerequisites

- **Node 20+** (both prototypes build with Vite 6/7)
- **Git** for cloning
- Network access to the public npm registry (for `@thryvlabs/*` packages)

### Troubleshooting

- **"Cannot find module '@thryvlabs/dex-vue'"** in the Vue prototype → run
  `npm install` from inside `vue-decision-diamond/`, not from the repo root.
  The two prototypes have independent `node_modules`.
- **Port already in use** → React defaults to `3000`, Vue to `4200`. Override
  with `PORT=…` or edit the `server.port` in each `vite.config.ts`.
- **Blank page on refresh in production build** → the React prototype relies
  on `BrowserRouter` with `basename={BASE_URL}` so it survives GitHub Pages'
  SPA fallback. Confirm `VITE_BASE_PATH` matches the hosting path.

## License

Internal prototyping only — not for public distribution.
