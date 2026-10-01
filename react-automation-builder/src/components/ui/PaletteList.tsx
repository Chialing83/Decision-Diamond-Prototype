import React from 'react'
import { cn } from './cn'
import { PaletteRow } from './PaletteRow'
import type { CellType, PaletteCell } from './PaletteRow'

export interface PaletteListProps {
  type: CellType
  cells: readonly PaletteCell[]
  /** Optional click/keyboard fallback per cell. Triggered on row click or
   *  Enter/Space — the canvas should add the cell at a default position. */
  onCellActivate?: (cell: PaletteCell) => void
  /** Rendered when `cells` is empty. Defaults to a neutral "No matches". */
  emptyState?: React.ReactNode
  className?: string
}

/** Scrollable container for `PaletteRow`s. Matches the DEX reference's
 *  `padding-bottom: 3.4375rem` (55px) so the last row clears the bottom
 *  toolbar when the list overflows. */
export function PaletteList({
  type,
  cells,
  onCellActivate,
  emptyState,
  className,
}: PaletteListProps) {
  if (cells.length === 0) {
    return (
      <div
        role="list"
        aria-label={`${type} palette`}
        className={cn('h-full overflow-y-auto pb-14', className)}
      >
        {emptyState ?? (
          <div className="px-5 py-5 text-center text-sm text-[var(--color-icon-muted)]">
            No matches
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      role="list"
      aria-label={`${type} palette`}
      className={cn('h-full overflow-y-auto pb-14', className)}
    >
      {cells.map((c) => (
        <PaletteRow
          key={c.name}
          type={type}
          {...c}
          onActivate={onCellActivate ? () => onCellActivate(c) : undefined}
        />
      ))}
    </div>
  )
}
