import React, { forwardRef } from 'react'
import { cn } from './cn'

export interface PaletteSearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  /** Optional wrapper className for layout positioning. */
  wrapperClassName?: string
}

/** 40px-tall search input for palette/list surfaces. Matches DEX extracted
 *  spec exactly: `padding: 8px 16px 8px 40px`, 8px radius, 1px
 *  `--color-input-border` border. Focus flips the border to
 *  `--color-link-blue` (#006CEB) with NO extra shadow/ring. Placeholder is
 *  `--color-input-placeholder` (60% black).
 *
 *  The leading magnifier uses the DEX two-tone pattern: lens body filled with
 *  40%-black, stroke in 80%-black. Rendered inline as SVG so both fills are
 *  applied on the same glyph (lucide can't express two-tone without splitting
 *  paths). Icon is 24×24, vertically centered at `left: 12px`. */
export const PaletteSearchInput = forwardRef<HTMLInputElement, PaletteSearchInputProps>(
  function PaletteSearchInput({ className, wrapperClassName, placeholder, ...rest }, ref) {
    return (
      <div className={cn('relative w-full', wrapperClassName)}>
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-icon-strong)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={ref}
          type="search"
          placeholder={placeholder}
          className={cn(
            'block h-10 w-full rounded-md bg-surface py-2 pl-10 pr-4 text-sm leading-none text-ink',
            'border border-[var(--color-input-border)]',
            'placeholder:text-[var(--color-input-placeholder)]',
            'transition-[border-color] duration-[250ms] [transition-timing-function:var(--ease-dex)]',
            'focus:outline-none focus:border-[var(--color-link-blue)] focus:shadow-none focus:ring-0',
            'motion-reduce:transition-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
          {...rest}
        />
      </div>
    )
  },
)
