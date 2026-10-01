import React from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { cn } from './cn'

/** Per Addendum F §6 — primitive building blocks for the automations list and
 *  other paged tables. Provides typography/density/borders only; callers own
 *  the <tbody> rows so we don't re-invent row-state management here. */

export type SortDirection = 'asc' | 'desc' | 'none'

export interface DataTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Accessible label, rendered as a visually-hidden <caption>. */
  label: string
}

/** Shell — border-collapse + full width. Callers pass <thead>/<tbody> children. */
export function DataTable({ label, className, children, ...rest }: DataTableProps) {
  return (
    <table className={cn('w-full border-collapse', className)} {...rest}>
      <caption className="sr-only">{label}</caption>
      {children}
    </table>
  )
}

export interface ThProps extends Omit<React.ThHTMLAttributes<HTMLTableCellElement>, 'onClick'> {
  sortable?: boolean
  sort?: SortDirection
  onSort?: () => void
}

/** Sortable headers: weight 400 + tri-state icon; non-sortable: weight 600, no
 *  icon. Text color text-ink, 16px padding, 1px row-divider underline. */
export function Th({
  sortable,
  sort = 'none',
  onSort,
  className,
  children,
  scope = 'col',
  ...rest
}: ThProps) {
  const Icon =
    sort === 'asc' ? ChevronUp : sort === 'desc' ? ChevronDown : ChevronsUpDown
  const ariaSort: React.AriaAttributes['aria-sort'] = sortable
    ? sort === 'asc'
      ? 'ascending'
      : sort === 'desc'
        ? 'descending'
        : 'none'
    : undefined

  return (
    <th
      scope={scope}
      aria-sort={ariaSort}
      className={cn(
        'p-4 text-left text-sm text-ink border-b border-row-divider',
        sortable ? 'font-normal' : 'font-semibold',
        className,
      )}
      {...rest}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className="inline-flex items-center gap-1 text-left font-inherit focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] rounded-btn"
        >
          <span>{children}</span>
          <Icon
            size={14}
            strokeWidth={2}
            className={sort === 'none' ? 'opacity-60' : 'opacity-100'}
            aria-hidden="true"
          />
        </button>
      ) : (
        <span className="inline-flex items-center gap-1">{children}</span>
      )}
    </th>
  )
}

export interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Visual selected state toggles the row background. */
  selected?: boolean
  /** When true, the row advertises itself as clickable (pointer + hover bg). */
  interactive?: boolean
}

/** Uniform bottom-border, hover tint, and 150ms transition per spec. */
export function Row({
  selected,
  interactive,
  className,
  children,
  ...rest
}: RowProps) {
  return (
    <tr
      className={cn(
        'border-b border-row-divider transition-colors duration-[150ms] motion-reduce:transition-none',
        interactive && 'cursor-pointer hover:bg-hover-overlay',
        selected && 'bg-hover-overlay',
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  )
}

/** 8 skeleton rows — callers pass the column count so the colSpan matches. */
export function DataTableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr
          key={i}
          aria-hidden="true"
          className="border-b border-row-divider"
        >
          <td colSpan={columns} className="h-[73px] p-4">
            <div className="h-4 w-[60%] rounded bg-row-divider/60 animate-pulse motion-reduce:animate-none" />
          </td>
        </tr>
      ))}
    </>
  )
}
