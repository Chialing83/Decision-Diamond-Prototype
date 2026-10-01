import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { DexInline, DexStatus, DexTag } from '@thryvlabs/dex-react'
import { FloatingNewButton } from '../FloatingNewButton'
import { PrimaryNav } from './PrimaryNav'

interface SubNavItem {
  label: string
  path: string
  badge?: number | string
  isNew?: boolean
}

interface ShortcutItem {
  label: string
  path: string
  isNew?: boolean
}

interface SectionPanel {
  id: string
  label: string
  subNav: SubNavItem[]
  shortcuts: ShortcutItem[]
}

const panels: Record<string, SectionPanel> = {
  home: {
    id: 'home', label: 'Home',
    subNav: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'My Playbook', path: '/playbook', isNew: true },
      { label: 'My Checklist', path: '/checklist' },
    ],
    shortcuts: [],
  },
  contacts: {
    id: 'contacts', label: 'Contacts',
    subNav: [
      { label: 'People', path: '/contacts/list/all' },
      { label: 'Companies', path: '/contacts/companies' },
      { label: 'Groups', path: '/contacts/groups' },
    ],
    shortcuts: [
      { label: 'Tags', path: '/contacts/tags' },
      { label: 'Custom fields', path: '/contacts/custom-fields' },
      { label: 'Forms', path: '/forms/public' },
      { label: 'Manage duplicates', path: '/contacts/duplicates' },
    ],
  },
  myday: {
    id: 'myday', label: 'My day',
    subNav: [
      { label: 'Pipelines', path: '/pipeline/1/board' },
      { label: 'Appointments', path: '/appointments' },
      { label: 'Tasks', path: '/tasks' },
    ],
    shortcuts: [],
  },
  comms: {
    id: 'comms', label: 'Comms',
    subNav: [
      { label: 'Business line', path: '/communication/business-line', badge: 1 },
      { label: 'Marketing number', path: '/communication/marketing-number' },
      { label: 'Email broadcasts', path: '/communication/email-broadcasts' },
      { label: 'Text message broadcasts', path: '/communication/text-broadcasts' },
    ],
    shortcuts: [
      { label: 'Business profile', path: '/business-profile' },
      { label: 'Domains', path: '/domains' },
    ],
  },
  sales: {
    id: 'sales', label: 'Sales',
    subNav: [
      { label: 'Pipelines', path: '/pipeline/1/board' },
      { label: 'Quotes', path: '/sales/quotes' },
      { label: 'Invoices', path: '/sales/invoices' },
    ],
    shortcuts: [],
  },
  marketing: {
    id: 'marketing', label: 'Marketing',
    subNav: [
      { label: 'Forms', path: '/forms/public' },
      { label: 'Landing pages', path: '/landing-pages' },
    ],
    shortcuts: [
      { label: 'Email broadcasts', path: '/communication/email-broadcasts' },
      { label: 'Text message broadcasts', path: '/communication/text-broadcasts' },
      { label: 'Checkout forms', path: '/checkout-forms' },
      { label: 'Domains', path: '/domains' },
    ],
  },
  automation: {
    id: 'automation', label: 'Automation',
    subNav: [
      { label: 'My automations', path: '/my-automations/list/easy' },
      { label: 'Automation templates', path: '/my-automations/templates' },
      { label: 'Zapier integrations', path: '/automation/zapier' },
    ],
    shortcuts: [
      { label: 'AI Automation Assistant', path: '/automation/ai-assistant' },
      { label: 'Automation Builder preferences', path: '/automation/preferences', isNew: true },
    ],
  },
  reports: { id: 'reports', label: 'Reports', subNav: [], shortcuts: [] },
  search:  { id: 'search',  label: 'Search',  subNav: [], shortcuts: [] },
}

function getSectionFromPath(pathname: string): string | null {
  if (pathname.startsWith('/dashboard')) return 'home'
  if (pathname.startsWith('/contacts'))  return 'contacts'
  if (pathname.startsWith('/pipeline') || pathname.startsWith('/pipelines')) return 'myday'
  if (pathname.startsWith('/communication')) return 'comms'
  if (pathname.startsWith('/forms') || pathname.startsWith('/landing')) return 'marketing'
  if (pathname.startsWith('/my-automations') || pathname.startsWith('/automation')) return 'automation'
  if (pathname.startsWith('/reports')) return 'reports'
  if (pathname.startsWith('/sales'))   return 'sales'
  if (pathname.startsWith('/search'))  return 'search'
  return null
}

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const [activeSection, setActiveSection] = useState<string | null>(() => getSectionFromPath(location.pathname))
  const [isExpanded, setIsExpanded] = useState<boolean>(true)

  useEffect(() => {
    const fromUrl = getSectionFromPath(location.pathname)
    if (fromUrl && fromUrl !== activeSection) setActiveSection(fromUrl)
  }, [location.pathname])  // eslint-disable-line react-hooks/exhaustive-deps

  const activePanel = activeSection ? panels[activeSection] : null
  const hasPanel = !!activePanel && ((activePanel.subNav.length ?? 0) > 0 || (activePanel.shortcuts.length ?? 0) > 0)
  const showPanel = isExpanded && !!hasPanel

  const handleNavActivate = (id: string, _path: string) => {
    if (id === activeSection && isExpanded) {
      setIsExpanded(false)
    } else {
      setActiveSection(id)
      setIsExpanded(true)
    }
  }

  const handleToggleExpand = () => setIsExpanded((v) => !v)

  const handleOpenSearch = () => navigate('/search')
  const handleOpenHelp   = () => { /* wire up to help drawer composable */ }

  return (
    <DexInline
      gap="0"
      alignY="stretch"
      noWrap
      style={{ height: '100vh', flexShrink: 0, position: 'relative', background: 'var(--color-sidebar-bg)' }}
    >
      {/* Floating "+" button straddles the border between primary and secondary */}
      <FloatingNewButton />

      {/* Primary condensed rail */}
      <PrimaryNav
        isExpanded={showPanel}
        onToggleExpand={handleToggleExpand}
        onNavActivate={handleNavActivate}
        onOpenSearch={handleOpenSearch}
        onOpenHelp={handleOpenHelp}
      />

      {/* Secondary slide-in panel */}
      <div
        className={`secondary-panel ${showPanel ? 'secondary-panel-open' : 'secondary-panel-closed'}`}
        style={{
          background: 'var(--color-sidebar-bg)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          zIndex: 10,
        }}
      >
        {activePanel && (
          <div style={{ minWidth: 240, display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 12px 16px' }}>
            <div style={{ marginBottom: 16, paddingLeft: 8, paddingRight: 40 }}>
              <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{activePanel.label}</span>
            </div>

            {activePanel.subNav.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16 }}>
                {activePanel.subNav.map((sub) => {
                  const subActive = location.pathname === sub.path || location.pathname.startsWith(sub.path + '/contact/')
                  // Demo lockdown — sub-nav clicks are gated to the
                  // automation section only. Items stay visible but
                  // their navigation is suppressed.
                  const subEnabled = activePanel.id === 'automation'
                  return (
                    <button
                      key={sub.path}
                      onClick={() => { if (subEnabled) navigate(sub.path) }}
                      aria-disabled={!subEnabled || undefined}
                      title={subEnabled ? undefined : 'Disabled in this preview'}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 8, border: 'none',
                        background: subActive ? 'var(--color-sidebar-active)' : 'transparent',
                        color: subActive ? '#fff' : 'var(--color-sidebar-text-muted)',
                        fontSize: 14, fontWeight: subActive ? 500 : 400,
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'background 150ms, color 150ms',
                      }}
                      onMouseEnter={(e) => {
                        if (!subActive) {
                          e.currentTarget.style.background = 'var(--color-sidebar-hover)'
                          e.currentTarget.style.color = '#fff'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!subActive) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'var(--color-sidebar-text-muted)'
                        }
                      }}
                    >
                      <span>{sub.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {sub.badge != null && (
                          <DexStatus variant="danger" emphasis="high">{sub.badge}</DexStatus>
                        )}
                        {sub.isNew && (
                          <DexTag color="primary" emphasis="high">Beta</DexTag>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {activePanel.shortcuts.length > 0 && (
              <div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.09)', paddingTop: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', fontWeight: 600, paddingLeft: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Related shortcuts
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {activePanel.shortcuts.map((sc) => {
                    const scEnabled = activePanel.id === 'automation'
                    return (
                    <button
                      key={sc.path}
                      onClick={() => { if (scEnabled) navigate(sc.path) }}
                      aria-disabled={!scEnabled || undefined}
                      title={scEnabled ? undefined : 'Disabled in this preview'}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 12px', borderRadius: 8, border: 'none',
                        background: 'transparent',
                        color: 'rgba(255,255,255,0.47)',
                        fontSize: 14, cursor: scEnabled ? 'pointer' : 'not-allowed', textAlign: 'left',
                        transition: 'background 150ms, color 150ms',
                        opacity: scEnabled ? 1 : 0.5,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--color-sidebar-hover)'
                        e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'rgba(255,255,255,0.47)'
                      }}
                    >
                      <span>{sc.label}</span>
                      {sc.isNew && (
                        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--color-draft)', color: '#fff', fontWeight: 700 }}>
                          New
                        </span>
                      )}
                    </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DexInline>
  )
}
