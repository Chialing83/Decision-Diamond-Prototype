import React, { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { kanbanColumns } from '../../data/mockData'
import { useStore } from '../../store/useStore'
import KanbanColumn from './KanbanColumn'
import DealCard from './DealCard'

export default function KanbanBoard() {
  const { deals, moveDeal } = useStore()
  const [activeDealId, setActiveDealId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const activeDeal = activeDealId ? deals.find((d) => d.id === activeDealId) : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDealId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDealId(null)

    if (!over) return
    const dealId = String(active.id)
    const overId = String(over.id)

    const deal = deals.find((d) => d.id === dealId)
    if (!deal) return

    // Check if dropped over a column
    const targetColumn = kanbanColumns.find((col) => col.id === overId)
    if (targetColumn) {
      moveDeal(dealId, targetColumn.id)
      return
    }

    // Check if dropped over another deal
    const targetDeal = deals.find((d) => d.id === overId)
    if (targetDeal && targetDeal.column !== deal.column) {
      moveDeal(dealId, targetDeal.column)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-full">
        {kanbanColumns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            deals={deals.filter((d) => d.column === col.id)}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} overlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
