import React from 'react'
import { cn } from './cn'

export interface MobileTabBarItem {
  key: string
  label: string
  icon: React.ReactNode
  active?: boolean
  onSelect?: () => void
}

export interface MobileTabBarProps {
  items: MobileTabBarItem[]
  className?: string
}

/** Fixed bottom tab bar shown on <lg viewports. Pair with a main wrapper that
 *  adds `pb-16 lg:pb-0` so content isn't occluded on mobile. */
export function MobileTabBar({ items, className }: MobileTabBarProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed bottom-0 inset-x-0 h-16 bg-surface border-t border-border flex lg:hidden',
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-label={item.label}
          aria-current={item.active ? 'page' : undefined}
          onClick={item.onSelect}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium',
            'transition-colors focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] motion-reduce:transition-none',
            item.active ? 'text-accent' : 'text-ink-muted hover:text-ink',
          )}
        >
          <span aria-hidden="true" className="inline-flex">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
