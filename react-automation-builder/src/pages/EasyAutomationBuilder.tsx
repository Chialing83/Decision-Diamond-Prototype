import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { X, Plus, Zap, Bell } from 'lucide-react'
import { Button } from '../components/ui'

/**
 * Easy automation builder.
 *
 * Hosted at `/automations/build/:id`. A simpler, two-block builder
 * mirroring the production "Build automation" view: a centered card
 * stack with one **When** block and one **Then** block, each opened
 * by a `+` affordance. The top bar carries a close (X), an editable
 * title (defaults to "My automation (Mon DD, YYYY)"), and a primary
 * **Next** CTA on the right.
 *
 * Renders outside the AppShell — standalone full-page surface, same
 * pattern the Advanced AutomationBuilder uses.
 */
export default function EasyAutomationBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()

  const defaultName = useMemo(() => {
    const d = new Date()
    const month = d.toLocaleString(undefined, { month: 'short' })
    return `My automation (${month} ${d.getDate()}, ${d.getFullYear()})`
  }, [])

  const [title, setTitle] = useState(defaultName)
  const [whenItem, setWhenItem] = useState<EasyTrigger | null>(null)
  const [thenItem, setThenItem] = useState<EasyAction | null>(null)
  const [activePicker, setActivePicker] = useState<'when' | 'then' | null>(null)

  const onClose = () => navigate('/my-automations/list/easy')
  const onNext = () => {
    // Prototype stub — real flow would persist the draft and route
    // to the next step (audience targeting + activation review).
    alert(
      `Next clicked — id ${id}\nWhen: ${whenItem?.label ?? '— not set —'}\nThen: ${thenItem?.label ?? '— not set —'}`,
    )
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-canvas">
      <TopBar
        title={title}
        onTitleChange={setTitle}
        onClose={onClose}
        onNext={onNext}
        canNext={Boolean(whenItem && thenItem)}
      />

      <main className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-12">
        <div className="flex w-full max-w-[640px] flex-col gap-6">
          <BlockCard
            label="When"
            placeholder="…this occurs, start my automation"
            selected={whenItem?.label}
            iconHint={<Zap size={20} strokeWidth={1.75} aria-hidden="true" />}
            onAdd={() => setActivePicker('when')}
            onClear={() => setWhenItem(null)}
          />
          <Connector />
          <BlockCard
            label="Then"
            placeholder="…this will be automated"
            selected={thenItem?.label}
            iconHint={<Bell size={20} strokeWidth={1.75} aria-hidden="true" />}
            onAdd={() => setActivePicker('then')}
            onClear={() => setThenItem(null)}
          />
        </div>
      </main>

      {activePicker ? (
        <PickerModal
          mode={activePicker}
          onClose={() => setActivePicker(null)}
          onPick={(item) => {
            if (activePicker === 'when') setWhenItem(item as EasyTrigger)
            else setThenItem(item as EasyAction)
            setActivePicker(null)
          }}
        />
      ) : null}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────── */

function TopBar({
  title,
  onTitleChange,
  onClose,
  onNext,
  canNext,
}: {
  title: string
  onTitleChange: (next: string) => void
  onClose: () => void
  onNext: () => void
  canNext: boolean
}) {
  const [editing, setEditing] = useState(false)
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="inline-flex h-9 w-9 items-center justify-center rounded-btn text-ink hover:bg-hover-overlay focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
      >
        <X size={20} strokeWidth={2} aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') setEditing(false)
            }}
            className="w-full max-w-[480px] rounded-btn border border-input-border bg-surface px-2 py-1 text-sm text-ink focus-visible:border-accent focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="max-w-full truncate rounded-btn px-2 py-1 text-left text-sm font-medium text-ink hover:bg-hover-overlay"
          >
            {title}
          </button>
        )}
      </div>
      <Button variant="primary" onClick={onNext} disabled={!canNext}>
        Next
      </Button>
    </header>
  )
}

function BlockCard({
  label,
  placeholder,
  selected,
  iconHint,
  onAdd,
  onClear,
}: {
  label: 'When' | 'Then'
  placeholder: string
  selected?: string
  iconHint: React.ReactNode
  onAdd: () => void
  onClear: () => void
}) {
  return (
    <section
      aria-label={label}
      className="rounded-card border border-border bg-surface p-4 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      {selected ? (
        <div className="mt-3 flex items-center gap-3 rounded-btn border border-border bg-canvas px-3 py-2">
          <span aria-hidden="true" className="inline-flex text-accent">
            {iconHint}
          </span>
          <span className="flex-1 text-sm text-ink">{selected}</span>
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-ink-muted hover:text-ink"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            aria-label={`Add ${label} trigger`}
            onClick={onAdd}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
          >
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <span className="text-sm text-ink-muted">{placeholder}</span>
        </div>
      )}
    </section>
  )
}

function Connector() {
  return (
    <div aria-hidden="true" className="flex justify-center">
      <span className="block h-6 w-px bg-border" />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────── */

type EasyTrigger = { id: string; label: string; description: string }
type EasyAction = { id: string; label: string; description: string }

const TRIGGERS: EasyTrigger[] = [
  { id: 'form', label: 'Form is submitted', description: 'A contact fills out a chosen form.' },
  { id: 'tag', label: 'Tag is applied', description: 'A specific tag gets applied to a contact.' },
  { id: 'purchase', label: 'Product is purchased', description: 'A contact buys a specific product.' },
  { id: 'page', label: 'Landing page is submitted', description: 'A contact submits one of your landing pages.' },
]

const ACTIONS: EasyAction[] = [
  { id: 'send-email', label: 'Send email', description: 'Send a one-off email to the contact.' },
  { id: 'apply-tag', label: 'Apply a tag', description: 'Tag the contact for downstream automations.' },
  { id: 'create-task', label: 'Create a task', description: 'Assign a task to a user.' },
  { id: 'send-sms', label: 'Send text message', description: 'Send a one-off SMS to the contact.' },
]

function PickerModal({
  mode,
  onClose,
  onPick,
}: {
  mode: 'when' | 'then'
  onClose: () => void
  onPick: (item: EasyTrigger | EasyAction) => void
}) {
  const items = mode === 'when' ? TRIGGERS : ACTIONS
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'when' ? 'Choose a When trigger' : 'Choose a Then action'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-card bg-surface p-4 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium text-ink">
            {mode === 'when' ? 'Choose a trigger' : 'Choose an action'}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-btn text-ink-muted hover:bg-hover-overlay"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onPick(item)}
                className="flex w-full flex-col gap-0.5 rounded-btn px-3 py-2 text-left hover:bg-canvas focus-visible:outline-none focus-visible:bg-canvas"
              >
                <span className="text-sm text-ink">{item.label}</span>
                <span className="text-xs text-ink-muted">{item.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
