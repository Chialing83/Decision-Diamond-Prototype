import React from 'react'
import { Outlet } from 'react-router-dom'
import { DexInline } from '@thryvlabs/dex-react'
import Sidebar from './Sidebar'

export default function AppShell() {
  return (
    <DexInline
      stretch
      gap="0"
      alignY="stretch"
      noWrap
      style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#F4F4F7' }}
    >
      <Sidebar />
      <main style={{ flex: '1 1 0%', minWidth: 0, overflow: 'auto' }}>
        <Outlet />
      </main>
    </DexInline>
  )
}
