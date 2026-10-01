import React, { useEffect, useId, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { cn } from './cn'
import { IconButton } from './IconButton'

export interface KebabMenuItem {
  label: string
  onSelect: () => void
  icon?: React.ReactNode
  danger?: boolean
  disabled?: boolean
}

export interface KebabMenuProps {
  items: KebabMenuItem[]
  'aria-label'?: string
  align?: 'start' | 'end'
  className?: string
}

/** Minimal accessible overflow menu. Built without Radix/Headless UI to honor
 *  the project's dependency limits. Handles outside click + Escape to close. */
export function KebabMenu({
  items,
  'aria-label': ariaLabel = 'More actions',
  align = 'end',
  className,
}: KebabMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

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
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <IconButton
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={16} strokeWidth={2} className="text-ink" aria-hidden="true" />
      </IconButton>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'absolute z-20 mt-1 w-44 rounded-btn bg-surface border border-border shadow-card py-1 text-sm',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onSelect()
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors motion-reduce:transition-none',
                'hover:bg-canvas focus-visible:outline-none focus-visible:bg-canvas',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                item.danger ? 'text-danger' : 'text-ink',
              )}
            >
              {item.icon ? (
                <span aria-hidden="true" className="inline-flex">
                  {item.icon}
                </span>
              ) : null}
              <span className="flex-1">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
