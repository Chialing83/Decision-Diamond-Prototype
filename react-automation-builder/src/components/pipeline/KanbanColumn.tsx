import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { DexLink, DexProgress } from '@thryvlabs/dex-react'
import { Deal } from '../../data/mockData'
import DealCard from './DealCard'

interface Column {
  id: string
  label: string
  totalAmount: number
  totalDeals: number
  goal: number | null
}

interface Props {
  column: Column
  deals: Deal[]
}

export default function KanbanColumn({ column, deals }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  const colTotal = deals.reduce((sum, d) => sum + (isNaN(d.amount) ? 0 : d.amount), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 280, flexShrink: 0 }}>
      {/* Column header card */}
      <div
        style={{
          background: '#FAFAFA',
          border: '1px solid #E7E7E7',
          borderRadius: 12,
          padding: '14px 16px 12px',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#2C2C2C', margin: 0 }}>{column.label}</h3>
            <p style={{ fontSize: 12, color: '#656565', margin: '3px 0 0' }}>
              ${colTotal.toLocaleString()}
              {column.goal ? ` / $${column.goal.toLocaleString()} goal` : ''}
              {' · '}{deals.length} deal{deals.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E02500" strokeWidth="1.75">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <button style={{ color: '#9CA3AF', lineHeight: 1 }}>⋮</button>
          </div>
        </div>

        {column.goal && (
          <div style={{ marginTop: 8 }}>
            <DexProgress
              progress={Math.min(100, (colTotal / column.goal) * 100)}
              color="danger"
              ariaLabel={`${column.label} progress toward goal`}
            />
          </div>
        )}
      </div>

      {/* Cards drop zone */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          minHeight: 80,
          padding: '4px 0',
          borderRadius: 8,
          background: isOver ? 'rgba(0,108,235,0.04)' : 'transparent',
          outline: isOver ? '2px dashed #006CEB' : 'none',
          transition: 'background 150ms ease, outline 150ms ease',
        }}
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </SortableContext>
      </div>

      {/* Footer actions */}
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '7px 4px' }}>
        <DexLink
          as="button"
          leadingIcon="add"
        >
          Add a deal
        </DexLink>
        <button
          style={{
            width: '100%', textAlign: 'left',
            fontSize: 12, color: '#9CA3AF',
            padding: '5px 4px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#656565')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Edit automation
        </button>
      </div>
    </div>
  )
}
