import React from 'react'
import { cn } from './cn'

export interface TabItem<T extends string = string> {
  id: T
  label: string
}

export interface TabsProps<T extends string = string> {
  items: ReadonlyArray<TabItem<T>>
  value: T
  onChange: (next: T) => void
  'aria-label'?: string
  className?: string
}

/** Per Addendum F §4: 40px tall triggers, 14/700 text-ink-muted in both states,
 *  2px brand-orange underline on active, 2px transparent on inactive to avoid
 *  layout shift. The nav sits on a 1px row-divider baseline. */
export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
}: TabsProps<T>) {
  return (
    <nav
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex items-center gap-2 border-b border-row-divider', className)}
    >
      {items.map((t) => {
        const active = value === t.id
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              'h-10 px-3 pt-3 pb-2.5 text-sm font-bold text-ink-muted',
              'border-b-2 -mb-px transition-colors motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] rounded-t-sm',
              active ? 'border-brand-orange' : 'border-transparent hover:text-ink',
            )}
          >
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
