import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DexButton, DexIconButton, DexInline, DexInput, DexTabs, DexTabsList, DexTabsTrigger } from '@thryvlabs/dex-react'
import { contacts } from '../data/mockData'
import ContactRow from '../components/contacts/ContactRow'
import ContactPanel from '../components/contacts/ContactPanel'

type Tab = 'people' | 'companies' | 'groups'

export default function Contacts() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('people')
  const [search, setSearch] = useState('')

  const selectedContact = id ? contacts.find((c) => c.id === id) : null

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase()
    const name = `${c.firstName} ${c.lastName}`.toLowerCase()
    return name.includes(q) || c.email.toLowerCase().includes(q)
  })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'people', label: 'People' },
    { key: 'companies', label: 'Companies' },
    { key: 'groups', label: 'Groups' },
  ]

  return (
    <DexInline
      gap="0"
      alignY="stretch"
      noWrap
      style={{ height: '100vh', overflow: 'hidden', background: '#F4F4F7' }}
    >
      {/* Contacts list pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#fff' }}>
        {/* Header */}
        <div style={{ borderBottom: '1px solid #E7E7E7', padding: '16px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2C2C2C', margin: 0 }}>People</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Sort icon */}
              <DexIconButton variant="transparent" label="Sort">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/>
                </svg>
              </DexIconButton>
              {/* Filter icon */}
              <DexIconButton variant="transparent" label="Filter">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
              </DexIconButton>
              {/* Add button */}
              <DexButton
                variant="solid"
                color="default"
                leading={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                }
              >
                Add contact
              </DexButton>
            </div>
          </div>

          {/* Tabs */}
          <DexTabs value={tab} onValueChange={(v) => setTab(v as Tab)} defaultValue="people">
            <DexTabsList>
              {tabs.map((t) => (
                <DexTabsTrigger key={t.key} value={t.key}>
                  {t.label}
                </DexTabsTrigger>
              ))}
            </DexTabsList>
          </DexTabs>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #E7E7E7', background: '#fff' }}>
          <div style={{ maxWidth: 320 }}>
            <DexInput
              type="search"
              label="Search contacts"
              labelHidden
              placeholder="Search contacts..."
              value={search}
              onValueChange={setSearch}
              outline="inset"
              leading={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              }
            />
          </div>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 20px',
          background: '#FAFAFA', borderBottom: '1px solid #E7E7E7',
          fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          <div style={{ width: 40, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>Name / Email</div>
          <div style={{ width: 120, textAlign: 'right' }}>Date added</div>
          <div style={{ width: 72, textAlign: 'right' }}>Status</div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 'people' ? (
            filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA3AF', padding: 40 }}>
                <p style={{ fontSize: 14 }}>No contacts found</p>
              </div>
            ) : (
              filtered.map((contact) => (
                <ContactRow key={contact.id} contact={contact} isSelected={id === contact.id} />
              ))
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA3AF', padding: 40 }}>
              <p style={{ fontSize: 14 }}>No {tab} found</p>
              <button style={{ fontSize: 13, color: '#006CEB', marginTop: 8 }}>
                + Add {tab.slice(0, -1)}
              </button>
            </div>
          )}
        </div>

        {/* Footer count */}
        <div style={{ padding: '8px 20px', borderTop: '1px solid #E7E7E7', fontSize: 12, color: '#9CA3AF', background: '#FAFAFA' }}>
          {filtered.length} of {contacts.length} contacts
        </div>
      </div>

      {/* Contact detail panel */}
      {selectedContact && (
        <ContactPanel contact={selectedContact} />
      )}
    </DexInline>
  )
}
