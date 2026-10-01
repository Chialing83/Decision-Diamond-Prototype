import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import Contacts from './pages/Contacts'
import Pipeline from './pages/Pipeline'
import DealModal from './components/pipeline/DealModal'
import Communications from './pages/Communications'
import Marketing from './pages/Marketing'
import Automation from './pages/Automation'
import AutomationBuilder from './pages/AutomationBuilder'
import AutomationTemplates from './pages/AutomationTemplates'
import EasyAutomationBuilder from './pages/EasyAutomationBuilder'
import DevUI from './pages/DevUI'
import Reports from './pages/Reports'
import Placeholder from './pages/Placeholder'

/** When set at build time (`VITE_FORCED_AUTOMATION_ID=adv1 npm run build`),
 *  the app boots in single-canvas mode: every route — including the
 *  list view — redirects to the canvas for the forced id. Used to
 *  produce isolated single-automation deploys (one repo per scenario)
 *  for usability testing where each tester should only see one flow. */
const FORCED_AUTOMATION_ID: string | undefined =
  // Vite exposes user env vars via `import.meta.env`; the `as any`
  // cast keeps TS happy in environments that don't ship the
  // `import.meta.env` type out of the box.
  (import.meta as any).env?.VITE_FORCED_AUTOMATION_ID || undefined

const REDIRECT_TARGET = FORCED_AUTOMATION_ID
  ? `/my-automations/list/advanced/${FORCED_AUTOMATION_ID}`
  : '/my-automations/list/advanced'

// `BASE_URL` mirrors Vite's `base` config (set per-deploy via
// VITE_BASE_PATH). Passing it to BrowserRouter's `basename` makes
// every <Navigate> / <Link> / programmatic push prepend the repo
// prefix — so an isolated build at `/messy-flow-tidy-up/` rewrites
// its URLs as `/messy-flow-tidy-up/my-automations/...` instead of
// dropping the prefix and producing a GitHub-Pages-level 404 on
// refresh. Strip the trailing slash so React Router's normalizer
// doesn't double up.
const ROUTER_BASE = ((import.meta as any).env?.BASE_URL || '/').replace(/\/$/, '')

export default function App() {
  return (
    <BrowserRouter basename={ROUTER_BASE}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          {/* Demo lockdown — index + every non-automation surface
              redirects into the automation list (or directly to the
              forced canvas when VITE_FORCED_AUTOMATION_ID is set).
              Pages themselves are intentionally LEFT IN PLACE (not
              deleted) so the build can be unlocked later by
              reverting this block. */}
          <Route index element={<Navigate to={REDIRECT_TARGET} replace />} />
          <Route path="dashboard" element={<Navigate to={REDIRECT_TARGET} replace />} />

          {/* Contacts — blocked */}
          <Route path="contacts/*" element={<Navigate to={REDIRECT_TARGET} replace />} />

          {/* Pipeline — blocked */}
          <Route path="pipeline/*" element={<Navigate to={REDIRECT_TARGET} replace />} />

          {/* Communications — blocked */}
          <Route path="communication/*" element={<Navigate to={REDIRECT_TARGET} replace />} />

          {/* Marketing / Forms — blocked */}
          <Route path="forms/*" element={<Navigate to={REDIRECT_TARGET} replace />} />
          <Route path="landing-pages" element={<Navigate to={REDIRECT_TARGET} replace />} />
          <Route path="checkout-forms" element={<Navigate to={REDIRECT_TARGET} replace />} />

          {/* Automation */}
          <Route path="my-automations">
            {FORCED_AUTOMATION_ID ? (
              // Single-canvas mode — list views also bounce so the
              // tester can't see anything but the forced canvas.
              <>
                <Route index element={<Navigate to={REDIRECT_TARGET} replace />} />
                <Route path="list/easy" element={<Navigate to={REDIRECT_TARGET} replace />} />
                <Route path="list/advanced" element={<Navigate to={REDIRECT_TARGET} replace />} />
                <Route path="templates" element={<Navigate to={REDIRECT_TARGET} replace />} />
              </>
            ) : (
              <>
                <Route index element={<Navigate to="/my-automations/list/easy" replace />} />
                <Route path="list/easy" element={<Automation />} />
                <Route path="list/advanced" element={<Automation />} />
                <Route path="templates" element={<AutomationTemplates />} />
              </>
            )}
          </Route>
          <Route path="automation">
            <Route
              path="templates"
              element={<Navigate to={FORCED_AUTOMATION_ID ? REDIRECT_TARGET : '/my-automations/templates'} replace />}
            />
            <Route path="zapier" element={FORCED_AUTOMATION_ID ? <Navigate to={REDIRECT_TARGET} replace /> : <Placeholder />} />
            <Route path="ai-assistant" element={FORCED_AUTOMATION_ID ? <Navigate to={REDIRECT_TARGET} replace /> : <Placeholder />} />
            <Route path="preferences" element={FORCED_AUTOMATION_ID ? <Navigate to={REDIRECT_TARGET} replace /> : <Placeholder />} />
          </Route>

          {/* Reports — blocked */}
          <Route path="reports" element={<Navigate to={REDIRECT_TARGET} replace />} />

          {/* Misc — blocked */}
          <Route path="search" element={<Navigate to={REDIRECT_TARGET} replace />} />
          <Route path="appointments" element={<Navigate to={REDIRECT_TARGET} replace />} />
          <Route path="tasks" element={<Navigate to={REDIRECT_TARGET} replace />} />
          <Route path="business-profile" element={<Navigate to={REDIRECT_TARGET} replace />} />
          <Route path="domains" element={<Navigate to={REDIRECT_TARGET} replace />} />
          <Route path="sales/*" element={<Navigate to={REDIRECT_TARGET} replace />} />

          {/* Catch-all — anything not matched above also bounces. */}
          <Route path="*" element={<Navigate to={REDIRECT_TARGET} replace />} />
        </Route>

        {/* Standalone full-page routes (no AppShell/sidebar) */}
        <Route
          path="/my-automations/list/advanced/:automationId"
          element={<AutomationBuilder />}
        />
        <Route
          path="/automations/build/:id"
          element={<EasyAutomationBuilder />}
        />
        <Route path="/dev/ui" element={<DevUI />} />
      </Routes>
    </BrowserRouter>
  )
}
