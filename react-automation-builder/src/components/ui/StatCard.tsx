import React from 'react'
import { DexCard, DexCardTitle, DexIconButton } from '@thryvlabs/dex-react'

interface StatCardProps {
  title: string
  timeFilter?: string
  metricLabel?: string
  value: string | number
  prefix?: string
  extraContent?: React.ReactNode
}

export default function StatCard({ title, timeFilter, metricLabel, value, prefix = '', extraContent }: StatCardProps) {
  return (
    <DexCard
      elevation="subtle"
      onClick={() => { /* card click placeholder */ }}
      style={{
        padding: '16px 18px 14px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 190,
      }}
    >
      {/* Header: title + kebab */}
      <div className="flex items-start justify-between">
        <DexCardTitle>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-gray-900)', lineHeight: 1.25 }}>
            {title}
          </span>
        </DexCardTitle>
        <DexIconButton
          variant="transparent"
          size="dense"
          label="More actions"
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>
          </svg>
        </DexIconButton>
      </div>

      {/* Subtitle (time range) */}
      {timeFilter && (
        <span style={{ fontSize: 12, color: 'var(--color-gray-800)', marginTop: 2 }}>
          {timeFilter}
        </span>
      )}

      {/* Metric label */}
      {metricLabel && (
        <span style={{ fontSize: 13, color: 'var(--color-gray-800)', marginTop: 14 }}>
          {metricLabel}
        </span>
      )}

      {/* Big number */}
      <div
        style={{
          fontSize: 48,
          fontWeight: 400,
          color: 'var(--color-gray-900)',
          lineHeight: 1.05,
          margin: '2px 0 0',
          letterSpacing: '-0.02em',
        }}
      >
        {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
      </div>

      {extraContent}

      {/* Footer actions */}
      <div className="flex items-center justify-between" style={{ marginTop: 'auto', paddingTop: 14 }}>
        <DexIconButton
          variant="outline"
          size="dense"
          label="Add"
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </DexIconButton>
        <DexIconButton
          variant="transparent"
          size="dense"
          label="View details"
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </DexIconButton>
      </div>
    </DexCard>
  )
}
