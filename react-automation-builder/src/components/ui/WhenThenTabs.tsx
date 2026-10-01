import React, { useCallback, useRef } from 'react'
import { cn } from './cn'

export interface WhenThenTabItem<V extends string = string> {
  value: V
  label: string
  /** Per-tab active underline color. Falls back to `--color-tab-blue`.
   *  Allows e.g. the "When" tab to adopt the primary green accent. */
  activeColor?: string
}

export interface WhenThenTabsProps<V extends string = string> {
  items: readonly WhenThenTabItem<V>[]
  value: V
  onChange: (value: V) => void
  /** Adds a 1px row-divider bottom border on the tablist for use inside panels
   *  where the tabs sit flush against content below. */
  withDivider?: boolean
  'aria-label'?: string
  className?: string
}

/** DEX `dex-tabs-trigger dex-text-headline-4`-style tabs.
 *
 *  - Each trigger: h-10, `padding: 12px 12px 10px` (bottom trims 2px so the
 *    active underline doesn't visually shift the label).
 *  - Font: 14 / 700 (headline-4), color `rgba(0,0,0,0.8)` in BOTH states.
 *  - Active indicator: 2px bottom border, `transparent` → `--color-tab-blue`
 *    (#0A7CFF). Deliberately NOT the link blue #006CEB.
 *  - No background change on hover (cursor: pointer only).
 *  - Tablist: flex, no gap, tabs flush-left.
 *  - Keyboard: ArrowLeft / ArrowRight rotate focus + selection. */
export function WhenThenTabs<V extends string = string>({
  items,
  value,
  onChange,
  withDivider = false,
  'aria-label': ariaLabel = 'Tabs',
  className,
}: WhenThenTabsProps<V>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      const dir = e.key === 'ArrowRight' ? 1 : -1
      const next = (idx + dir + items.length) % items.length
      const nextItem = items[next]
      if (!nextItem) return
      onChange(nextItem.value)
      refs.current[next]?.focus()
    },
    [items, onChange],
  )

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex items-stretch',
        withDivider && 'border-b border-[var(--color-divider-subtle)]',
        className,
      )}
    >
      {items.map((item, idx) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[idx] = el
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            style={
              active && item.activeColor
                ? { borderBottomColor: item.activeColor }
                : undefined
            }
            className={cn(
              'inline-flex h-10 items-center justify-center cursor-pointer',
              'pt-3 pb-[10px] px-3 -mb-px',
              'text-sm font-bold leading-none',
              'text-[rgba(0,0,0,0.8)]',
              'border-b-2 bg-transparent',
              active
                ? item.activeColor
                  ? ''
                  : 'border-[var(--color-tab-blue)]'
                : 'border-transparent',
              'transition-[border-color] duration-[250ms] [transition-timing-function:var(--ease-dex)]',
              'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]',
              'motion-reduce:transition-none',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
