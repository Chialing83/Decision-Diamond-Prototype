import React, { useState } from 'react'
import { DexAvatar, DexStatus } from '@thryvlabs/dex-react'
import { Message } from '../../data/mockData'

interface Props {
  message: Message
  isSelected: boolean
  onClick: () => void
}

export default function MessageRow({ message, isSelected, onClick }: Props) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px',
        cursor: 'pointer',
        borderBottom: '1px solid #E7E7E7',
        borderLeft: isSelected ? '3px solid #006CEB' : '3px solid transparent',
        background: isSelected ? 'rgba(0,108,235,0.04)' : hovered ? '#F9F9F9' : '#fff',
        transition: 'background 100ms ease',
      }}
    >
      {/* Avatar */}
      <div style={{ flexShrink: 0 }}>
        <DexAvatar name={message.contact} size={40} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <p style={{ fontSize: 14, fontWeight: message.unread ? 700 : 500, color: '#2C2C2C', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {message.contact}
          </p>
          <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0, marginLeft: 8 }}>{message.date}</span>
        </div>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {message.preview}
        </p>
      </div>

      {message.unread && (
        <div style={{ flexShrink: 0 }} aria-label="Unread">
          <DexStatus variant="info" emphasis="high" aria-hidden="true"> </DexStatus>
        </div>
      )}
    </div>
  )
}
