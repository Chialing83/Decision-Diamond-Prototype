import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DexDropdownMenu,
  DexDropdownMenuItem,
  DexDropdownMenuHeading,
  DexFloatingActionButton,
} from '@thryvlabs/dex-react'

const menuItems = [
  { label: 'Contact', icon: '👤', path: '/contacts/list/all' },
  { label: 'Deal', icon: '💰', path: '/pipeline/1/board' },
  { label: 'Task', icon: '✅', path: '/tasks' },
  { label: 'Appointment', icon: '📅', path: '/appointments' },
  { label: 'Note', icon: '📝', path: '/contacts/list/all' },
  { label: 'Email', icon: '✉️', path: '/communication/email-broadcasts' },
]

export function FloatingNewButton() {
  const navigate = useNavigate()

  return (
    <div
      style={{
        position: 'absolute',
        top: 48,
        left: 142,
        zIndex: 50,
      }}
    >
      <DexDropdownMenu
        align="start"
        offset={8}
        content={
          <>
            <DexDropdownMenuHeading>Create new</DexDropdownMenuHeading>
            {menuItems.map((item) => (
              <DexDropdownMenuItem
                key={item.label}
                title={item.label}
                leading={<span style={{ fontSize: 16 }}>{item.icon}</span>}
                onSelect={() => navigate(item.path)}
              />
            ))}
          </>
        }
      >
        <DexFloatingActionButton label="New" icon="add" color="secondary" size="dense" />
      </DexDropdownMenu>
    </div>
  )
}
