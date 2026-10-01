import React from 'react'
import { cn } from './cn'
import { IconButton } from './IconButton'

export interface SidebarItem {
  key: string
  label: string
  icon: React.ReactNode
  active?: boolean
  onSelect?: () => void
}

export interface SidebarProps {
  items: SidebarItem[]
  brand?: React.ReactNode
  className?: string
}

/** 72px fixed icon rail shown on `lg+`. Mobile users get <MobileTabBar />.
 *  Not wired into production routing; preview in /dev/ui. See MIGRATION.md. */
export function Sidebar({ items, brand, className }: SidebarProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'hidden lg:flex fixed inset-y-0 left-0 w-[72px] flex-col items-center gap-2 border-r border-border bg-surface py-3',
        className,
      )}
    >
      {brand ? <div className="mb-2">{brand}</div> : null}
      {items.map((item) => (
        <IconButton
          key={item.key}
          aria-label={item.label}
          aria-current={item.active ? 'page' : undefined}
          onClick={item.onSelect}
          className={cn(item.active && 'bg-canvas text-ink')}
        >
          {item.icon}
        </IconButton>
      ))}
    </nav>
  )
}
