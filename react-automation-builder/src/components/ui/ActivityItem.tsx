import React from 'react'
import { Activity } from '../../data/mockData'

interface Props {
  activity: Activity
}

function typeLabel(type: Activity['type']) {
  switch (type) {
    case 'email': return 'Email sent'
    case 'tag': return 'Tag applied'
    case 'note': return 'Note created'
    case 'call': return 'Call logged'
  }
}

function TypeIcon({ type }: { type: Activity['type'] }) {
  const color = '#656565'
  switch (type) {
    case 'email':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
      )
    case 'tag':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75">
          <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.29-7.29a1 1 0 0 0 0-1.41z"/>
          <path d="M7 7h.01"/>
        </svg>
      )
    case 'note':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
        </svg>
      )
    case 'call':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12 19.79 19.79 0 0 1 1.57 3.4 2 2 0 0 1 3.54 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 6 6l.85-.85a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
      )
  }
}

export default function ActivityItem({ activity }: Props) {
  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: '1px solid #F0F0F0' }}>
      <div
        className="flex items-center justify-center rounded-full flex-shrink-0 mt-0.5"
        style={{ width: 32, height: 32, background: '#F4F4F7' }}
      >
        <TypeIcon type={activity.type} />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 13, color: '#2C2C2C', lineHeight: 1.4 }}>
          <span style={{ fontWeight: 600 }}>{typeLabel(activity.type)}</span>
          {' '}to{' '}
          <span style={{ color: '#006CEB', cursor: 'pointer' }}>{activity.contactName}</span>
        </p>
        {activity.subject && (
          <p style={{ fontSize: 12, color: '#656565', marginTop: 2 }}>
            {activity.subject}
          </p>
        )}
      </div>
      <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{activity.time}</span>
    </div>
  )
}
