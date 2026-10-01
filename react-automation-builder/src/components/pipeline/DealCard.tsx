import React, { useState } from 'react'
import { DexAvatar } from '@thryvlabs/dex-react'
import { Deal } from '../../data/mockData'
import { useStore } from '../../store/useStore'
import { useNavigate, useParams } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Props {
  deal: Deal
  overlay?: boolean
}

const avatarColors = [
  '#4F7FBF', '#7B5EA7', '#3A8F5C', '#BF6B4F',
  '#5E8F8F', '#BF4F7F', '#4F5EBF', '#6B8F4F',
]

function getAvatarColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + hash * 31
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0] || '').slice(0, 2).join('').toUpperCase()
}

function formatAmount(deal: Deal): string {
  if (isNaN(deal.amount)) return '—'
  const prefix = deal.currency || '$'
  return `${prefix}${deal.amount.toLocaleString()}`
}

export default function DealCard({ deal, overlay }: Props) {
  const { pipelineId } = useParams()
  const navigate = useNavigate()
  const setSelectedDeal = useStore((s) => s.setSelectedDeal)
  const [hovered, setHovered] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !overlay ? 0.25 : 1,
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDeal(deal.id)
    navigate(`/pipeline/${pipelineId || '1'}/board/deal/${deal.id}`)
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: '#fff',
        border: `1px solid ${hovered ? '#C0D4EF' : '#E7E7E7'}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'grab',
        boxShadow: hovered ? '0 3px 10px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'box-shadow 150ms ease, border-color 150ms ease',
        userSelect: 'none',
        marginBottom: 6,
      }}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Contact chip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flexShrink: 0 }}>
            <DexAvatar name={deal.contactName} size={24} />
          </div>
          <span style={{ fontSize: 12, color: '#2C2C2C', fontWeight: 500 }}>{deal.contactName}</span>
        </div>
        <span style={{ fontSize: 12, color: '#656565', fontWeight: 500 }}>
          {formatAmount(deal)}
        </span>
      </div>

      {deal.dealName && (
        <p style={{ fontSize: 13, color: '#2C2C2C', margin: '6px 0 0', paddingLeft: 30 }}>
          {deal.dealName}
        </p>
      )}
    </div>
  )
}
