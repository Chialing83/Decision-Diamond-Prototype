import React, { forwardRef } from 'react'
import { X } from 'lucide-react'
import { cn } from './cn'

export interface DismissButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Optional override; defaults to "Dismiss". */
  'aria-label'?: string
  /** Icon size in px. Defaults to 24 per DEX ds-icon-button geometry. */
  iconSize?: number
}

/** 40×40 ghost dismiss (X) button — matches DEX `ds-icon-button` ghost variant:
 *  8px padding, 8px radius, transparent background, 24×24 X icon in
 *  `--color-icon-strong`. Hover applies a 2%-black tint; active a 9%-black
 *  tint. Icon color never changes on hover. Transition uses the DEX
 *  250ms `--ease-dex` curve. */
export const DismissButton = forwardRef<HTMLButtonElement, DismissButtonProps>(
  function DismissButton(
    { className, iconSize = 24, 'aria-label': ariaLabel = 'Dismiss', type = 'button', ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-md p-2 bg-transparent',
          'text-[var(--color-icon-strong)]',
          'transition-[background-color,box-shadow,border-color] duration-[250ms] [transition-timing-function:var(--ease-dex)]',
          'hover:bg-[var(--color-overlay-hover)] active:bg-[var(--color-overlay-active)]',
          'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]',
          'motion-reduce:transition-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        )}
        {...rest}
      >
        <X size={iconSize} strokeWidth={1.75} aria-hidden="true" />
      </button>
    )
  },
)
