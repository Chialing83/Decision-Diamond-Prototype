import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { DexAvatar, DexIconButton, DexStatus } from '@thryvlabs/dex-react'
import { useStore } from '../../store/useStore'
import { CatLogo } from '../CatLogo'

interface Props {
  isExpanded: boolean
  onToggleExpand: () => void
  onNavActivate: (id: string, path: string) => void
  onOpenSearch: () => void
  onOpenHelp: () => void
}

interface NavLink {
  id: string
  label: string
  path: string
  pathMatch: string
}

const navLinks: NavLink[] = [
  { id: 'home',       label: 'Home',       path: '/dashboard',      pathMatch: '/dashboard' },
  { id: 'contacts',   label: 'Contacts',   path: '/contacts',       pathMatch: '/contacts' },
  { id: 'myday',      label: 'My day',     path: '/pipelines/last', pathMatch: '/pipeline' },
  { id: 'comms',      label: 'Comms',      path: '/communication',  pathMatch: '/communication' },
  { id: 'sales',      label: 'Sales',      path: '/sales',          pathMatch: '/sales' },
  { id: 'marketing',  label: 'Marketing',  path: '/forms',          pathMatch: '/forms' },
  { id: 'automation', label: 'Automation', path: '/my-automations', pathMatch: '/my-automations' },
  { id: 'reports',    label: 'Reports',    path: '/reports',        pathMatch: '/reports' },
]

const ICON_STYLE: React.CSSProperties = {
  width: 'var(--dex-icon-size, auto)',
  height: 'var(--dex-icon-size, auto)',
  minWidth: 'var(--dex-icon-size, auto)',
  minHeight: 'var(--dex-icon-size, auto)',
  fill: 'currentcolor',
}

const ICON_STYLE_MD: React.CSSProperties = {
  width: 'var(--dex-icon-size-md)',
  height: 'var(--dex-icon-size-md)',
  minWidth: 'var(--dex-icon-size-md)',
  minHeight: 'var(--dex-icon-size-md)',
  fill: 'currentcolor',
}

export function PrimaryNav({ isExpanded, onToggleExpand, onNavActivate, onOpenSearch, onOpenHelp }: Props) {
  const location = useLocation()
  const navigate = useNavigate()

  const user             = useStore((s) => s.user)
  const unreadComms      = useStore((s) => s.unreadCommsCount)
  const notificationCount = useStore((s) => s.notificationCount)

  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!accountOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAccountOpen(false) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [accountOpen])

  const isActive = (match: string) =>
    location.pathname === match || location.pathname.startsWith(match + '/')

  return (
    <div className="primary-nav">
      <div>
        <div className="tw:absolute tw:top-050 tw:right-050">
          <DexIconButton
            variant="transparent"
            size="dense"
            label={isExpanded ? 'Collapse Nav' : 'Expand Nav'}
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                data-name="collapse"
                viewBox="0 0 24 24"
                aria-hidden="true"
                style={ICON_STYLE}
              >
                <path fillRule="evenodd" d="M3 1a1 1 0 0 1 1 1v20a1 1 0 1 1-2 0V2a1 1 0 0 1 1-1m11.707 5.293a1 1 0 0 1 0 1.414L11.414 11H19a1 1 0 1 1 0 2h-7.586l3.293 3.293a1 1 0 0 1-1.414 1.414l-5-5a1 1 0 0 1 0-1.414l5-5a1 1 0 0 1 1.414 0"/>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                data-name="expand"
                viewBox="0 0 24 24"
                aria-hidden="true"
                style={ICON_STYLE}
              >
                <path fillRule="evenodd" d="M21 1a1 1 0 0 1 1 1v20a1 1 0 1 1-2 0V2a1 1 0 0 1 1-1M10.707 6.293l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414-1.414L12.586 13H5a1 1 0 1 1 0-2h7.586L9.293 7.707a1 1 0 0 1 1.414-1.414"/>
              </svg>
            )}
          </DexIconButton>
        </div>

        <div className="nav-logo-container">
          <a
            href={undefined}
            className=""
            aria-label="Preview build"
            data-qa="small-logo"
            onClick={(e) => { e.preventDefault() }}
            style={{ cursor: 'default' }}
          >
            <div
              className="dex-inline dex-gap-0"
              data-stretch="false"
              data-align-x="left"
              data-align-y="top"
              data-wrap="true"
              style={{ width: '1.125rem', display: 'inline-flex' }}
            >
              {/* Brand mark for the locked-down preview — original
                  cat illustration in place of the Keap "K". Sized to
                  match the previous logo's footprint so the sidebar
                  doesn't reflow. */}
              <CatLogo size={27} />
            </div>
          </a>
        </div>

        <DexIconButton
          variant="transparent"
          className="side-nav-menu-item side-nav-menu-item-stacked side-nav-search-condensed"
          label="Search"
          onClick={onOpenSearch}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            data-name="search"
            viewBox="0 0 24 24"
            aria-hidden="true"
            style={ICON_STYLE_MD}
          >
            <path fillRule="evenodd" d="M9.5 2a7.5 7.5 0 0 1 5.964 12.048l6.243 6.245a1 1 0 0 1-1.414 1.414l-6.245-6.243A7.5 7.5 0 1 1 9.5 2m0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11"/>
          </svg>
        </DexIconButton>

        {navLinks.map((link) => {
          const active = isActive(link.pathMatch)
          // Demo lockdown — every non-automation section is
          // visually present but click-disabled. The build stays
          // intact (no routes deleted); user just can't navigate
          // away from the automation surface for this preview.
          const isEnabled = link.id === 'automation'
          const className = active
            ? 'side-nav-menu-item side-nav-menu-item-active side-nav-menu-item-condensed'
            : 'side-nav-menu-item side-nav-menu-item-condensed'
          return (
            <a
              key={link.id}
              href={isEnabled ? link.path : undefined}
              className={className}
              aria-disabled={!isEnabled || undefined}
              title={isEnabled ? undefined : 'Disabled in this preview'}
              onClick={(e) => {
                e.preventDefault()
                if (!isEnabled) return
                onNavActivate(link.id, link.path)
                navigate(link.path)
              }}
              style={
                isEnabled
                  ? undefined
                  : { opacity: 0.35, cursor: 'not-allowed', pointerEvents: 'auto' }
              }
            >
              <div className="dex-pl-075">
                <div className="dex-text-headline-5">{link.label}</div>
              </div>
              {link.id === 'comms' && unreadComms > 0 && (
                <div className="dex-status" data-variant="danger" data-emphasis="high" role="status">
                  <div className="dex-text-headline-5">{unreadComms}</div>
                </div>
              )}
            </a>
          )
        })}
      </div>

      <div className="dex-py-300">
        <div className="dex-stack dex-gap-300" data-stretch="false" data-align-x="center">
          <button
            type="button"
            aria-label="Help"
            data-size="default"
            data-variant="transparent"
            className="dex-icon-button"
            onClick={onOpenHelp}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              data-name="help-circle"
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={ICON_STYLE}
            >
              <path fillRule="evenodd" d="M12 1c6.075 0 11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12 5.925 1 12 1m0 2a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 14a1 1 0 1 1 0 2 1 1 0 0 1 0-2m0-13a5 5 0 0 1 1 9.9V15a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1 3 3 0 1 0-3-3 1 1 0 0 1-2 0 5 5 0 0 1 5-5"/>
            </svg>
          </button>

          <div ref={accountRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              data-state={accountOpen ? 'open' : 'closed'}
              className="avatar-button"
              aria-label="Account"
              onClick={() => setAccountOpen((v) => !v)}
            >
              <DexAvatar name={user.firstInitial} variant="user" aria-hidden="true" />
              {notificationCount > 0 && (
                <div className="avatar-button-notification-count">
                  <DexStatus variant="danger" emphasis="high">{notificationCount}</DexStatus>
                </div>
              )}
            </button>

            {accountOpen && (
              <div className="account-dropdown" role="menu">
                <button className="account-dropdown-item" role="menuitem" onClick={() => setAccountOpen(false)}>Profile</button>
                <button className="account-dropdown-item" role="menuitem" onClick={() => setAccountOpen(false)}>Settings</button>
                <button className="account-dropdown-item" role="menuitem" onClick={() => setAccountOpen(false)}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
