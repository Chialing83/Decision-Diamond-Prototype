import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Build-time base path. GitHub Pages serves the site at
// `https://<user>.github.io/<repo>/`, so when building for that
// host we need a `/<repo>/` prefix. The repo name is injected via
// `VITE_BASE_PATH` by the deploy workflow; locally we fall back to
// `/` so `npm run start` still works at the root.
const basePath = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base: basePath,
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    port: 3000,
    open: true,
  },
  optimizeDeps: {
    // Pre-bundle CJS dex package so its `require("react")` call is rewritten
    // to ESM imports at dep-optimize time.
    include: ['@thryvlabs/dex-react'],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
})
