import React from 'react'
import { DexIconButton } from '@thryvlabs/dex-react'

interface Props {
  isExpanded: boolean
  onToggle: () => void
}

export function NavCollapseButton({ isExpanded, onToggle }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        top: isExpanded ? 8 : 4,
        left: isExpanded ? 320 : 64,
        zIndex: 30,
        color: '#ffffff',
        transition: 'left 200ms ease, top 200ms ease',
      }}
    >
      <DexIconButton
        variant="transparent"
        size="dense"
        label={isExpanded ? 'Collapse Nav' : 'Expand Nav'}
        onClick={onToggle}
      >
        {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
      </DexIconButton>
    </div>
  )
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M21 1a1 1 0 0 1 1 1v20a1 1 0 1 1-2 0V2a1 1 0 0 1 1-1M10.707 6.293l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414-1.414L12.586 13H5a1 1 0 1 1 0-2h7.586L9.293 7.707a1 1 0 0 1 1.414-1.414" />
    </svg>
  )
}

function CollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M3 1a1 1 0 0 1 1 1v20a1 1 0 1 1-2 0V2a1 1 0 0 1 1-1m11.707 5.293a1 1 0 0 1 0 1.414L11.414 11H19a1 1 0 1 1 0 2h-7.586l3.293 3.293a1 1 0 0 1-1.414 1.414l-5-5a1 1 0 0 1 0-1.414l5-5a1 1 0 0 1 1.414 0" />
    </svg>
  )
}
