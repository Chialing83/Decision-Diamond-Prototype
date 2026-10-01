import React, { useState } from 'react'
import { DexTableButtonCell, DexTableCell, DexTableRow } from '@thryvlabs/dex-react'
import { Form } from '../../data/mockData'

interface Props {
  form: Form
}

export default function FormRow({ form }: Props) {
  const [hovered, setHovered] = useState(false)

  return (
    <DexTableRow
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <DexTableCell>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#006CEB" strokeWidth="1.75">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 500, color: hovered ? '#006CEB' : '#2C2C2C', cursor: 'pointer', transition: 'color 100ms' }}>
            {form.name}
          </span>
        </div>
      </DexTableCell>
      <DexTableCell>{form.dateCreated}</DexTableCell>
      <DexTableCell>{form.lastEdited}</DexTableCell>
      <DexTableButtonCell alignX="center">
        <button
          style={{ color: '#9CA3AF', padding: 4, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#E02500'; e.currentTarget.style.background = '#FDE7E6' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'transparent' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </button>
      </DexTableButtonCell>
      <DexTableButtonCell alignX="right">
        <button style={{ color: '#9CA3AF', lineHeight: 1 }}>⋮</button>
      </DexTableButtonCell>
    </DexTableRow>
  )
}
