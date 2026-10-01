import React from 'react'
import { cn } from './cn'

/** Automation / marketing record status. Extend per product needs. */
export type StatusBadgeStatus = 'draft' | 'published' | 'active' | 'disabled' | 'paused' | 'error'

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusBadgeStatus
  /** Optional override label; defaults to capitalized status. */
  label?: string
}

/** Per Addendum F §7: 16px tall, 4px h-padding, 2px radius, 12/500/white.
 *  Deliberately near-square — do NOT use rounded-pill. */
const STATUS_BG: Record<StatusBadgeStatus, string> = {
  draft: 'bg-status-neutral',
  published: 'bg-status-success',
  active: 'bg-status-success',
  disabled: 'bg-status-neutral',
  paused: 'bg-amber-600',
  error: 'bg-danger',
}

export function StatusBadge({ status, label, className, ...rest }: StatusBadgeProps) {
  const text = label ?? status[0].toUpperCase() + status.slice(1)
  return (
    <span
      className={cn(
        'inline-flex items-center h-4 px-1 rounded-[2px] text-[12px] font-medium leading-none text-white',
        STATUS_BG[status],
        className,
      )}
      {...rest}
    >
      {text}
    </span>
  )
}
