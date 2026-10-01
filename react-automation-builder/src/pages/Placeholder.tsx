import React from 'react'
import { useLocation } from 'react-router-dom'

export default function Placeholder() {
  const location = useLocation()
  const title = location.pathname
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' › ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: 48, background: '#F4F4F7' }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: '#FFF3F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E02500" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <path d="M9 9h6M9 13h6M9 17h3"/>
        </svg>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2C2C2C', marginBottom: 8 }}>{title || 'Page'}</h1>
      <p style={{ fontSize: 14, color: '#9CA3AF' }}>This section is under construction.</p>
    </div>
  )
}
