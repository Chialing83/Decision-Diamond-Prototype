import React, { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'filled-gray'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-btn font-semibold transition-colors focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] disabled:opacity-50 disabled:cursor-not-allowed motion-reduce:transition-none'

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover active:bg-accent-hover',
  secondary: 'bg-surface text-accent border border-border-strong hover:bg-canvas',
  ghost: 'bg-transparent text-accent hover:bg-accent/5',
  danger: 'bg-danger text-white hover:brightness-95',
  // Per Addendum F — neutral filled-gray CTA (e.g. "Category" dropdown).
  'filled-gray':
    'bg-filled-gray text-ink hover:bg-[var(--color-filled-gray-hover)] active:bg-[var(--color-filled-gray-active)]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    className,
    disabled,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        base,
        sizes[size],
        variants[variant],
        fullWidth && 'w-full',
        'min-w-8',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
      ) : (
        <>
          {leftIcon ? <span aria-hidden="true" className="inline-flex">{leftIcon}</span> : null}
          {children}
          {rightIcon ? <span aria-hidden="true" className="inline-flex">{rightIcon}</span> : null}
        </>
      )}
    </button>
  )
})
