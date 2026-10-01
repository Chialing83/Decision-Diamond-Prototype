import React, { forwardRef } from 'react'
import { cn } from './cn'

export type IconButtonSize = 'sm' | 'md'

/** Named variant set. `default` is the base gray→ink hover circular control;
 *  `card-footer` matches the exact spec for KPI card +/→ buttons. */
export type IconButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'card-footer'
  | 'pager'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — icon buttons have no visible text. */
  'aria-label': string
  size?: IconButtonSize
  variant?: IconButtonVariant
}

const base =
  'inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] motion-reduce:transition-none'

/** Default geometry: 32px on touch (bumps to 44px on sm), or 40px for `md`.
 *  `card-footer` ignores these in favor of a strict 32×32 square. */
const sizes: Record<IconButtonSize, string> = {
  sm: 'h-8 w-8 sm:h-11 sm:w-11',
  md: 'h-10 w-10',
}

const variants: Record<IconButtonVariant, string> = {
  default:
    'rounded-full text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed',
  primary:
    'rounded-full bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'rounded-full bg-surface text-accent border border-border-strong hover:bg-canvas disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'rounded-full bg-transparent text-accent hover:bg-accent/5 disabled:opacity-50 disabled:cursor-not-allowed',
  danger:
    'rounded-full bg-danger text-white hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed',
  // Per Addendum C: strict 32×32, 8px padding (giving a 16×16 icon box),
  // `rounded-btn`, no background, accent icon color, subtle blue hover tint.
  'card-footer':
    'h-8 w-8 p-2 rounded-btn bg-transparent text-accent hover:bg-accent/5 disabled:opacity-40 disabled:pointer-events-none',
  // Per Addendum E: same 32×32 geometry as card-footer, but neutral ink color
  // (not blue) so the prev/next pager reads as plumbing between the blue +/→
  // CTAs. Transition explicitly matches the reference's 250ms ease-out curve.
  // `aria-expanded:bg-[...]` mirrors the active overlay when the button opens
  // a popover (harmless for simple pager usage).
  pager:
    'h-8 w-8 p-2 rounded-btn bg-transparent text-ink ' +
    'transition-[background-color,box-shadow,border-color,color,stroke] duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)] ' +
    'hover:bg-[var(--color-hover-overlay-subtle)] active:bg-[var(--color-active-overlay)] aria-expanded:bg-[var(--color-active-overlay)] ' +
    'disabled:text-ink-disabled disabled:cursor-default disabled:pointer-events-none',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'sm', variant = 'default', className, type = 'button', children, ...rest },
  ref,
) {
  // `card-footer` owns its own sizing (strict 32×32, no touch bump). All other
  // variants pick up the standard size classes.
  const applySize = variant !== 'card-footer' && variant !== 'pager'
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, applySize && sizes[size], variants[variant], className)}
      {...rest}
    >
      {children}
    </button>
  )
})
