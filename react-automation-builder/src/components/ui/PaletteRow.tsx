import React from 'react'
import { Move } from 'lucide-react'
import { cn } from './cn'

export type CellType = 'when' | 'then'

export interface PaletteCell {
  /** Machine id used by the canvas to instantiate the node. */
  name: string
  /** Human label rendered in the row + carried in the drag payload. */
  defaultName: string
  /** Leading 24x24 glyph. */
  icon: React.ReactNode
  /** Optional trailing badge (e.g. "New"). */
  badge?: React.ReactNode
}

export interface PaletteRowProps extends PaletteCell {
  type: CellType
  /** Keyboard / click fallback for users who can't drag. Invoked on
   *  click and on Enter/Space. */
  onActivate?: () => void
  className?: string
}

/** One-way HTML5 drag SOURCE row for the When/Then palette. Pixel-matches the
 *  reference DEX `.draggable-cell`:
 *
 *  - 49px tall, 12px/16px padding, `cursor: pointer`, `user-select: none`
 *  - 1px bottom divider in `--color-divider-subtle` (rgba(0,0,0,0.09))
 *  - 14/400 label in 82%-black
 *  - 24×24 leading icon slot, 12px gap to label
 *  - Trailing 24×24 lucide `Move` icon, `#656565`, `opacity 0 → 1` on row
 *    hover, 150ms ease fade (gated by `prefers-reduced-motion`).
 *  - NO background/transform/shadow change on hover. NO drag styling on the
 *    source — the browser-generated ghost is the only drag feedback.
 *
 *  The drag payload is carried on `dataTransfer` under three MIME-ish keys
 *  the canvas expects: `celltype` / `cellname` / `celldefaultname`. */
export function PaletteRow({
  type,
  name,
  defaultName,
  icon,
  badge,
  onActivate,
  className,
}: PaletteRowProps) {
  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('celltype', type)
    e.dataTransfer.setData('cellname', name)
    e.dataTransfer.setData('celldefaultname', defaultName)
    // Intentionally no setDragImage — the browser snapshot is the ghost.
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!onActivate) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onActivate()
    }
  }

  return (
    <div
      role="listitem"
      tabIndex={0}
      draggable
      onDragStart={handleDragStart}
      onClick={onActivate}
      onKeyDown={handleKeyDown}
      data-cell-name={name}
      className={cn(
        'group relative flex items-center select-none',
        'h-[var(--row-cell-h)] px-[var(--row-cell-px)] py-[var(--row-cell-py)] gap-3',
        'border-b border-[var(--color-divider-subtle)]',
        'text-sm font-normal leading-none text-ink',
        'cursor-pointer bg-transparent',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center"
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1 truncate">{defaultName}</span>

      {badge}

      <span
        aria-label={onActivate ? 'Drag onto canvas to add' : undefined}
        className={cn(
          'inline-flex h-6 w-6 flex-shrink-0 items-center justify-center',
          'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
          'transition-opacity duration-150 ease-out motion-reduce:transition-none',
        )}
      >
        <Move
          size={24}
          strokeWidth={1.5}
          className="text-[var(--color-icon-muted)]"
          aria-hidden="true"
        />
      </span>
    </div>
  )
}
