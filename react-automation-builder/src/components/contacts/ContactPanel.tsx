import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DexAvatar, DexButton, DexButtonGroup, DexTag } from '@thryvlabs/dex-react'
import { Contact } from '../../data/mockData'
import { useStore } from '../../store/useStore'

interface Props {
  contact: Contact
}

const avatarColors = [
  '#4F7FBF', '#7B5EA7', '#3A8F5C', '#BF6B4F',
  '#5E8F8F', '#BF4F7F', '#4F5EBF', '#6B8F4F',
]

function getAvatarColor(id: string) {
  const idx = parseInt(id, 10) % avatarColors.length
  return avatarColors[idx] || '#9CA3AF'
}

function getInitials(contact: Contact): string {
  const first = contact.firstName?.[0] || ''
  const last = contact.lastName?.[0] || ''
  return (first + last).toUpperCase() || contact.email[0].toUpperCase()
}

const activityMock = [
  { text: 'Note created', contact: 'Admin', time: 'Apr 15, 2026 9:30 AM' },
  { text: 'Email sent: Welcome', contact: 'Admin', time: 'Apr 10, 2026 12:10 PM' },
  { text: 'Tag applied: New Lead', contact: 'Admin', time: 'Apr 9, 2026 3:00 PM' },
]

export default function ContactPanel({ contact }: Props) {
  const navigate = useNavigate()
  const setSelectedContact = useStore((s) => s.setSelectedContact)
  const [status, setStatus] = useState<Contact['status']>(contact.status)
  const [activityView, setActivityView] = useState<'list' | 'timeline'>('list')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    return () => setVisible(false)
  }, [contact.id])

  const close = () => {
    setVisible(false)
    setTimeout(() => {
      setSelectedContact(null)
      navigate('/contacts/list/all')
    }, 200)
  }

  const displayName =
    contact.firstName || contact.lastName
      ? `${contact.firstName} ${contact.lastName}`.trim()
      : contact.email

  const statusConfig: Record<Contact['status'], { dot: string; label: string }> = {
    Lead: { dot: '#E02500', label: 'Lead' },
    Client: { dot: '#1C831E', label: 'Client' },
    Other: { dot: '#9CA3AF', label: 'Other' },
  }

  const actionButtons = [
    { label: 'Call', icon: <PhoneIcon /> },
    { label: 'Text', icon: <TextIcon /> },
    { label: 'Email', icon: <EmailIcon /> },
    { label: 'Tag', icon: <TagIcon /> },
    { label: 'Note', icon: <NoteIcon /> },
    { label: 'More', icon: <MoreIcon /> },
  ]

  return (
    <div
      className={`contact-panel ${visible ? 'contact-panel-visible' : 'contact-panel-enter'}`}
      style={{
        width: 320,
        flexShrink: 0,
        background: '#fff',
        borderLeft: '1px solid #E7E7E7',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #E7E7E7',
        }}
      >
        {/* Status toggles */}
        <DexButtonGroup size="dense">
          {(['Lead', 'Client', 'Other'] as const).map((s) => {
            const active = s === status
            return (
              <DexButton
                key={s}
                size="dense"
                shape="pill"
                variant={active ? 'solid' : 'outline'}
                color="neutral"
                selected={active}
                onClick={() => setStatus(s)}
                leading={
                  active ? (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusConfig[s].dot, flexShrink: 0 }} />
                  ) : undefined
                }
              >
                {s}
              </DexButton>
            )
          })}
        </DexButtonGroup>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#006CEB', fontWeight: 600 }}>Info</span>
          <button onClick={close} style={{ color: '#9CA3AF', cursor: 'pointer', lineHeight: 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Avatar + Name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px 16px', borderBottom: '1px solid #E7E7E7' }}>
          <div style={{ marginBottom: 12 }}>
            <DexAvatar name={displayName} size={80} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#2C2C2C', margin: 0, textAlign: 'center' }}>{displayName}</h2>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 8px' }}>ID: {contact.id}</p>
          {contact.phone && (
            <a href={`tel:${contact.phone}`} style={{ fontSize: 14, color: '#006CEB', textDecoration: 'none', marginBottom: 3 }}>
              {contact.phone}
            </a>
          )}
          <a href={`mailto:${contact.email}`} style={{ fontSize: 12, color: '#006CEB', textDecoration: 'none', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 16px' }}>
            {contact.email}
          </a>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 8px', borderBottom: '1px solid #E7E7E7' }}>
          {actionButtons.map((action) => (
            <button
              key={action.label}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 6px',
                borderRadius: 10,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F4F4F7')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div
                style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: '#F4F4F7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {action.icon}
              </div>
              <span style={{ fontSize: 10, color: '#656565', fontWeight: 500 }}>{action.label}</span>
            </button>
          ))}
        </div>

        {/* Contact activity */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2C' }}>Contact activity</span>
            <div style={{ display: 'flex', gap: 2, background: '#F4F4F7', borderRadius: 8, padding: 2 }}>
              {(['list', 'timeline'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setActivityView(v)}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 6,
                    border: 'none',
                    background: activityView === v ? '#fff' : 'transparent',
                    boxShadow: activityView === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    color: '#656565', fontWeight: activityView === v ? 600 : 400,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {activityMock.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #F0F0F0' }}>
                <div style={{ width: 2, background: '#E7E7E7', borderRadius: 1, flexShrink: 0, margin: '2px 0' }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#2C2C2C', margin: 0 }}>{item.text}</p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        {contact.tags && contact.tags.length > 0 && (
          <div style={{ padding: '16px', borderTop: '1px solid #E7E7E7', marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2C' }}>Tags</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.75">
                <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.29-7.29a1 1 0 0 0 0-1.41z"/>
                <path d="M7 7h.01"/>
              </svg>
            </div>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>Added: {contact.dateAdded}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {contact.tags.map((tag) => (
                <DexTag key={tag} color="danger" variant="default" emphasis="low">
                  {tag}
                </DexTag>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#656565" strokeWidth="1.75">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12 19.79 19.79 0 0 1 1.57 3.4 2 2 0 0 1 3.54 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 6 6l.85-.85a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}
function TextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#656565" strokeWidth="1.75">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#656565" strokeWidth="1.75">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  )
}
function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#656565" strokeWidth="1.75">
      <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.29-7.29a1 1 0 0 0 0-1.41z"/>
      <path d="M7 7h.01"/>
    </svg>
  )
}
function NoteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#656565" strokeWidth="1.75">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
    </svg>
  )
}
function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#656565" strokeWidth="1.75">
      <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
    </svg>
  )
}
