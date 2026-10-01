import React, { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { DexBox, DexButton, DexIconButton, DexTabs, DexTabsList, DexTabsTrigger, DexTag } from '@thryvlabs/dex-react'
import KanbanBoard from '../components/pipeline/KanbanBoard'

export default function Pipeline() {
  const navigate = useNavigate()
  const [view, setView] = useState<'board' | 'list'>('board')

  return (
    <DexBox style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#F4F4F7' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E7E7E7', padding: '14px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <DexIconButton variant="transparent" size="dense" label="Back" onClick={() => navigate(-1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </DexIconButton>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2C2C2C', margin: 0 }}>My Pipeline</h1>
          <div style={{ flex: 1 }} />
          <DexButton
            variant="solid"
            color="default"
            size="dense"
            leading={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            }
          >
            Add new
          </DexButton>
          <DexIconButton variant="transparent" size="dense" label="More actions">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </DexIconButton>
        </div>

        {/* Tabs + filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <DexTabs value={view} onValueChange={(v) => setView(v as 'board' | 'list')} defaultValue="board">
            <DexTabsList>
              <DexTabsTrigger value="board">Board</DexTabsTrigger>
              <DexTabsTrigger value="list">List</DexTabsTrigger>
            </DexTabsList>
          </DexTabs>

          {/* Filter chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
            <DexTag color="gray" variant="outline" onRemove={() => { /* clear filter */ }}>
              Status = Active
            </DexTag>
            <button style={{ fontSize: 13, color: '#006CEB' }}>+ Add filter</button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {view === 'board' ? (
          <KanbanBoard />
        ) : (
          <div style={{ background: '#FAFAFA', border: '1px solid #E7E7E7', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
            List view coming soon
          </div>
        )}
      </div>

      <Outlet />
    </DexBox>
  )
}
