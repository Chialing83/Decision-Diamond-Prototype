import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DexButton, DexField, DexFieldLabel, DexIconButton, DexInput } from '@thryvlabs/dex-react'
import { useStore } from '../../store/useStore'

const stages = ['New leads', 'Qualified leads', 'Quote sent', 'Negotiating', 'Won', 'Lost']

const colToStage: Record<string, string> = {
  'new-leads': 'New leads',
  'qualified-leads': 'Qualified leads',
  'quote-sent': 'Quote sent',
  'negotiating': 'Negotiating',
}

const dealActivityMock = [
  { text: 'Note created', by: 'Admin', time: 'Apr 15, 2026 at 9:30 AM', type: 'note' },
  { text: 'Deal created', by: 'Admin', time: 'Apr 10, 2026 at 11:00 AM', type: 'deal' },
]

export default function DealModal() {
  const { dealId, pipelineId } = useParams()
  const navigate = useNavigate()
  const deals = useStore((s) => s.deals)
  const setSelectedDeal = useStore((s) => s.setSelectedDeal)
  const [visible, setVisible] = useState(false)
  const [activeStage, setActiveStage] = useState<string>('')

  const deal = deals.find((d) => d.id === dealId)

  useEffect(() => {
    setSelectedDeal(dealId || null)
    if (deal) setActiveStage(colToStage[deal.column] || 'New leads')
    requestAnimationFrame(() => setVisible(true))
    return () => setSelectedDeal(null)
  }, [dealId])

  const close = () => {
    setVisible(false)
    setTimeout(() => navigate(`/pipeline/${pipelineId || '1'}/board`), 150)
  }

  if (!deal) return null

  const formatAmount = () => {
    if (isNaN(deal.amount)) return '—'
    return `${deal.currency || '$'}${deal.amount.toLocaleString()}`
  }

  const currentStageIdx = stages.indexOf(activeStage)

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        zIndex: 100, overflowY: 'auto',
        paddingTop: 48, paddingBottom: 48,
        opacity: visible ? 1 : 0,
        transition: 'opacity 150ms ease',
      }}
      onClick={close}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          width: '100%', maxWidth: 860,
          margin: '0 16px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #E7E7E7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DexIconButton variant="transparent" size="dense" label="Close" onClick={close}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </DexIconButton>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#4F7FBF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>
              {deal.contactName[0]}
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#2C2C2C', margin: 0 }}>{deal.contactName}</h2>
              {deal.dealName && <p style={{ fontSize: 12, color: '#656565', margin: 0 }}>{deal.dealName}</p>}
            </div>
          </div>
          <button style={{ color: '#9CA3AF', lineHeight: 1 }}>⋮</button>
        </div>

        {/* Stage pills row */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid #E7E7E7', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 'max-content' }}>
            <DexIconButton variant="transparent" size="dense" label="Previous stages">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </DexIconButton>
            {stages.map((stage, i) => {
              const isCurrent = stage === activeStage
              const isPast = i < currentStageIdx
              return (
                <React.Fragment key={stage}>
                  <DexButton
                    variant={isCurrent ? 'solid' : 'outline'}
                    color={isCurrent ? 'default' : isPast ? 'default' : 'neutral'}
                    shape="pill"
                    size="dense"
                    selected={isPast}
                    onClick={() => setActiveStage(stage)}
                  >
                    {stage}
                  </DexButton>
                  {i < stages.length - 1 && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  )}
                </React.Fragment>
              )
            })}
            <DexIconButton variant="transparent" size="dense" label="Next stages">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </DexIconButton>
          </div>
        </div>

        {/* Content: left + right */}
        <div style={{ display: 'flex', flex: 1 }}>
          {/* Left: main content */}
          <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', minHeight: 400 }}>
            {/* Action icons */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #F0F0F0' }}>
              {[
                { label: 'Notes', icon: '📝' },
                { label: 'Quote', icon: '📄' },
                { label: 'Invoice', icon: '🧾' },
                { label: 'Email', icon: '✉️' },
              ].map((a) => (
                <button
                  key={a.label}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '10px 16px', borderRadius: 10,
                    border: 'none', background: 'transparent', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F4F4F7')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F4F4F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {a.icon}
                  </div>
                  <span style={{ fontSize: 11, color: '#656565', fontWeight: 500 }}>{a.label}</span>
                </button>
              ))}
            </div>

            {/* Deal value */}
            <div style={{ background: '#F9F9F9', border: '1px solid #E7E7E7', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>Deal value</p>
              <p style={{ fontSize: 28, fontWeight: 300, color: '#2C2C2C', margin: 0 }}>{formatAmount()}</p>
            </div>

            {/* Deal activity */}
            <p style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 12 }}>Deal activity</p>

            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #F0F0F0' }}>
              Apr 15, 2026
            </div>

            {dealActivityMock.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #F9F9F9' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E7E7E7', flexShrink: 0, marginTop: 4 }} />
                <div>
                  <p style={{ fontSize: 13, color: '#2C2C2C', margin: 0 }}>
                    <span style={{ fontWeight: 600 }}>{item.text}</span>
                    {' by '}<span style={{ color: '#006CEB' }}>{item.by}</span>
                  </p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>{item.time}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right: deal info panel */}
          <div style={{ width: 320, borderLeft: '1px solid #E7E7E7', background: '#FAFAFA', padding: '20px 20px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2C' }}>Deal info</span>
              <button style={{ color: '#9CA3AF' }}>⋮</button>
            </div>

            {/* Contacts */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Contacts</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#4F7FBF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {deal.contactName[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2C', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.contactName}</p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Primary contact</p>
                </div>
                <button style={{ color: '#9CA3AF' }}>⋮</button>
              </div>
              <button style={{ fontSize: 12, color: '#006CEB' }}>+ Add a contact</button>
            </div>

            {/* Team members */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Team members</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#2E3D4C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>J</div>
                <button style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px dashed #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', background: 'transparent', cursor: 'pointer', fontSize: 16 }}>+</button>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#E7E7E7', margin: '16px 0' }} />

            {/* General info */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>General information</p>
              <div style={{ marginBottom: 10 }}>
                <DexField>
                  <DexFieldLabel htmlFor="deal-name">Deal name</DexFieldLabel>
                  <DexInput
                    id="deal-name"
                    label="Deal name"
                    labelHidden
                    defaultValue={deal.dealName || deal.contactName}
                  />
                </DexField>
              </div>
              <div>
                <DexField>
                  <DexFieldLabel htmlFor="dads-age">Dad's Age</DexFieldLabel>
                  <DexInput
                    id="dads-age"
                    label="Dad's Age"
                    labelHidden
                    placeholder="—"
                  />
                </DexField>
              </div>
            </div>

            <button style={{ fontSize: 12, color: '#006CEB' }}>Manage fields and layout</button>
          </div>
        </div>
      </div>
    </div>
  )
}
