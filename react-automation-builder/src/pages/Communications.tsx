import React, { useState } from 'react'
import { DexButton, DexInline, DexStatus, DexTabs, DexTabsList, DexTabsTrigger } from '@thryvlabs/dex-react'
import { messages } from '../data/mockData'
import MessageRow from '../components/comms/MessageRow'

export default function Communications() {
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null)
  const [tab, setTab] = useState<'all' | 'unread'>('all')

  const selected = messages.find((m) => m.id === selectedMessage)
  const unreadCount = messages.filter((m) => m.unread).length
  const displayMessages = tab === 'unread' ? messages.filter((m) => m.unread) : messages

  return (
    <DexInline
      gap="0"
      alignY="stretch"
      noWrap
      style={{ height: '100vh', overflow: 'hidden', background: '#F4F4F7' }}
    >
      {/* Left panel */}
      <div style={{ width: 360, flexShrink: 0, background: '#fff', borderRight: '1px solid #E7E7E7', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 0', borderBottom: '1px solid #E7E7E7' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2C2C2C', margin: 0 }}>Business line</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 12, color: '#656565' }}>+13603090606</span>
                <button style={{ color: '#9CA3AF', lineHeight: 1 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
                <button style={{ color: '#9CA3AF', lineHeight: 1 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                </button>
              </div>
            </div>
            <DexButton
              variant="solid"
              color="default"
              shape="pill"
              size="dense"
              aria-label="New conversation"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </DexButton>
          </div>

          {/* Info banner */}
          <div
            style={{
              background: '#D6F0FF', borderRadius: 8,
              padding: '8px 12px', margin: '10px 0',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>ℹ️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: '#1D4ED8', margin: 0 }}>
                Carrier acceptance required for business messaging.{' '}
                <button style={{ fontWeight: 600, color: '#1D4ED8', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12 }}>
                  Text and Voice settings
                </button>
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ marginTop: 4 }}>
            <DexTabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'unread')} defaultValue="all">
              <DexTabsList>
                <DexTabsTrigger value="all">All</DexTabsTrigger>
                <DexTabsTrigger value="unread">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Unread
                    {unreadCount > 0 && (
                      <DexStatus variant="danger" emphasis="high">{unreadCount}</DexStatus>
                    )}
                  </span>
                </DexTabsTrigger>
              </DexTabsList>
            </DexTabs>
          </div>
        </div>

        {/* Message list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {displayMessages.map((msg) => (
            <MessageRow
              key={msg.id}
              message={msg}
              isSelected={selectedMessage === msg.id}
              onClick={() => setSelectedMessage(msg.id)}
            />
          ))}
        </div>
      </div>

      {/* Right: conversation area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F4F4F7' }}>
        {selected ? (
          <>
            {/* Convo header */}
            <div style={{ background: '#fff', borderBottom: '1px solid #E7E7E7', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: 13 }}>
                {selected.contact[0].toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2C', margin: 0 }}>{selected.contact}</p>
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{selected.phone}</p>
              </div>
              <div style={{ flex: 1 }} />
              <DexButton variant="solid" color="default" size="dense">
                📞 Call
              </DexButton>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
                <div
                  style={{
                    maxWidth: 320, background: '#fff',
                    borderRadius: '12px 12px 12px 2px',
                    padding: '10px 14px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    border: '1px solid #E7E7E7',
                  }}
                >
                  <p style={{ fontSize: 13, color: '#2C2C2C', margin: 0 }}>{selected.preview}</p>
                  <p style={{ fontSize: 10, color: '#9CA3AF', margin: '4px 0 0', textAlign: 'right' }}>{selected.date}</p>
                </div>
              </div>
            </div>

            {/* Input */}
            <div style={{ background: '#fff', borderTop: '1px solid #E7E7E7', padding: '12px 20px' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Type a message..."
                  style={{
                    flex: 1, border: '1px solid #E7E7E7', borderRadius: 20,
                    padding: '9px 16px', fontSize: 13, outline: 'none',
                    background: '#F9F9F9', color: '#2C2C2C',
                  }}
                />
                <DexButton variant="solid" color="default" shape="pill">
                  Send
                </DexButton>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E7E7E7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#2C2C2C', marginBottom: 6 }}>Get the conversation started</h2>
            <p style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 20 }}>Select a conversation or start a new one</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <DexButton variant="solid" color="default">
                💬 Send a text
              </DexButton>
              <DexButton variant="outline" color="neutral">
                📞 Place a call
              </DexButton>
            </div>

            {/* Tips */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 28, maxWidth: 400 }}>
              {[
                { title: 'Send a broadcast', desc: 'Reach all your contacts at once' },
                { title: 'Set up auto-replies', desc: 'Respond automatically after hours' },
              ].map((tip) => (
                <div
                  key={tip.title}
                  style={{
                    background: '#fff', border: '1px solid #E7E7E7', borderRadius: 10,
                    padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2C', margin: '0 0 4px' }}>{tip.title}</p>
                  <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{tip.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DexInline>
  )
}
