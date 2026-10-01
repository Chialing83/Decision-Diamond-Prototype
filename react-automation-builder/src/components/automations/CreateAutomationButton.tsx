import React, { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Copy, PlusCircle } from 'lucide-react'
import { Button } from '../ui'
import { cn } from '../ui/cn'

/**
 * Split-button dropdown that opens an anchored menu with three creation
 * options. Mirrors the production Keap "Create an automation" CTA:
 *
 *   1. Start from a template  — client-side route to the templates grid.
 *   2. Advanced automation    — creates a new draft (mock numeric id),
 *                               then routes to the Advanced funnel editor.
 *   3. Easy automation        — creates a new draft (mock opaque token id),
 *                               then routes to the in-app Easy builder.
 *
 * Built without Radix / Headless UI to stay within the project's
 * dependency limits — handles outside-click + Escape to close + ArrowDown
 * to jump focus into the menu, matching the KebabMenu pattern already
 * shipping in this codebase.
 */
export function CreateAutomationButton() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    // Auto-focus the first menuitem so keyboard users can navigate
    // immediately without an extra Tab.
    firstItemRef.current?.focus()
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  /** Mock API stubs — production replaces these with real POSTs that
   *  return ids and persist the new draft. Numeric for Advanced, opaque
   *  string for Easy, matching the production URL shapes. */
  const createAdvancedAutomation = async (): Promise<{ id: number }> => ({
    id: 3000 + Math.floor(Math.random() * 1000),
  })
  const createEasyAutomation = async (): Promise<{ id: string }> => ({
    id: Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 12),
  })

  const onPickTemplate = () => {
    setOpen(false)
    navigate('/my-automations/templates')
  }
  const onPickAdvanced = async () => {
    setOpen(false)
    const { id } = await createAdvancedAutomation()
    // Advanced editor in this prototype lives under the existing
    // `/my-automations/list/advanced/:automationId` standalone route
    // (see App.tsx) — the AutomationBuilder full-page surface. The
    // production redirect would be to the funnel editor on the app
    // subdomain; here we stay in the prototype.
    navigate(`/my-automations/list/advanced/${id}`)
  }
  const onPickEasy = async () => {
    setOpen(false)
    const { id } = await createEasyAutomation()
    navigate(`/automations/build/${id}`)
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        variant="primary"
        rightIcon={
          <ChevronDown
            size={16}
            strokeWidth={2}
            className={cn(
              'transition-transform motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        Create an automation
      </Button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Create an automation"
          className="absolute right-0 z-30 mt-2 w-72 rounded-card bg-surface border border-border shadow-card py-1 text-sm"
        >
          <MenuItem
            ref={firstItemRef}
            icon={<Copy size={18} strokeWidth={1.75} aria-hidden="true" />}
            label="Start from a template"
            onSelect={onPickTemplate}
          />
          <MenuItem
            icon={<PlusCircle size={18} strokeWidth={1.75} aria-hidden="true" />}
            label="Advanced automation"
            subtitle="Automation builder"
            onSelect={onPickAdvanced}
          />
          <MenuItem
            icon={<PlusCircle size={18} strokeWidth={1.75} aria-hidden="true" />}
            label="Easy automation"
            onSelect={onPickEasy}
          />
        </div>
      ) : null}
    </div>
  )
}

const MenuItem = React.forwardRef<
  HTMLButtonElement,
  {
    icon: React.ReactNode
    label: string
    subtitle?: string
    onSelect: () => void
  }
>(function MenuItem({ icon, label, subtitle, onSelect }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors motion-reduce:transition-none',
        'hover:bg-canvas focus-visible:outline-none focus-visible:bg-canvas',
      )}
    >
      <span aria-hidden="true" className="mt-0.5 inline-flex shrink-0 text-ink">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm text-ink">{label}</span>
        {subtitle ? (
          <span className="text-xs text-ink-muted">{subtitle}</span>
        ) : null}
      </span>
    </button>
  )
})
