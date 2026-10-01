import React, { forwardRef } from 'react'
import { ArrowLeftToLine, ArrowRightToLine } from 'lucide-react'
import { cn } from './cn'

export interface SidebarCollapseToggleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'aria-controls'> {
  /** Current panel state. Drives icon + chrome + absolute `left`. */
  collapsed: boolean
  /** id of the sidebar panel this button controls. */
  'aria-controls': string
  /** Offset variant per the reference: sequence-edit mode uses a slightly
   *  higher top value. */
  variant?: 'default' | 'sequence'
  /** Optional override (screen reader announces the resulting action). */
  'aria-label'?: string
}

/** Sidebar collapse/expand toggle. Absolutely positioned; its containing
 *  block must be `position: relative`. The button and the sidebar are
 *  SIBLINGS — placing the toggle inside the sidebar would clip it once the
 *  panel animates to `width: 0`.
 *
 *  Motion contract (Addendum J):
 *   - Sidebar panel width transitions over `--sidebar-anim-duration` (500ms,
 *     `ease-out`) — owned by the parent.
 *   - This button's `left` transitions over `--toggle-anim-duration` (600ms),
 *     intentionally ~100ms slower so the toggle "trails" the panel edge.
 *   - Background / shadow transition over 250ms `--ease-dex` for the
 *     collapsed-state chrome swap.
 *
 *  Chrome:
 *   - Expanded → transparent background, no shadow.
 *   - Collapsed → white background, `--shadow-overlay-1` elevation.
 *   - Icon color stays `--color-icon-strong` in both states.
 *   - Icon glyph SWAPS paths (ArrowLeftToLine → ArrowRightToLine); no CSS
 *     `scaleX(-1)` transform — the reference uses distinct `<path d>`s.
 *
 *  Accessibility:
 *   - `aria-expanded` mirrors panel state (true = open).
 *   - `aria-controls` ties the button to its panel.
 *   - `aria-label` describes the resulting action ("Expand sidebar" when
 *     collapsed, "Collapse sidebar" when expanded). */
export const SidebarCollapseToggle = forwardRef<HTMLButtonElement, SidebarCollapseToggleProps>(
  function SidebarCollapseToggle(
    {
      collapsed,
      variant = 'default',
      className,
      style,
      type = 'button',
      'aria-label': ariaLabel,
      'aria-controls': ariaControls,
      ...rest
    },
    ref,
  ) {
    const Icon = collapsed ? ArrowRightToLine : ArrowLeftToLine
    const label = ariaLabel ?? (collapsed ? 'Expand sidebar' : 'Collapse sidebar')
    return (
      <button
        ref={ref}
        type={type}
        data-qa="toggle-collapse"
        aria-label={label}
        aria-expanded={!collapsed}
        aria-controls={ariaControls}
        className={cn(
          'absolute z-10 inline-flex h-8 w-8 items-center justify-center p-1 rounded-[20%]',
          'text-[color:var(--color-icon-strong)]',
          collapsed
            ? 'bg-white shadow-[var(--shadow-overlay-1)]'
            : 'bg-transparent shadow-none',
          // Dual-timing transition: `left` uses the dedicated toggle token
          // (trails the panel's shorter width transition by ~10%); chrome
          // props use 250ms.
          'transition-[left,background-color,box-shadow]',
          '[transition-duration:var(--toggle-anim-duration),250ms,250ms]',
          '[transition-timing-function:var(--ease-dex),var(--ease-dex),var(--ease-dex)]',
          'hover:bg-[color:var(--color-overlay-hover)]',
          'active:bg-[color:var(--color-overlay-active)]',
          'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]',
          'motion-reduce:transition-none',
          className,
        )}
        style={{
          top:
            variant === 'sequence'
              ? 'var(--toggle-top-sequence)'
              : 'var(--toggle-top)',
          left: collapsed
            ? 'var(--toggle-collapsed-left)'
            : 'calc(var(--sidebar-width) - 2.75rem)',
          ...style,
        }}
        {...rest}
      >
        <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
      </button>
    )
  },
)
