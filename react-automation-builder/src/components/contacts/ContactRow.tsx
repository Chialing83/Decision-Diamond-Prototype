import React, { useState } from 'react'
import { DexAvatar } from '@thryvlabs/dex-react'
import { Contact } from '../../data/mockData'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'

interface Props {
  contact: Contact
  isSelected: boolean
}

function getInitials(contact: Contact): string {
  const first = contact.firstName?.[0] || ''
  const last = contact.lastName?.[0] || ''
  return (first + last).toUpperCase() || contact.email[0].toUpperCase()
}

const avatarColors = [
  '#4F7FBF', '#7B5EA7', '#3A8F5C', '#BF6B4F',
  '#5E8F8F', '#BF4F7F', '#4F5EBF', '#6B8F4F',
]

function getAvatarColor(id: string) {
  const idx = parseInt(id, 10) % avatarColors.length
  return avatarColors[idx] || '#9CA3AF'
}

const statusDotColor: Record<Contact['status'], string> = {
  Lead: '#E02500',
  Client: '#1C831E',
  Other: '#9CA3AF',
}

export default function ContactRow({ contact, isSelected }: Props) {
  const navigate = useNavigate()
  const setSelectedContact = useStore((s) => s.setSelectedContact)
  const [hovered, setHovered] = useState(false)

  const handleClick = () => {
    setSelectedContact(contact.id)
    navigate(`/contacts/list/all/contact/${contact.id}`)
  }

  const displayName =
    contact.firstName || contact.lastName
      ? `${contact.firstName} ${contact.lastName}`.trim()
      : contact.email

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        cursor: 'pointer',
        borderBottom: '1px solid #E7E7E7',
        borderLeft: isSelected ? '3px solid #006CEB' : '3px solid transparent',
        background: isSelected ? 'rgba(0,108,235,0.04)' : hovered ? 'rgba(0,0,0,0.02)' : '#fff',
        transition: 'background 100ms ease',
      }}
    >
      {/* Avatar */}
      <div style={{ flexShrink: 0 }}>
        <DexAvatar name={displayName} size={40} />
      </div>

      {/* Name + Email */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
          {displayName}
        </p>
        <p style={{ fontSize: 12, color: '#656565', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contact.email}
        </p>
      </div>

      {/* Date added */}
      <div style={{ fontSize: 12, color: '#656565', flexShrink: 0, width: 120, textAlign: 'right' }}>
        Added {contact.dateAdded}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: 72, justifyContent: 'flex-end', flexShrink: 0 }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: statusDotColor[contact.status],
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 12, color: '#656565', fontWeight: 500 }}>{contact.status}</span>
      </div>
    </div>
  )
}
