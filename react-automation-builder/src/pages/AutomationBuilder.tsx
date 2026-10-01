import React, { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { DexIconButton } from '@thryvlabs/dex-react'
import { advancedAutomations } from '../data/mockData'
import {
  loadNameOverrides,
  saveNameOverrides,
  getDisplayName,
  renameInMap,
} from '../data/automationNames'
import automationIcons from '../data/automationIcons.json'
import {
  PaletteList,
  PaletteSearchInput,
  SidebarCollapseToggle,
  WhenThenTabs,
} from '../components/ui'
import type { PaletteCell } from '../components/ui'
import '../styles/automation-builder.css'
import {
  SUBJECT_OPTIONS,
  FIELD_CATEGORY_OPTIONS,
  CONTACT_FIELD_OPTIONS,
  CUSTOM_FIELD_OPTIONS,
  OPERATOR_OPTIONS,
  UNARY_OPERATORS,
  COUNTRY_OPTIONS,
} from '../decisionDiamond/dropdowns'
import {
  ENTITY_ORDER,
  ENTITIES,
  type EntityId,
  type FieldType,
} from '../entities/registry'

/* ---------------------------------------------------------- */
/* Types & seed data                                           */
/* ---------------------------------------------------------- */

type TriggerDef = {
  slug: string
  label: string
  svg: string
  badge?: 'new'
}

/** Normalize an SVG string (from Keap automation-icons) so it renders at a
 *  target pixel size. Strips hard-coded width/height so CSS sizing wins. */
function sizedSvg(raw: string) {
  return raw
    .replace(/\swidth=['"][^'"]*['"]/, '')
    .replace(/\sheight=['"][^'"]*['"]/, '')
}

function IconSvg({ svg, size = 20 }: { svg: string; size?: number }) {
  // "Send an HTTP Request" stores a remote URL rather than inline SVG.
  if (/^https?:\/\//.test(svg)) {
    return <img src={svg} width={size} height={size} alt="" />
  }
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        lineHeight: 0,
      }}
      dangerouslySetInnerHTML={{
        __html: sizedSvg(svg).replace(
          /<svg /,
          `<svg width="${size}" height="${size}" `
        ),
      }}
    />
  )
}

type CellStatus = 'setupRequired' | 'readyToPublish' | 'published'

type BuilderNode = {
  id: string
  type: 'trigger' | 'decision' | 'action'
  title: string
  subtitle?: string
  /** Stable catalog slug — `automationIcons.json` slug for legacy items, or
   *  `entity:<entityId>.<eventId>` for entity-event/action items. Used by
   *  the diamond's Branch-by panel to filter the entity grid down to
   *  entities that appear in the surrounding workflow. */
  name?: string
  x: number
  y: number
  /** Legacy flag (red badge for un-configured nodes). If `status` is set,
   *  it wins. */
  warning?: boolean
  status?: CellStatus
  icon?: React.ReactNode
  accent?: string
}

/** Single source of truth for the top-right bullseye badge + hover tooltip. */
const STATUS_STYLES: Record<CellStatus, { halo: string; dot: string; tooltip: string }> = {
  setupRequired: { halo: '#FFC8B8', dot: '#E02500', tooltip: 'Setup required' },
  readyToPublish: { halo: '#FFE8AF', dot: '#EFBB06', tooltip: 'Ready to publish' },
  published: { halo: '#C8F0C8', dot: '#36A635', tooltip: 'Published' },
}

type BuilderEdge = {
  id: string
  from: string
  to: string
  label?: string
}

/** A registered locked pair: the host (e.g. Get email opt-in) and its
 *  always-attached partner (e.g. Confirm Email), plus the id of the
 *  locked edge between them. The edge id lets the renderer look the
 *  pair up directly when deciding whether to paint a lock badge. */
type LockedPair = { hostId: string; partnerId: string; edgeId: string }

/** Full canvas state captured at a point in time — the unit of work
 *  for the undo / redo stacks. Every mutating action snapshots this
 *  shape BEFORE running, so undoing is a flat state-restore. */
type CanvasSnapshot = {
  nodes: BuilderNode[]
  edges: BuilderEdge[]
  decisionConfigs: Record<string, DecisionDiamondConfig>
  lockedPairs: LockedPair[]
  selectedNodeIds: Set<string>
  primarySelectedId: string | null
}
type UndoEntry = { label: string; snapshot: CanvasSnapshot }

/** Maximum depth of the undo stack. Older entries get dropped from
 *  the front once the limit is exceeded — bounded memory cost while
 *  still giving plenty of headroom for a typical editing session. */
const MAX_UNDO_HISTORY = 50

/** Host (Then) glyph for a locked pair: a blue stacked-layers icon
 *  per the canonical spec render — communicates "this step kicks off
 *  the confirmation flow." Replaces the default envelope-with-check
 *  whenever the Then is part of a locked pair. Exposed at module scope
 *  so the initial seed `useState` can render the icon at first paint. */
const EMAIL_CONFIRMATION_REQUEST_SVG =
  "<svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'><path fill-rule='evenodd' clip-rule='evenodd' d='M11.106 1.553a2 2 0 0 1 1.788 0l9 4.5a1 1 0 0 1 0 1.788l-9 4.5a2 2 0 0 1-1.788 0l-9-4.5a1 1 0 0 1 0-1.788l9-4.5ZM12 3.118 4.764 6.736 12 10.354l7.236-3.618L12 3.118Z' fill='#0080FF'/><path fill-rule='evenodd' clip-rule='evenodd' d='M2.105 11.553a1 1 0 0 1 1.342-.448L12 15.382l8.553-4.277a1 1 0 1 1 .894 1.79l-9 4.5a2 2 0 0 1-1.788 0l-9-4.5a1 1 0 0 1-.554-1.342Z' fill='#0080FF'/><path fill-rule='evenodd' clip-rule='evenodd' d='M2.105 16.553a1 1 0 0 1 1.342-.448L12 20.382l8.553-4.277a1 1 0 1 1 .894 1.79l-9 4.5a2 2 0 0 1-1.788 0l-9-4.5a1 1 0 0 1-.554-1.342Z' fill='#0080FF'/></svg>"

/** Partner (When) glyph for a locked pair: a green checkmark-in-box
 *  per the canonical spec render — communicates "this is the
 *  confirmation step the recipient completes." */
const CONFIRM_EMAIL_SVG =
  "<svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'><path fill-rule='evenodd' clip-rule='evenodd' d='M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5Zm0 2h14v14H5V5Z' fill='#22A06B'/><path d='M16.707 9.293a1 1 0 0 1 0 1.414l-5.5 5.5a1 1 0 0 1-1.414 0l-2.5-2.5a1 1 0 1 1 1.414-1.414L10.5 14.086l4.793-4.793a1 1 0 0 1 1.414 0Z' fill='#22A06B'/></svg>"

/** Lock badge painted at the midpoint of a locked connector. Owns its
 *  own hover state so it can surface the same "automatically created
 *  and managed" tooltip the Keap funnel editor shows from
 *  `showLockTooltip` on the sequence's lock overlay. */
function LockedEdgeBadge({
  cx,
  cy,
  color,
}: {
  cx: number
  cy: number
  color: string
}) {
  const [hovered, setHovered] = React.useState(false)
  return (
    <g
      style={{ pointerEvents: 'auto', cursor: 'help' }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Hit halo — larger transparent circle so the tooltip triggers
          on a forgiving target without showing extra ink. Scaled 2×
          with the rest of the badge. */}
      <circle cx={cx} cy={cy} r={32} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={22}
        fill="#FFFFFF"
        stroke={color}
        strokeWidth={2.5}
      />
      {/* Padlock body */}
      <rect
        x={cx - 8}
        y={cy - 2}
        width={16}
        height={12}
        rx={2}
        fill="none"
        stroke={color}
        strokeWidth={2.6}
      />
      {/* Padlock shackle */}
      <path
        d={`M ${cx - 5} ${cy - 2} v -3 a 5 5 0 0 1 10 0 v 3`}
        fill="none"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      {hovered && (
        <g style={{ pointerEvents: 'none' }}>
          {/* Tooltip pill — uses foreignObject so the text renders
              with normal HTML wrapping, matching the dark pill styling
              used by the status tooltip in CanvasNode. Sizes are 2×
              the natural display sizes so the tooltip remains
              readable at the canvas's default 50% zoom (everything
              inside the scaled surface paints at half display size).
              That puts the rendered font at ~12 px display — the
              same readability target as the rest of the canvas. */}
          <foreignObject
            x={cx - 120}
            y={cy - 90}
            width={240}
            height={64}
          >
            <div
              style={{
                background: '#272727',
                color: '#FFFFFF',
                fontSize: 24,
                fontWeight: 500,
                lineHeight: '32px',
                padding: '14px 22px',
                borderRadius: 14,
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                whiteSpace: 'nowrap',
                fontFamily: '"Proxima Nova", Inter, system-ui, sans-serif',
              }}
            >
              Locked pair
            </div>
          </foreignObject>
        </g>
      )}
    </g>
  )
}

const G = {
  canvasBg: '#F7F8FA',
  border: '#E5E7EB',
  primary: '#2F6FED',
  success: '#22A06B',
  warning: '#F5B800',
  text: '#0F1724',
  muted: '#6B7280',
}

const NEW_TRIGGER_SLUGS = new Set(['landing-page-is-submitted'])

/** Map of legacy automationIcons.json slugs → the entities each implies.
 *  Used by the diamond's Branch-by panel to hard-filter the entity grid
 *  down to entities that actually appear in the surrounding workflow.
 *
 *  Slugs not listed here imply no entity context (system / utility nodes
 *  like timers, HTTP requests, raw API hooks). */
const SLUG_TO_ENTITIES: Record<string, EntityId[]> = {
  // Whens
  appointments: ['appointment'],
  'email-link-is-clicked': ['contact'],
  'failed-purchase': ['invoice', 'contact'],
  'form-is-submitted': ['contact'],
  'landing-page-is-submitted': ['contact'],
  'lead-score-is-achieved': ['contact'],
  'pipeline-stage-is-moved': ['deal'],
  'product-is-purchased': ['invoice'],
  'quote-status': ['deal'],
  'tag-is-applied': ['contact'],
  'task-is-completed': ['contact'],
  'wordpress-opt-in': ['contact'],
  // Thens
  'add-or-remove-from-sequence': ['contact'],
  'apply-a-note': ['contact'],
  'apply-or-remove-tag': ['contact'],
  'appointment-timer': ['appointment'],
  'assign-an-owner': ['contact', 'deal'],
  'create-a-deal': ['deal'],
  'create-a-task': ['contact'],
  'create-an-invoice': ['invoice'],
  'field-timer': ['contact'],
  'get-email-opt-in': ['contact'],
  'send-email': ['contact'],
  'send-text-message': ['contact'],
  'set-field-value': ['contact'],
  // No entity: api, date-timer, delay-timer, send-an-http-request,
  // empty-action-sequence
}

/** Decode the entity from a node name. Handles two cases:
 *   - `entity:<entityId>.<eventOrActionId>` slugs (used if entity events
 *     ever come back to the picker)
 *   - Legacy automationIcons slugs via SLUG_TO_ENTITIES lookup */
function entitiesForNodeName(name: string | undefined): EntityId[] {
  if (!name) return []
  if (name.startsWith('entity:')) {
    const rest = name.slice(7)
    const entityId = rest.split('.')[0] as EntityId
    return ENTITIES[entityId] ? [entityId] : []
  }
  return SLUG_TO_ENTITIES[name] ?? []
}

// Entity events/actions intentionally do NOT appear in the "+" picker —
// the only entity-aware affordance there is the featured "Decision diamond"
// card. All entity hierarchy lives inside the diamond config modal.
const TRIGGERS: TriggerDef[] = (
  automationIcons.when as Array<{ title: string; slug: string; svg: string }>
).map((i) => ({
  slug: i.slug,
  label: i.title,
  svg: i.svg,
  ...(NEW_TRIGGER_SLUGS.has(i.slug) ? { badge: 'new' as const } : {}),
}))

const ACTIONS: TriggerDef[] = (
  automationIcons.then as Array<{ title: string; slug: string; svg: string }>
).map((i) => ({
  slug: i.slug,
  label: i.title,
  svg: i.svg,
}))

/* ---------------------------------------------------------- */
/* Top bar                                                     */
/* ---------------------------------------------------------- */

/** Campaign-header top bar per the Keap automation-editor spec.
 *
 *  Layout contract:
 *   - Outer container is 72px tall with a 1px #E7E7E7 bottom border.
 *   - Left cluster: close X + title + sub-row (category + Draft pill).
 *   - Right cluster: save timestamp, toggle switch, Reporting, kebab, Publish.
 *   - Font: 'Sul Sans', Helvetica, Arial, sans-serif. Default text:
 *     rgba(0,0,0,0.824). Brand blue #006CEB. Success green #36A635.
 *     Neutral pill/track grey #979797 / #E7E7E7. */
const HEADER_FONT = '"Sul Sans", Helvetica, Arial, sans-serif'
const HEADER_INK = 'rgba(0, 0, 0, 0.824)'
const HEADER_BORDER = '#E7E7E7'
const BRAND_BLUE = '#006CEB'
const BRAND_BLUE_HOVER = '#005AC4'
const BRAND_BLUE_TINT = 'rgba(0, 108, 235, 0.08)'
const SUCCESS_GREEN = '#36A635'
const DRAFT_GREY = '#979797'
const DANGER_RED = '#D9272E'
const HEADER_EASING = 'cubic-bezier(0.23, 1, 0.32, 1)'

type SaveState = 'saved' | 'saving' | 'error'

function formatClockTime(d: Date) {
  let h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${m.toString().padStart(2, '0')}${ampm}`
}

/** Icon button used in the multi-select floating toolbar (Duplicate /
 *  Tidy up / Delete). Each instance owns its hover state and renders a
 *  small dark tooltip pill above the button on hover. */
function SelectionToolbarButton({
  label,
  onClick,
  danger,
  disabled,
  disabledHint,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  /** When true, button is greyed-out and the onClick is suppressed.
   *  Hover tooltip still shows so the user can see the label;
   *  optional `disabledHint` overrides the label when provided
   *  (e.g. "Disabled in this workflow"). */
  disabled?: boolean
  disabledHint?: string
  children: React.ReactNode
}) {
  const [hover, setHover] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-label={label}
        aria-disabled={disabled || undefined}
        onClick={() => { if (!disabled) onClick() }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: 36,
          height: 36,
          padding: 0,
          border: 'none',
          background: disabled
            ? 'transparent'
            : hover
              ? 'rgba(0,0,0,0.04)'
              : 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          borderRadius: 8,
          color: danger ? '#DC2626' : 'var(--dex-color-gray-1600, #272727)',
          opacity: disabled ? 0.35 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'inherit',
          transition: 'background-color 0.12s ease, opacity 0.12s ease',
        }}
      >
        {children}
      </button>
      {hover && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 10px',
            background: '#272727',
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: '16px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}
        >
          {disabled && disabledHint ? disabledHint : label}
        </span>
      )}
    </span>
  )
}

function HeaderIconButton({
  ariaLabel, onClick, children, width = 40, height = 40,
}: {
  ariaLabel: string
  onClick?: () => void
  children: React.ReactNode
  width?: number
  height?: number
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width,
        height,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        background: hovered ? 'rgba(0,0,0,0.04)' : 'transparent',
        border: '1px solid transparent',
        borderRadius: 8,
        color: 'var(--dex-color-gray-1600, #272727)',
        cursor: 'pointer',
        transition: `background-color 0.25s ${HEADER_EASING}`,
      }}
    >
      {children}
    </button>
  )
}

function SaveIndicator({ state, at }: { state: SaveState; at: Date }) {
  if (state === 'saving') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: HEADER_INK, fontSize: 14, marginRight: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" />
        </svg>
        Saving…
      </div>
    )
  }
  if (state === 'error') {
    return (
      <span style={{ color: DANGER_RED, fontSize: 14, fontWeight: 400, marginRight: 10 }}>Save failed</span>
    )
  }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 10 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={SUCCESS_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="8 12 11 15 16 9" />
      </svg>
      <span style={{ color: SUCCESS_GREEN, fontSize: 14, fontWeight: 400, lineHeight: 1 }}>
        Saved at {formatClockTime(at)}
      </span>
    </div>
  )
}

function FeatureToggle({
  checked, onChange, label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 32,
        padding: '0 5px 0 0',
        cursor: 'pointer',
      }}
    >
      <span
        className="label"
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#2C2C2C',
          paddingRight: 12,
        }}
      >
        {label}
      </span>
      <span
        className="toggle"
        style={{ width: 40, height: 10, position: 'relative', display: 'inline-block' }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.currentTarget.checked)}
          // Visually hidden but focusable.
          style={{
            position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%',
            margin: 0, cursor: 'pointer',
          }}
          aria-label={label}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            background: checked ? BRAND_BLUE : HEADER_BORDER,
            borderRadius: 5,
            transition: `background-color 0.25s ${HEADER_EASING}`,
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: checked ? 16 : 0,
            top: -7,
            width: 24,
            height: 24,
            background: '#FFFFFF',
            borderRadius: '100%',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: `left 0.25s ${HEADER_EASING}, box-shadow 0.25s ${HEADER_EASING}`,
          }}
        />
      </span>
    </label>
  )
}

function ReportingButton({ onClick }: { onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 40,
        padding: '11px 15px 11px 11px',
        background: hovered ? BRAND_BLUE_TINT : 'transparent',
        color: BRAND_BLUE,
        fontSize: 14,
        fontWeight: 600,
        fontFamily: HEADER_FONT,
        border: '1px solid transparent',
        borderRadius: 8,
        cursor: 'pointer',
        transition: `background-color 0.25s ${HEADER_EASING}`,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
      Reporting
    </button>
  )
}

function PublishButton({ onClick, disabled = false }: { onClick?: () => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)
  const bg = disabled
    ? '#B5D5F8'
    : active
      ? '#00489E'
      : hovered
        ? BRAND_BLUE_HOVER
        : BRAND_BLUE
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        setActive(false)
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        height: 40,
        padding: '11px 15px',
        background: bg,
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: HEADER_FONT,
        border: '1px solid transparent',
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: 'none',
        transition: `background-color 0.25s ${HEADER_EASING}, box-shadow 0.25s ${HEADER_EASING}, border-color 0.25s ${HEADER_EASING}, color 0.25s ${HEADER_EASING}`,
      }}
    >
      Publish
    </button>
  )
}

function BuilderTopBar({
  title,
  owner,
  onClose,
  onRename,
}: {
  title: string
  owner: string
  onClose: () => void
  /** Optional rename callback. When supplied, the title becomes
   *  click-to-edit (Enter / blur commits, Escape cancels) so the
   *  user can rename from the builder; the change broadcasts back
   *  to the list view via the shared name-overrides store. */
  onRename?: (next: string) => void
}) {
  const [featureToggle, setFeatureToggle] = useState(false)
  // Live "saved at" timestamp — seeded at mount so the pill shows a stable
  // time until an actual save event wires in.
  const [savedAt] = useState(() => new Date())

  // Inline-rename state for the title cell.
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  React.useEffect(() => {
    if (!editing) setDraft(title)
  }, [title, editing])
  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])
  const commit = () => {
    const next = draft.trim()
    if (next && next !== title) onRename?.(next)
    setEditing(false)
    setDraft(next || title)
  }
  const cancel = () => {
    setDraft(title)
    setEditing(false)
  }

  return (
    <div
      className="campaign-header-container"
      style={{
        height: 72,
        flexShrink: 0,
        background: '#FFFFFF',
        borderBottom: `1px solid ${HEADER_BORDER}`,
        fontFamily: HEADER_FONT,
      }}
    >
      <div
        className="vue-funnel-header"
        style={{
          height: 71,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
        }}
      >
        {/* ---------- Left cluster ---------- */}
        <div
          className="vue-left-controls"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 0,
          }}
        >
          {/* Close X */}
          <HeaderIconButton
            ariaLabel="Close automation"
            onClick={onClose}
            width={58}
            height={71}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.707 6.707a1 1 0 0 0-1.414-1.414L12 10.586 6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 0 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12z" />
            </svg>
          </HeaderIconButton>

          {/* Title + sub-row */}
          <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 13.5, minWidth: 0 }}>
            <div
              className="top-row"
              style={{ display: 'flex', gap: 4, height: 24, alignItems: 'center' }}
            >
              {editing && onRename ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commit()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      cancel()
                    }
                  }}
                  className="funnel-name"
                  style={{
                    fontSize: 20,
                    fontWeight: 400,
                    color: HEADER_INK,
                    lineHeight: '24px',
                    minWidth: 360,
                    padding: '0 8px',
                    border: `1px solid ${HEADER_BORDER}`,
                    borderRadius: 6,
                    outline: 'none',
                    background: '#FFFFFF',
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="funnel-name"
                  onClick={() => onRename && setEditing(true)}
                  title={onRename ? 'Click to rename' : undefined}
                  style={{
                    fontSize: 20,
                    fontWeight: 400,
                    color: HEADER_INK,
                    lineHeight: '24px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    cursor: onRename ? 'text' : 'default',
                  }}
                >
                  {title}
                </button>
              )}
            </div>

            <div
              className="funnel-subheader"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                // Source spec uses margin-left 64px to align the sub-row
                // under the title past the close icon. Here the title is
                // already positioned to the right of the close button, so
                // no extra indent is needed.
                height: 20,
                marginTop: 4,
              }}
            >
              <span
                className="funnel-categories"
                style={{ fontSize: 14, fontWeight: 400, color: HEADER_INK, lineHeight: '20px' }}
              >
                {owner}
              </span>
              <span
                className="funnel-status draft"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 16,
                  padding: '0 4px',
                  background: DRAFT_GREY,
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 400,
                  borderRadius: 2,
                  lineHeight: 1,
                }}
              >
                Draft
              </span>
            </div>
          </div>
        </div>

        {/* ---------- Right cluster ---------- */}
        <div
          className="vue-right-controls"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: 12,
            height: 40,
          }}
        >
          <SaveIndicator state="saved" at={savedAt} />

          <FeatureToggle
            checked={featureToggle}
            onChange={setFeatureToggle}
            label="Try new automation features"
          />

          <ReportingButton />

          <HeaderIconButton ariaLabel="More actions">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 17a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0-7a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0-7a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
            </svg>
          </HeaderIconButton>

          <PublishButton />
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- */
/* Left panel                                                  */
/* ---------------------------------------------------------- */

function TriggerPanel({
  activeTab, onTabChange, search, onSearch, collapsed, onCellActivate,
}: {
  activeTab: 'when' | 'then'
  onTabChange: (t: 'when' | 'then') => void
  search: string
  onSearch: (v: string) => void
  collapsed: boolean
  onCellActivate: (cell: PaletteCell) => void
}) {
  const filtered = useMemo(() => {
    const source = activeTab === 'when' ? TRIGGERS : ACTIONS
    return source.filter((t) => t.label.toLowerCase().includes(search.toLowerCase()))
  }, [search, activeTab])

  const cells: PaletteCell[] = useMemo(
    () =>
      filtered.map((t) => ({
        name: t.slug,
        defaultName: t.label,
        icon: <IconSvg svg={t.svg} size={24} />,
        badge:
          t.badge === 'new' ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1,
                color: '#fff',
                background: G.primary,
                padding: '4px 8px',
                borderRadius: 4,
              }}
            >
              New
            </span>
          ) : undefined,
      })),
    [filtered],
  )

  return (
    <div
      id="builder-sidebar"
      aria-hidden={collapsed || undefined}
      style={{
        width: collapsed ? 0 : 'var(--sidebar-width)',
        flexShrink: 0,
        borderRight: collapsed ? 'none' : `1px solid ${G.border}`,
        background: '#fff',
        display: 'flex', flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        transition: 'width var(--sidebar-anim-duration) var(--sidebar-anim-easing)',
      }}
    >
      {/* Tabs row */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px' }}>
        <WhenThenTabs
          aria-label="Trigger type"
          items={[
            // Green to match the When/trigger accent used on canvas nodes.
            { value: 'when', label: 'When', activeColor: G.success },
            { value: 'then', label: 'Then' },
          ] as const}
          value={activeTab}
          onChange={(v) => onTabChange(v)}
          withDivider
          className="flex-1"
        />
      </div>

      {/* Search */}
      <div style={{ padding: 12, borderBottom: `1px solid ${G.border}` }}>
        <PaletteSearchInput
          aria-label="Search triggers"
          placeholder={`Search ${activeTab} triggers`}
          value={search}
          onChange={(e) => onSearch(e.currentTarget.value)}
        />
      </div>

      {/* Palette list */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <PaletteList
          type={activeTab}
          cells={cells}
          onCellActivate={onCellActivate}
        />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- */
/* Canvas                                                      */
/* ---------------------------------------------------------- */

// Node geometry — sized at 80% of the previous scale so tiles, labels, and
// status dots all shrink proportionally together. Previous values shown in
// comments for traceability; new values are the rounded 0.8× result.
const ICON_SIZE = 48 // was 60
const NODE_W = 90 // was 112
const NODE_H = 90 // was 112
const DIAMOND = 90 // was 112
const STATUS_SIZE = 30 // was 38
const STATUS_OVERHANG = 8 // was 10
const TILE_RADIUS = 22 // was 28
const SELECTION_RING = 6 // was 8
const SELECT_ACCENT = '#8358F1' // purple selection stroke per the funnel-editor spec
const LABEL_WIDTH = 373 // was 466
const LABEL_TOP_OFFSET = 122 // was 152
const LABEL_FONT = 26 // was 32

/** Approximate the visual width a node's title will occupy when
 *  rendered with the canvas label rules (wraps to multiple lines at
 *  word boundaries, clamps to LABEL_WIDTH).
 *
 *  Used by tidy-up so columns of nodes with very long titles
 *  (e.g. "Email Confirmation Request") reserve enough horizontal
 *  space that neighbouring sequences never have their titles bleed
 *  into one another. Returns the widest wrapped line, never more
 *  than LABEL_WIDTH and never less than NODE_W (the tile itself
 *  always occupies that much). */
const _titleMeasureCanvas =
  typeof document !== 'undefined' ? document.createElement('canvas') : null
function measureTitleVisualWidth(title: string): number {
  const cap = LABEL_WIDTH
  if (!_titleMeasureCanvas) {
    // SSR fallback — approximate via character count. Slightly
    // pessimistic so we don't pack too tight.
    return Math.max(NODE_W, Math.min(cap, Math.ceil(title.length * LABEL_FONT * 0.6)))
  }
  const ctx = _titleMeasureCanvas.getContext('2d')
  if (!ctx) return Math.max(NODE_W, Math.min(cap, title.length * LABEL_FONT * 0.6))
  // Same font stack the canvas labels render in (system sans).
  ctx.font = `${LABEL_FONT}px Tahoma, "Segoe UI", Arial, sans-serif`
  const oneLine = ctx.measureText(title).width
  if (oneLine <= cap) return Math.max(NODE_W, Math.ceil(oneLine))
  // Multi-line wrap by word — find widest line.
  const words = title.split(/\s+/)
  let line = ''
  let widest = 0
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > cap) {
      widest = Math.max(widest, ctx.measureText(line).width)
      line = w
    } else {
      line = test
    }
  }
  widest = Math.max(widest, ctx.measureText(line).width)
  return Math.max(NODE_W, Math.min(cap, Math.ceil(widest)))
}
const TOOLTIP_TOP_OFFSET = -75 // was -94
const TOOLTIP_FONT = 24 // was 30
// Hover "+" button size (non-latest nodes). 2× the 32-px Figma spec so it
// reads at the same scale as the canvas nodes (which are rendered at the
// 2× Figma scale themselves).
const HOVER_ADD_SIZE = 64

/* ----------------------------------------------------------------- */
/* Per-automation canvas persistence (localStorage)                   */
/* ----------------------------------------------------------------- */
/* Saves the canvas snapshot under a key derived from the automation
 * id, so reopening the same automation restores positions, edges,
 * locked pairs, configs, and camera state exactly where the user
 * left them. React elements (the icon) aren't JSON-serializable, so
 * we strip the icon on save and rebuild it from the slug `name` on
 * load via the same TRIGGERS / ACTIONS catalogs the picker uses. */

type PersistedNode = Omit<BuilderNode, 'icon'>
type PersistedState = {
  /** Schema version — bump if the persisted shape changes so older
   *  cached blobs are ignored instead of crashing. */
  v: number
  nodes: PersistedNode[]
  edges: BuilderEdge[]
  lockedPairs: LockedPair[]
  decisionConfigs: Record<string, unknown>
  purchaseConfigs?: Record<string, unknown>
  appointmentConfigs?: Record<string, unknown>
  pipelineConfigs?: Record<string, unknown>
  pan: { x: number; y: number }
  zoom: number
}

// Bump on any schema or seed-shape change so older cached blobs are
// dropped on load (rather than crashing or reviving stale layouts).
// v2: added the chaotic-image seed for adv2–adv6.
// v3: extended chaotic-image seed to adv1 (DD Test) too.
const CANVAS_STORAGE_VERSION = 3
const canvasStorageKey = (id: string) =>
  `keap-canvas-state:v${CANVAS_STORAGE_VERSION}:${id}`

function loadCanvasState(id: string): PersistedState | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null
  }
  try {
    const raw = localStorage.getItem(canvasStorageKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (!parsed || parsed.v !== CANVAS_STORAGE_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

function saveCanvasState(id: string, state: PersistedState): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(canvasStorageKey(id), JSON.stringify(state))
  } catch {
    // Quota exceeded, storage disabled, or private mode — fail silent.
  }
}

/** Strip the React-element icon from a node before serialising — the
 *  rest of the shape round-trips cleanly as JSON. */
function serializeNode(n: BuilderNode): PersistedNode {
  const { icon: _icon, ...rest } = n
  return rest
}

/** Reconstruct an icon for a persisted node. Decision diamonds get
 *  the default diamond glyph; named triggers/actions look up their
 *  catalog SVG via slug; the two locked-pair members use their
 *  custom glyphs. Returns `undefined` for nodes whose slug isn't in
 *  any catalog (icon will gracefully not render). */
function iconForPersistedNode(node: PersistedNode): React.ReactNode | undefined {
  if (node.type === 'decision') {
    return (
      <svg
        width={ICON_SIZE}
        height={ICON_SIZE}
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <rect
          x="14"
          y="14"
          width="20"
          height="20"
          rx="3"
          transform="rotate(45 24 24)"
          fill={node.accent || G.primary}
        />
      </svg>
    )
  }
  if (!node.name) return undefined
  if (node.name === 'get-email-opt-in') {
    return <IconSvg svg={EMAIL_CONFIRMATION_REQUEST_SVG} size={ICON_SIZE} />
  }
  if (node.name === 'confirm-email') {
    return <IconSvg svg={CONFIRM_EMAIL_SVG} size={ICON_SIZE} />
  }
  const source = node.type === 'trigger' ? TRIGGERS : ACTIONS
  const def = source.find((t) => t.slug === node.name)
  return def ? <IconSvg svg={def.svg} size={ICON_SIZE} /> : undefined
}

function deserializeNode(node: PersistedNode): BuilderNode {
  return { ...node, icon: iconForPersistedNode(node) } as BuilderNode
}

/* ----------------------------------------------------------------- */
/* Chaotic-image seed for adv2–adv6                                   */
/* ----------------------------------------------------------------- */
/* Builds a fresh canvas snapshot whose node IDs match the default
 * DD Test seed (so iconForPersistedNode reconstructs all glyphs)
 * but with three deliberate differences from adv1:
 *
 *   1. Positions are scattered (not aligned on tidy rows) so the
 *      user can demo Tidy Up against an actually-messy canvas.
 *   2. Branch 3 is a LINEAR chain — Create a deal → Apply a note
 *      → Decision Diamond → Notify sales rep — rather than DD2
 *      forking into two siblings. Matches the user's spec image.
 *   3. The second DD's title is the un-configured default
 *      "Decision Diamond" (no rules yet). */
function chaoticImageSeed(): {
  nodes: BuilderNode[]
  edges: BuilderEdge[]
  lockedPairs: LockedPair[]
} {
  // Layout matches the "Messy flow_Manual" reference screenshot — the
  // trigger sits in the lower-left, the first Decision Diamond is
  // roughly center, top branch (Apply loyalty tag → Send loyalty
  // coupon) hooks UP and back, the middle locked pair drifts toward
  // the lower-right, and the Create a deal → Apply a note → … →
  // Notify sales rep tail sweeps along the bottom. d2 is parked just
  // below Apply a note so the chain remains topologically intact even
  // if its tile is barely on screen at the default 50% zoom.
  const base: PersistedNode[] = [
    {
      id: 'n1', type: 'trigger', title: 'When a purchase is made',
      name: 'product-is-purchased',
      x: 220, y: 1400, warning: true, accent: G.success,
    },
    { id: 'd1', type: 'decision', title: 'Customer · Decision Diamond', x: 640, y: 900, warning: true },
    { id: 'n2', type: 'action', title: 'Apply loyalty tag', name: 'apply-or-remove-tag', x: 940, y: 580, accent: G.primary },
    { id: 'n3', type: 'action', title: 'Send loyalty coupon', name: 'send-email', x: 850, y: 290, accent: G.primary },
    // Locked pair (host n4, partner n5) — kept on the SAME y so the
    // lock-decorated connector renders as a straight horizontal line.
    // A render-side guard (lockedPairAlignmentEffect) snaps the
    // partner's y back to the host's y if anything ever desyncs them.
    { id: 'n4', type: 'action', title: 'Email Confirmation Request', name: 'get-email-opt-in', x: 970, y: 990, accent: G.primary },
    { id: 'n5', type: 'trigger', title: 'Confirm Email', name: 'confirm-email', x: 1340, y: 990, accent: G.success },
    { id: 'n6', type: 'action', title: 'Add to nurture sequence', name: 'add-or-remove-from-sequence', x: 1335, y: 610, accent: G.primary },
    {
      id: 'n7', type: 'action', title: 'Create a deal', subtitle: 'High-value pipeline',
      name: 'create-a-deal', x: 620, y: 1880, accent: G.primary,
    },
    { id: 'n9', type: 'action', title: 'Apply a note', name: 'apply-a-note', x: 810, y: 1730, accent: G.primary },
    // d2 here is un-configured (no per-edge rules saved) so it
    // renders with the default "Decision Diamond" title in muted
    // gray, matching the spec screenshot.
    { id: 'd2', type: 'decision', title: 'Decision Diamond', x: 1170, y: 1450, warning: true },
    { id: 'n8', type: 'action', title: 'Notify sales rep', name: 'create-a-task', x: 1680, y: 1340, accent: G.primary },
  ]
  const nodes = base.map(deserializeNode)
  const edges: BuilderEdge[] = [
    { id: 'e1',  from: 'n1', to: 'd1' },
    { id: 'e2',  from: 'd1', to: 'n2' },
    { id: 'e3',  from: 'd1', to: 'n4' },
    { id: 'e4',  from: 'd1', to: 'n7' },
    { id: 'e5',  from: 'n2', to: 'n3' },
    { id: 'e6',  from: 'n4', to: 'n5' }, // locked
    { id: 'e7',  from: 'n5', to: 'n6' },
    // Branch 3 — linear chain in this seed (vs. the fork in adv1).
    { id: 'e8',  from: 'n7', to: 'n9' },
    { id: 'e9',  from: 'n9', to: 'd2' },
    { id: 'e10', from: 'd2', to: 'n8' },
  ]
  const lockedPairs: LockedPair[] = [
    { hostId: 'n4', partnerId: 'n5', edgeId: 'e6' },
  ]
  return { nodes, edges, lockedPairs }
}

/** The list of automation IDs that should boot with the
 *  `chaoticImageSeed` scenario. Everything else (adv1 / unknown
 *  ids) falls through to the inline default seed in the component. */
const CHAOTIC_SEED_AUTOMATION_IDS = new Set([
  'adv1', // Manual organize this messy workflow
  'adv2', // Use Tidy-up to organize this messy workflow
])

function seedForAutomation(id: string): {
  nodes: BuilderNode[]
  edges: BuilderEdge[]
  lockedPairs: LockedPair[]
} | null {
  if (CHAOTIC_SEED_AUTOMATION_IDS.has(id)) return chaoticImageSeed()
  return null
}

/** Inline rename input rendered in the node's title slot. Auto-focuses,
 *  selects all on mount, commits on Enter (with no Shift) or blur (when
 *  non-empty + changed), cancels on Escape. Uses <textarea> so the title
 *  can wrap up to the same 5-line max as the read-only display, with
 *  vertical scroll once the user types past that. */
function RenameInput({
  initial,
  style,
  onCommit,
  onCancel,
}: {
  initial: string
  style: React.CSSProperties
  onCommit: (next: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const ref = React.useRef<HTMLTextAreaElement>(null)
  React.useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const commit = () => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === initial) {
      onCancel()
      return
    }
    onCommit(trimmed)
  }

  // Strip line-clamp / display from the read-only label style so the
  // textarea doesn't try to render in `-webkit-box` mode (which would
  // suppress the cursor). We retain width / position / font from `style`.
  const {
    display: _d,
    WebkitBoxOrient: _o,
    WebkitLineClamp: _c,
    ...passthroughStyle
  } = style as React.CSSProperties & {
    WebkitBoxOrient?: string
    WebkitLineClamp?: number
  }
  // Cap visible height to 5 lines so edit mode matches the read-only
  // 5-line clamp. Beyond that the textarea scrolls.
  const lineHeight = (style.fontSize as number) * 1.2
  const maxHeight = lineHeight * 5

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
        e.stopPropagation()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      rows={1}
      style={{
        ...passthroughStyle,
        height: 'auto',
        maxHeight,
        background: '#FFFFFF',
        border: '1px solid #006ceb',
        borderRadius: 4,
        outline: 'none',
        color: '#000',
        padding: '8px 6px',
        boxSizing: 'border-box',
        resize: 'none',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        overflow: 'auto',
        fontFamily: 'inherit',
      }}
    />
  )
}

function CanvasNode({
  node, selected, inMultiSelection, onActivate, onOpenMenu, onOpenEditor, onMove, zoom,
  showHoverAdd, onHoverAdd, onConnectStart, connectTarget,
  isRenaming, onRequestRename, onCommitTitle, onCancelRename,
}: {
  node: BuilderNode
  selected: boolean
  /** True when this node is part of an active multi-selection (≥ 2
   *  selected). Suppresses the status tooltip so it doesn't fight for
   *  the same space as the floating multi-select toolbar that anchors
   *  to the selection bounding box. */
  inMultiSelection: boolean
  /** Mark this node as (additionally) selected. `shiftKey` true means the
   *  parent should toggle membership in its multi-select set; false means
   *  replace the selection with just this node. Fires on pointerdown so the
   *  purple ring shows immediately — even during drag — without opening
   *  the action menu. */
  onActivate: (shiftKey: boolean) => void
  /** Fires only on a plain click (no drag). Opens the action menu anchored
   *  at the cursor position. Not fired for Shift+Click (multi-select gesture
   *  doesn't open a menu) or during drag. */
  onOpenMenu: (clientX: number, clientY: number) => void
  /** Double-click handler → opens the detailed editor for this node. */
  onOpenEditor: () => void
  /** Called with the new canvas-space (pre-zoom) center coords during drag. */
  onMove: (id: string, x: number, y: number) => void
  /** Current canvas zoom — screen-pixel delta ÷ zoom = canvas-space delta. */
  zoom: number
  /** When true, render the hover "+" affordance to the right of the tile.
   *  Used for non-latest nodes that lack an inline-add placeholder. */
  showHoverAdd: boolean
  /** Fires when the hover "+" is clicked (no drag). Parent opens the step
   *  picker anchored at the cursor. */
  onHoverAdd: (clientX: number, clientY: number) => void
  /** Fires when the user begins dragging from the hover "+". Parent takes
   *  over with window-level pointermove/up to draw a preview connector and
   *  commit an edge if released over another node. `buttonCenter` is the
   *  canvas-space anchor the preview line should originate from. */
  onConnectStart: (
    originId: string,
    clientX: number,
    clientY: number,
    buttonCenter: { x: number; y: number },
  ) => void
  /** True while an in-flight drag-to-connect has this node as its current
   *  drop target. Draws a black focus ring (instead of the usual purple
   *  selection ring) to preview that releasing now will connect here. */
  connectTarget: boolean
  /** When true, the node's title is in inline-edit mode. Triggered by
   *  the action menu's "Rename" — never enabled for decision diamonds. */
  isRenaming: boolean
  /** Fires when the user clicks the title of a non-decision node. Parent
   *  flips that node into rename mode (sets `renamingNodeId`), giving
   *  click-on-title the same behavior as the menu's Rename option. */
  onRequestRename: () => void
  /** Called with the trimmed final title when the user commits the edit
   *  (Enter or blur with a non-empty value). */
  onCommitTitle: (next: string) => void
  /** Called when the user discards the edit (Escape, or blur with no
   *  effective change). */
  onCancelRename: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  // Tracks hover on the "+" button itself (a subset of `hovered`) so the
  // "Drag to connect or click to add" tooltip only appears when the cursor
  // is actually over the button, not over the tile.
  const [hoverAddTooltip, setHoverAddTooltip] = useState(false)
  // Hover is shared between the tile and the hover-"+" button, which sits
  // outside the tile's bounds. Use a ref counter so leaving one while
  // entering the other doesn't flicker hovered → false → true.
  const hoverCountRef = React.useRef(0)
  const onAreaEnter = () => {
    hoverCountRef.current += 1
    if (hoverCountRef.current === 1) setHovered(true)
  }
  const onAreaLeave = () => {
    hoverCountRef.current = Math.max(0, hoverCountRef.current - 1)
    if (hoverCountRef.current === 0) setHovered(false)
  }

  /** Pointer drag with click-vs-drag threshold. Any movement above 3px
   *  (screen) flips to dragging and suppresses selection on pointerup. */
  const dragState = React.useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startNodeX: number
    startNodeY: number
    moved: boolean
    /** Shift was held on pointerdown — skip opening the action menu on
     *  pointerup since Shift+Click is a multi-select gesture, not a
     *  menu-open gesture. */
    shiftKey: boolean
  } | null>(null)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button; ignore right-click / middle-click.
    if (e.button !== 0) return
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    // Activate immediately so the selection outline shows throughout the
    // interaction — both for a plain click and while dragging. Shift+Click
    // toggles multi-select membership instead of replacing the selection.
    onActivate(e.shiftKey)
    dragState.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
      moved: false,
      shiftKey: e.shiftKey,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragState.current
    if (!s || s.pointerId !== e.pointerId) return
    const dxScreen = e.clientX - s.startClientX
    const dyScreen = e.clientY - s.startClientY
    if (!s.moved && Math.hypot(dxScreen, dyScreen) < 3) return
    if (!s.moved) {
      s.moved = true
      setDragging(true)
    }
    const dx = dxScreen / zoom
    const dy = dyScreen / zoom
    onMove(node.id, s.startNodeX + dx, s.startNodeY + dy)
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragState.current
    if (!s || s.pointerId !== e.pointerId) return
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
    const moved = s.moved
    dragState.current = null
    if (moved) {
      setDragging(false)
      // Real drag — do NOT select. The click event (if any) is swallowed by
      // handleClick below.
    } else if (e.type === 'pointerup' && !s.shiftKey) {
      // No movement past threshold AND not a Shift+Click → plain click.
      // Selection already fired on pointerdown; now open the action menu
      // anchored at the cursor. Shift+Click is a multi-select gesture only.
      onOpenMenu(e.clientX, e.clientY)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    // Selection is handled in `endDrag`; this handler only exists to keep
    // the click from bubbling up to the canvas-level deselect handler.
    e.stopPropagation()
  }

  // Status → badge + tooltip. Legacy `warning: true` maps to "setup required".
  const status: CellStatus | null =
    node.status ?? (node.warning ? 'setupRequired' : null)
  const statusStyle = status ? STATUS_STYLES[status] : null

  // Per spec: shadow is black, offsetY 2, opacity 0.5, no blur. Reserve a 3px
  // stroke so the tile doesn't reflow when the purple selection border turns
  // on — implemented with `box-shadow inset` ring switching color, which
  // keeps layout stable.
  const tileShadow = '0 4px 0 rgba(0,0,0,0.5)'
  // Outer selection ring — rendered as a non-inset box-shadow so it sits
  // OUTSIDE the tile's rounded rectangle (think CSS outline, but radius-
  // aware and composable with the drop-shadow). Reserved in both states so
  // toggling selection never reflows layout; only the color changes.
  // Drop-target focus takes precedence over selection so the user can see
  // exactly which node a release would connect to, even if it's already
  // part of the current selection.
  const ringColor = connectTarget
    ? '#000000'
    : selected
    ? SELECT_ACCENT
    : 'transparent'
  const selectionRing = `, 0 0 0 ${SELECTION_RING}px ${ringColor}`
  const boxShadow = tileShadow + selectionRing

  const isDecision = node.type === 'decision'
  const accent = node.accent || (isDecision ? G.primary : G.success)

  return (
    <div
      data-node-id={node.id}
      onClick={handleClick}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onOpenEditor()
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onMouseEnter={onAreaEnter}
      onMouseLeave={onAreaLeave}
      style={{
        position: 'absolute',
        left: node.x - NODE_W / 2,
        top: node.y - NODE_H / 2,
        width: NODE_W,
        height: NODE_H,
        // Outer wrapper is un-styled / un-rotated so the label and status dot
        // stay upright. The tile body (below) carries the fill + shadow and,
        // for decision nodes, a 45° rotation to form the diamond shape.
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        fontFamily: '"Proxima Nova", Inter, system-ui, sans-serif',
      }}
    >
      {/* Tile body — rotated 45° for decision nodes to form the diamond. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: '#FFFFFF',
          borderRadius: TILE_RADIUS,
          boxShadow,
          // Scale by 1/√2 so the rotated square's corners fit inside the
          // original NODE_W × NODE_H bounding box (otherwise they poke past
          // by ~41%, overlapping the label and status dot).
          transform: isDecision ? 'rotate(45deg) scale(0.707)' : undefined,
          transition: dragging ? 'none' : 'box-shadow 120ms ease',
        }}
      />

      {/* Main icon — always un-rotated and centered over the tile. */}
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: ICON_SIZE,
          height: ICON_SIZE,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: accent,
          pointerEvents: 'none',
        }}
      >
        {isDecision
          ? (node.icon ?? (
              // Solid blue diamond glyph — rotated rounded square centered
              // in a 48-viewBox, sized to ~50% of the tile.
              <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 48 48" aria-hidden="true">
                <rect
                  x="14"
                  y="14"
                  width="20"
                  height="20"
                  rx="3"
                  transform="rotate(45 24 24)"
                  fill={accent}
                />
              </svg>
            ))
          : node.icon}
      </span>

      {/* Status bullseye — 16×16, overhangs top-right by 4px each side. */}
      {statusStyle && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            // Dot overhangs the top-right corner by STATUS_OVERHANG on both axes.
            left: NODE_W - STATUS_SIZE + STATUS_OVERHANG,
            top: -STATUS_OVERHANG,
            width: STATUS_SIZE,
            height: STATUS_SIZE,
            pointerEvents: 'none',
          }}
        >
          <svg width={STATUS_SIZE} height={STATUS_SIZE} viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="8" fill={statusStyle.halo} />
            <circle cx="8" cy="8" r="4" fill={statusStyle.dot} />
          </svg>
        </span>
      )}

      {/* Hover tooltip ~40px above the tile, horizontally centered. */}
      {statusStyle && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            // Centered above the 48px tile: translate(-50%) off a 50%-left
            // anchor, then lift to 40px above the tile top.
            left: '50%',
            top: TOOLTIP_TOP_OFFSET,
            transform: 'translate(-50%, 0)',
            background: '#2C2C2C',
            color: '#FFFFFF',
            fontSize: TOOLTIP_FONT,
            fontFamily: '"Proxima Nova", Inter, system-ui, sans-serif',
            lineHeight: 1.2,
            padding: '18px 28px',
            borderRadius: 18,
            whiteSpace: 'nowrap',
            // Hide when:
            //   - the "Drag to connect..." tooltip is showing, or
            //   - this node is part of a multi-selection (the floating
            //     toolbar anchors to the same area as the tooltip).
            opacity:
              hovered &&
              !dragging &&
              !hoverAddTooltip &&
              !inMultiSelection
                ? 1
                : 0,
            transition: 'opacity 120ms ease',
            pointerEvents: 'none',
          }}
        >
          {statusStyle.tooltip}
        </span>
      )}

      {/* Label — 200px wide centered block, 65px below tile top. */}
      {(() => {
        // Title block sits below the tile. Decision diamonds render as
        // muted, non-interactive text (auto-generated from saved rules).
        // Other nodes can be renamed inline via the action menu's Rename
        // or by clicking the title; in edit mode a <textarea> takes over
        // the same slot.
        //
        // Title display rule: wrap to multi-line, clamp to 5 lines max
        // (any overflow truncates with `…` on the 5th line). Width is the
        // shared LABEL_WIDTH so display-space lands ~168 px at default
        // zoom. Line height tuned so 5 lines × line-height ≈ 100 px in
        // display space.
        const labelStyle: React.CSSProperties = {
          position: 'absolute',
          width: LABEL_WIDTH,
          left: (NODE_W - LABEL_WIDTH) / 2,
          top: LABEL_TOP_OFFSET,
          textAlign: 'center',
          fontSize: LABEL_FONT,
          lineHeight: 1.2,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          overflow: 'hidden',
          // Suppress the browser's native text-selection range — Shift+Click
          // multi-select on a tile would otherwise highlight the title as a
          // text run (blue selection box around the words). The RenameInput
          // swap-in is a separate <input>, so blocking selection here doesn't
          // affect the rename flow.
          userSelect: 'none',
          WebkitUserSelect: 'none',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 5,
        }
        if (isRenaming && node.type !== 'decision') {
          return (
            <RenameInput
              initial={node.title}
              style={labelStyle}
              onCommit={onCommitTitle}
              onCancel={onCancelRename}
            />
          )
        }
        const editable = node.type !== 'decision'
        return (
          <span
            style={{
              ...labelStyle,
              color: editable ? '#000' : 'rgba(0,0,0,0.6)',
              // Editable titles intercept pointer events so a click can
              // route to onRequestRename (instead of falling through to
              // the tile's selection / drag handlers). Decision titles
              // stay non-interactive.
              pointerEvents: editable ? 'auto' : 'none',
              cursor: editable ? 'text' : 'default',
              borderRadius: 3,
            }}
            onPointerDown={
              editable
                ? (e) => {
                    // Stop the tile's pointerdown from starting a drag /
                    // selection — pointerdown on title is a rename intent.
                    e.stopPropagation()
                  }
                : undefined
            }
            onClick={
              editable
                ? (e) => {
                    e.stopPropagation()
                    onRequestRename()
                  }
                : undefined
            }
          >
            {node.title}
          </span>
        )
      })()}

      {/* Hover "+" affordance — appears to the right of the tile on hover,
          only for non-latest nodes (those without an inline-add placeholder).
          Shares hover state with the tile via the counter above so moving
          the cursor between tile and button keeps the "+" visible. Its own
          hover state drives a "Drag to connect or click to add" tooltip. */}
      {showHoverAdd && (
        <>
          {/* Invisible hover bridge spanning the gap between the tile's
              right edge and the "+" button. Without this, the cursor
              briefly enters dead space while crossing the 8-px gap and
              the hover counter decays to 0, hiding the "+" mid-transit.
              The bridge is generous vertically so diagonal approaches
              from the label area also keep the "+" active. */}
          <div
            aria-hidden="true"
            onMouseEnter={onAreaEnter}
            onMouseLeave={onAreaLeave}
            style={{
              position: 'absolute',
              left: NODE_W,
              top: (NODE_H - HOVER_ADD_SIZE) / 2 - 12,
              width: 8 + HOVER_ADD_SIZE + 12,
              height: HOVER_ADD_SIZE + 24,
              opacity: hovered && !dragging ? 1 : 0,
              pointerEvents: hovered && !dragging ? 'auto' : 'none',
              // Purely a hit-target; no visual.
              background: 'transparent',
            }}
          />
          {/* Tooltip above the "+" — only while cursor is on the button
              itself, mirroring the status tooltip style. */}
          <span
            role="tooltip"
            style={{
              position: 'absolute',
              // Centered horizontally on the 64×64 button.
              left: NODE_W + 8 + HOVER_ADD_SIZE / 2,
              top: (NODE_H - HOVER_ADD_SIZE) / 2 - 56,
              transform: 'translate(-50%, 0)',
              background: '#2C2C2C',
              color: '#FFFFFF',
              fontSize: TOOLTIP_FONT,
              fontFamily: '"Proxima Nova", Inter, system-ui, sans-serif',
              lineHeight: 1.2,
              padding: '14px 22px',
              borderRadius: 14,
              whiteSpace: 'nowrap',
              opacity: hoverAddTooltip && !dragging ? 1 : 0,
              transition: 'opacity 120ms ease',
              pointerEvents: 'none',
            }}
          >
            Drag to connect or click to add
          </span>
          <button
            type="button"
            aria-label="Add next step"
            onMouseEnter={() => {
              onAreaEnter()
              setHoverAddTooltip(true)
            }}
            onMouseLeave={() => {
              onAreaLeave()
              setHoverAddTooltip(false)
            }}
            onPointerDown={(e) => {
              // The "+" serves two gestures: click-to-add (opens picker) and
              // drag-to-connect (draws a preview line, commits an edge on
              // drop over another node). Distinguish via the standard 3-px
              // threshold. We intentionally do NOT setPointerCapture here so
              // that window-level listeners in the parent can observe moves
              // outside the button bounds once a drag begins.
              if (e.button !== 0) return
              e.stopPropagation()
              const startX = e.clientX
              const startY = e.clientY
              // Snapshot the button's center in canvas-space so the preview
              // line originates from a stable anchor even as the cursor
              // leaves the button. Computed from the button's current rect
              // and the parent's clientToCanvas at drag-start time.
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              const centerClientX = rect.left + rect.width / 2
              const centerClientY = rect.top + rect.height / 2
              let started = false
              const onMove = (ev: PointerEvent) => {
                if (started) return
                if (Math.hypot(ev.clientX - startX, ev.clientY - startY) >= 3) {
                  started = true
                  onConnectStart(
                    node.id,
                    centerClientX,
                    centerClientY,
                    // Parent converts; we pass screen coords via a synthetic
                    // anchor object so the signature stays simple.
                    { x: centerClientX, y: centerClientY },
                  )
                }
              }
              const onUp = (ev: PointerEvent) => {
                window.removeEventListener('pointermove', onMove)
                window.removeEventListener('pointerup', onUp)
                // No drag → treat as click-to-add. If a drag started, the
                // parent's window listeners own the end-of-gesture logic.
                if (!started) onHoverAdd(ev.clientX, ev.clientY)
              }
              window.addEventListener('pointermove', onMove)
              window.addEventListener('pointerup', onUp)
            }}
            style={{
              position: 'absolute',
              left: NODE_W + 8,
              top: (NODE_H - HOVER_ADD_SIZE) / 2,
              width: HOVER_ADD_SIZE,
              height: HOVER_ADD_SIZE,
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              opacity: hovered && !dragging ? 1 : 0,
              transition: 'opacity 120ms ease',
              pointerEvents: hovered && !dragging ? 'auto' : 'none',
            }}
          >
            <svg width={HOVER_ADD_SIZE} height={HOVER_ADD_SIZE} viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="16" fill="black" fillOpacity="0.09" />
              <path
                d="M16 7.90039C16.6075 7.90039 17.0996 8.39249 17.0996 9V14.9004H23C23.6075 14.9004 24.0996 15.3925 24.0996 16C24.0996 16.6075 23.6075 17.0996 23 17.0996H17.0996V23C17.0996 23.6075 16.6075 24.0996 16 24.0996C15.3925 24.0996 14.9004 23.6075 14.9004 23V17.0996H9C8.39249 17.0996 7.90039 16.6075 7.90039 16C7.90039 15.3925 8.39249 14.9004 9 14.9004H14.9004V9C14.9004 8.39249 15.3925 7.90039 16 7.90039Z"
              fill="black"
              fillOpacity="0.825"
              stroke="black"
              strokeWidth="0.2"
            />
          </svg>
        </button>
        </>
      )}
    </div>
  )
}

/** Floating action menu anchored to a selected node. Rendered inside the
 *  zoomed canvas surface so it naturally scales with zoom, and so it moves
 *  with the node as the user drags it (position derives from node.x/y).
 *  Dimensions mirror the reference mock: 176px wide, 6px radius, strong
 *  shadow, 24×24 leading icon per row, 48px row height, red Delete. */
function NodeActionMenu({
  node, anchor, onAction,
}: {
  node: BuilderNode
  /** Canvas-space (pre-zoom) coords of the cursor click that opened the menu.
   *  The menu's top-left corner sits just to the right-bottom of this point. */
  anchor: { x: number; y: number }
  onAction: (action: 'view' | 'settings' | 'duplicate' | 'rename' | 'delete') => void
}) {
  // Decision diamonds have a trimmed menu (no Settings, no Duplicate) since
  // they are structural routing nodes — duplication doesn't carry useful
  // semantics, and there are no per-diamond settings distinct from the
  // rule-group editor that "View and edit" opens.
  const allowedKeys: Array<'view' | 'settings' | 'duplicate' | 'rename' | 'delete'> =
    node.type === 'decision'
      ? // Decision-diamond titles are auto-generated from the saved rules,
        // so renaming them by hand would just get overwritten. Hide the
        // option entirely.
        ['view', 'delete']
      : ['view', 'settings', 'duplicate', 'rename', 'delete']

  const items: Array<{
    key: 'view' | 'settings' | 'duplicate' | 'rename' | 'delete'
    label: string
    icon: React.ReactNode
    danger?: boolean
  }> = ([
    {
      key: 'view',
      label: 'View and edit',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="12" height="16" rx="2" />
          <path d="M15 3l6 6-4 4-6-6z" />
        </svg>
      ),
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
    {
      key: 'duplicate',
      label: 'Duplicate',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      ),
    },
    {
      key: 'rename',
      label: 'Rename',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      ),
    },
    {
      key: 'delete',
      label: 'Delete',
      danger: true,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      ),
    },
  ] as Array<{
    key: 'view' | 'settings' | 'duplicate' | 'rename' | 'delete'
    label: string
    icon: React.ReactNode
    danger?: boolean
  }>).filter((i) => allowedKeys.includes(i.key))

  return (
    <div
      role="menu"
      aria-label={`Actions for ${node.title}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        // Anchor: right-bottom of the cursor click point. Offset so the
        // menu's top-left corner sits just adjacent to the pointer tip
        // rather than under it.
        left: anchor.x + 12,
        top: anchor.y + 12,
        // 1.5× container per spec (was 200). Font/icon sizes doubled
        // separately so content stays legible at the default 50% zoom.
        width: 300,
        background: '#fff',
        borderRadius: 21,
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.12), 0 12px 36px rgba(0,0,0,0.12)',
        padding: '12px 0',
        // Sit above everything else on the canvas surface — the
        // inline-add placeholder embeds DEX `DexIconButton`s whose
        // internal stacking otherwise paints over zIndex:5. 1000 is
        // higher than every canvas-layer element (marquee=5,
        // selection toolbar=60, picker popover=825) so the action
        // menu always wins when it overlaps any of them.
        zIndex: 1000,
      }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          onClick={() => onAction(item.key)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: 18,
            padding: '15px 24px',
            border: 'none', background: 'transparent',
            textAlign: 'left',
            cursor: 'pointer',
            // 2× the source 14px so the menu reads ~14px on-screen at the
            // default 50% canvas zoom.
            fontSize: 28, fontWeight: 500, lineHeight: 1.2,
            color: item.danger ? '#E02500' : G.text,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.04)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <span style={{ color: item.danger ? '#E02500' : G.text, display: 'inline-flex' }}>
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------- */
/* Inline add placeholder + picker                              */
/* ---------------------------------------------------------- */

// Placeholder geometry — literal measurements from the Keap spec:
//   Card 56×100 (double) / 56×56 (single)
//   8px padding from card edge to button halo on all sides
//   Button halo 40×40 (DEX IconButton footprint, holds the hover ring)
//   Glyph 24×24 (colored "+" circle), 8px halo pad on all sides
//   4px vertical gap between stacked halos in the double variant
// Placeholder geometry — scaled 0.8× from the 2× Figma size so the card
// stays in visual proportion with the 80%-sized canvas nodes. Previous
// 2× values in comments for traceability.
const PH_W = 90 // was 112
const PH_SINGLE_H = 90 // was 112
const PH_DOUBLE_H = 157 // was 196
const PH_RADIUS = 19 // was 24
const PH_DASH = '13 13' // was '16 16'
const PH_STROKE = 3 // was 4
/** Border stroke color — matches Tailwind `gray-300` / DEX
 *  `--color-border-strong` (#D1D5DB). */
const PH_BORDER_COLOR = 'var(--color-border-strong, #D1D5DB)'
/** Background — DEX "paper" surface. */
const PH_BG = 'var(--color-surface, #FFFFFF)'
/** Colored circle-plus glyph diameter. Rendered inside the DEX IconButton;
 *  the button's halo extends `PH_BTN_PAD` past each edge of this glyph. */
const PH_BTN_SIZE = 38 // was 48
/** Halo/footprint padding around the glyph. DEX paints its
 *  `bgColor-transparent-hover` overlay here on hover, giving a circular
 *  halo without obscuring the glyph. Total button footprint =
 *  `PH_BTN_SIZE + 2*PH_BTN_PAD` = 40. */
const PH_BTN_PAD = 13 // was 16
/** Vertical gap between the stacked "+ When" and "+ Then" button halos
 *  in the 'double' variant. (Leftover vertical space becomes top/bottom
 *  padding via flex centering.) */
// 13 (card pad) + 64 (halo) + 3 (gap) + 64 (halo) + 13 (card pad) = 157 ✓
const PH_BTN_GAP = 3 // was 4
/** Alias retained for back-compat with existing call sites. */
const PH_GLYPH_SIZE = PH_BTN_SIZE
/** Gap between the origin node's right edge and the placeholder's left edge. */
const PH_GAP = 120
/** Edge-to-edge gap between the two halves of a locked pair (Get email
 *  opt-in → Confirm Email). Wider than the standard PH_GAP so the
 *  enlarged padlock badge has breathing room and the relationship
 *  reads as a deliberate dependency rather than an ordinary step. */
const LOCKED_PAIR_GAP = 240

// Per Figma (node 22548:16973 / 22548:16974):
//   Green/Green 400 #5FC15D for "Add a When"
//   Blue/Blue 400   #1FA0FF for "Add a Then"
const BRAND_GREEN = '#5FC15D'
const BRAND_BLUE_PLUS = '#1FA0FF'

/** Outlined circle-plus glyph — matches DEX's `add-circle` icon (a ring
 *  with an inner "+"), NOT the filled disc. The path comes straight from
 *  `@thryvlabs/dex-react/.../add-circle-*.js` (evenodd) so no ambient CSS
 *  can re-stroke it. `fill` tints the whole glyph. */
function CirclePlusGlyph({ fill, size }: { fill: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill={fill}
        stroke="none"
        fillRule="evenodd"
        d="M12 1c6.075 0 11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12 5.925 1 12 1zm0 2a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3H8a1 1 0 1 1 0-2h3V8a1 1 0 0 1 1-1z"
      />
    </svg>
  )
}

/** Brand-tinted overlay color for `InlineAddIconButton` states. Alpha is the
 *  second argument. Accepts 6-digit hex only. */
function tintOverlay(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** One DEX-style IconButton slot in the placeholder card. Implements the
 *  full state contract (Default / Hover / Pressed / Focus-visible / Disabled)
 *  with brand-tinted overlays instead of DEX's neutral black overlay so the
 *  hover feels "of the action" (green for When, blue for Then).
 *
 *  States:
 *   - Default       → transparent bg, glyph at brand color
 *   - Hover         → bg = brand @ 10%, glyph unchanged
 *   - Pressed       → bg = brand @ 18%
 *   - Focus-visible → 2px outline in brand color (keyboard users only)
 *   - Disabled      → glyph at 40% opacity, no pointer events
 */
function InlineAddIconButton({
  type, brandColor, onClick, disabled,
}: {
  type: 'when' | 'then'
  brandColor: string
  onClick: (clientX: number, clientY: number) => void
  disabled?: boolean
}) {
  const [hover, setHover] = React.useState(false)
  const [pressed, setPressed] = React.useState(false)
  const [focused, setFocused] = React.useState(false)

  // Layered precedence: pressed > hover > default.
  const bg = disabled
    ? 'transparent'
    : pressed
      ? tintOverlay(brandColor, 0.18)
      : hover
        ? tintOverlay(brandColor, 0.1)
        : 'transparent'

  return (
    <DexIconButton
      variant="transparent"
      label={type === 'when' ? 'Add a When trigger' : 'Add a Then action'}
      disabled={disabled}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        if (!disabled) onClick(e.clientX, e.clientY)
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setPressed(false)
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onFocus={(e: React.FocusEvent<HTMLButtonElement>) => {
        // `:focus-visible` semantics — only draw the ring for keyboard focus.
        if (e.target.matches?.(':focus-visible')) setFocused(true)
      }}
      onBlur={() => setFocused(false)}
      style={{
        width: PH_GLYPH_SIZE + PH_BTN_PAD * 2,
        height: PH_GLYPH_SIZE + PH_BTN_PAD * 2,
        padding: PH_BTN_PAD,
        borderRadius: 13,
        flexShrink: 0,
        backgroundColor: bg,
        // 2px brand-colored ring on keyboard focus only. Outline (not box-
        // shadow) so it sits outside the button footprint without shifting
        // layout.
        outline: focused ? `2px solid ${brandColor}` : 'none',
        outlineOffset: focused ? 2 : 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        // Smooth overlay cross-fade matching DEX motion.
        transition: 'background-color 150ms var(--ease-dex, cubic-bezier(0.23, 1, 0.32, 1))',
      }}
    >
      <CirclePlusGlyph fill={brandColor} size={PH_GLYPH_SIZE} />
    </DexIconButton>
  )
}

/** Inline "add-next" placeholder docked to the right of an open node.
 *  - When variant is 'when-only' (origin = Then action): two stacked buttons
 *    — green on top (add another When), blue on bottom (add another Then).
 *  - When variant is 'then-only' (origin = When trigger): a single blue
 *    button (add the first Then).
 *
 *  Spec naming note: the source docs invert the two labels. We follow the
 *  runtime behavior (When origin → one "+", Then origin → two stacked). */
function InlineAddPlaceholder({
  x, y, variant, onAddWhen, onAddThen,
}: {
  /** Canvas-space center of the placeholder card. */
  x: number
  y: number
  variant: 'single' | 'double'
  onAddWhen: (clientX: number, clientY: number) => void
  onAddThen: (clientX: number, clientY: number) => void
}) {
  const height = variant === 'single' ? PH_SINGLE_H : PH_DOUBLE_H

  const button = (type: 'when' | 'then') => (
    <InlineAddIconButton
      key={type}
      type={type}
      brandColor={type === 'when' ? BRAND_GREEN : BRAND_BLUE_PLUS}
      onClick={type === 'when' ? onAddWhen : onAddThen}
    />
  )

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: x - PH_W / 2,
        top: y - height / 2,
        width: PH_W,
        height,
        background: PH_BG,
        borderRadius: PH_RADIUS,
        // No CSS border — CSS `border-style: dashed` gives us an uncontrollable
        // UA-default dash pattern. We paint the dashed outline as an SVG
        // `<rect>` overlay so the `PH_DASH` pattern (e.g. '4 4') actually
        // applies. Keep a matching padding so content insets stay honest.
        boxSizing: 'border-box',
        display: 'inline-flex',
        padding: PH_BTN_PAD,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: PH_BTN_GAP,
      }}
    >
      {/* Dashed border painted as SVG so the dash pattern is controllable.
          The rect is inset by half the stroke so the line paints flush
          inside the card bounds (not half-clipped by overflow). */}
      <svg
        width={PH_W}
        height={height}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <rect
          x={PH_STROKE / 2}
          y={PH_STROKE / 2}
          width={PH_W - PH_STROKE}
          height={height - PH_STROKE}
          rx={PH_RADIUS - PH_STROKE / 2}
          ry={PH_RADIUS - PH_STROKE / 2}
          fill="none"
          stroke={PH_BORDER_COLOR}
          strokeWidth={PH_STROKE}
          strokeDasharray={PH_DASH}
        />
      </svg>
      {variant === 'single'
        ? button('then')
        : [button('when'), button('then')]}
    </div>
  )
}

/** Picker popover shown when a "+" button is clicked. Anchored at the cursor
 *  position (canvas-space), scaled 2× from the 300px spec so the content
 *  reads at roughly the intended size at default 50% zoom.
 *
 *  Layout: a featured "Decision diamond" card sits above the standard
 *  trigger/action list. Picking it inserts a diamond and opens the
 *  Decision-Diamond config modal (where entity-aware rule building lives).
 *  Standard list is unchanged.
 */
function InlineAddPicker({
  type, anchor, items, onPick, onPickDecisionDiamond, onClose,
}: {
  type: 'when' | 'then'
  anchor: { x: number; y: number }
  items: Array<{ slug: string; label: string; svg: string }>
  onPick: (item: { slug: string; label: string; svg: string }) => void
  /** Fired when the user picks the featured Decision-diamond card. The
   *  parent inserts a diamond node and opens its config modal. */
  onPickDecisionDiamond?: () => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(query.toLowerCase()),
  )

  // Decision-diamond search match — surface the featured row whenever the
  // query is empty OR matches "decision" / "diamond".
  const ddMatches =
    query.trim() === '' ||
    'decision diamond'.toLowerCase().includes(query.toLowerCase()) ||
    'diamond'.toLowerCase().includes(query.toLowerCase())

  return (
    <div
      role="dialog"
      aria-label={type === 'when' ? 'Find a when' : 'Find a then'}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: anchor.x,
        top: anchor.y,
        width: 600,
        maxHeight: 700,
        background: '#FFFFFF',
        borderRadius: 24,
        padding: 10,
        boxShadow:
          '0 16px 20px 2px rgba(0,0,0,0.14), 0 6px 28px 4px rgba(0,0,0,0.12), 0 10px 10px -6px rgba(0,0,0,0.2)',
        zIndex: 825,
        fontFamily: HEADER_FONT,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Search input */}
      <div style={{ position: 'relative', height: 80, flexShrink: 0 }}>
        <svg
          width="44"
          height="44"
          viewBox="0 0 24 24"
          fill="none"
          stroke={HEADER_INK}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ position: 'absolute', left: 16, top: 18, pointerEvents: 'none' }}
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search"
          style={{
            width: '100%',
            height: 80,
            padding: '16px 32px 16px 80px',
            fontSize: 28,
            color: HEADER_INK,
            background: '#FFFFFF',
            border: `2px solid ${BRAND_BLUE}`,
            borderRadius: 16,
            outline: 'none',
            fontFamily: HEADER_FONT,
          }}
        />
      </div>

      {/* List */}
      <div
        style={{
          marginTop: 20,
          paddingLeft: 20,
          paddingTop: 24,
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Featured row — Decision diamond. Inserts a diamond node and
            opens its config modal where the entity hierarchy lives. */}
        {ddMatches && onPickDecisionDiamond && (
          <button
            type="button"
            onClick={onPickDecisionDiamond}
            style={{
              width: 'calc(100% - 20px)',
              minHeight: 110,
              marginBottom: 18,
              marginRight: 20,
              padding: '20px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              background: '#F4F1FF',
              border: '2px solid #E0D7FA',
              borderRadius: 18,
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: HEADER_FONT,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#EDE7FE'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#F4F1FF'
            }}
          >
            <span
              aria-hidden
              style={{
                width: 64,
                height: 64,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#8358F1',
              }}
            >
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
                <path
                  d="M28 4 L52 28 L28 52 L4 28 Z"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  fill="#FFFFFF"
                />
              </svg>
            </span>
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                flex: 1,
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: 26, fontWeight: 600, color: HEADER_INK }}>
                Decision diamond
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 400,
                  color: 'rgba(0,0,0,0.6)',
                  lineHeight: 1.3,
                }}
              >
                Branch the flow on a deal, appointment, invoice, job, or contact.
              </span>
            </span>
          </button>
        )}

        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: 'rgba(0, 0, 0, 0.6)',
            margin: '0 0 24px 0',
          }}
        >
          {type === 'when' ? 'Find a when' : 'Find a then'}
        </div>
        {filtered.length === 0 && !ddMatches ? (
          <div style={{ color: 'rgba(0,0,0,0.6)', fontSize: 26, padding: 16 }}>
            No matches
          </div>
        ) : (
          filtered.map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => onPick(item)}
              style={{
                width: '100%',
                minHeight: 98,
                padding: '0 0 0 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: 'transparent',
                border: 'none',
                borderBottom: '2px solid rgba(0,0,0,0.08)',
                borderRadius: 24,
                textAlign: 'left',
                cursor: 'pointer',
                color: HEADER_INK,
                fontSize: 28,
                fontWeight: 400,
                fontFamily: HEADER_FONT,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F0F0F0'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span
                style={{
                  width: 80,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  color: type === 'when' ? BRAND_GREEN : BRAND_BLUE_PLUS,
                }}
              >
                <IconSvg svg={item.svg} size={48} />
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

/* Per Keap funnel-editor spec: same-row connectors are straight segments;
 * different-row connectors are cubic béziers whose control points share Y
 * with their respective endpoints (control1 on source's Y, control2 on
 * target's Y), producing a horizontal exit / S-curve / horizontal arrival. */
function edgePath(x1: number, y1: number, x2: number, y2: number) {
  const dy = y2 - y1
  if (Math.abs(dy) < 2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }
  // ±100 horizontal offset on each control point matches the reference
  // connector's gentle S-curve regardless of row spacing.
  const c1x = x1 + 100
  const c2x = x2 - 100
  return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`
}

/** Inline arrowhead glyph per Keap funnel-editor spec: 37×32 viewBox with the
 *  path ending at x ≈ 27 (10px of empty padding to the right). Rendered at
 *  the line endpoint, offset up by 16 so the shaft is centered on the line. */
const CONNECTOR_ARROW_PATH =
  'M0 16C0 15.3846 0.502437 14.8857 1.12221 14.8857H23.1686' +
  'L19.6603 11.4022C19.2221 10.967 19.2221 10.2615 19.6603 9.82636' +
  'C20.0985 9.39121 20.8091 9.39121 21.2473 9.82636' +
  'L26.6713 15.2121C27.1096 15.6472 27.1096 16.3528 26.6713 16.7879' +
  'L21.2473 22.1737C20.8091 22.6088 20.0985 22.6088 19.6603 22.1737' +
  'C19.2221 21.7385 19.2221 21.033 19.6603 20.5978' +
  'L23.1686 17.1143H1.12221C0.502437 17.1143 0 16.6154 0 16Z'

const CONNECTOR_DEFAULT = '#CCCCCC' // Figma Gray/Gray 400
// Chevron end-cap dimensions (matches Figma node 22548-16964). The line
// arrives horizontally at the target anchor and the chevron's wings extend
// `CHEVRON_W` back along the line and `CHEVRON_H` above/below.
const CHEVRON_W = 15
const CHEVRON_H = 9
const CONNECTOR_SELECTED = '#8358F1'

/* ---------------------------------------------------------- */
/* Bottom toolbar                                              */
/* ---------------------------------------------------------- */

function FloatingPillButton({
  ariaLabel, children, onClick,
}: { ariaLabel: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <span style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)', borderRadius: 8, display: 'inline-flex' }}>
      <DexIconButton variant="outline" label={ariaLabel} onClick={onClick}>
        {children}
      </DexIconButton>
    </span>
  )
}

/** Icon button used in the BottomToolbar. Replaces the DEX
 *  `DexIconButton` whose default hover state is so low-contrast the
 *  icon is barely readable. This variant has:
 *    - White surface, 1px gray border, subtle shadow at rest
 *    - Light-gray fill + dark ink on hover (clearly readable)
 *    - Integrated dark tooltip pill above the button on hover
 *  Two variants: 'outline' (own background + border + shadow, used
 *  in the left cluster) and 'transparent' (no chrome, used for the
 *  zoom in/out buttons inside the shared zoom pill). */
function BottomBarIconButton({
  label,
  onClick,
  variant = 'outline',
  children,
}: {
  label: string
  onClick?: () => void
  variant?: 'outline' | 'transparent'
  children: React.ReactNode
}) {
  const [hover, setHover] = useState(false)
  // Tooltip anchor — captured on mouseenter so the portal-rendered
  // tooltip can render at fixed viewport coords. The bottom bar lives
  // inside an `overflow:hidden` canvas surface, so an absolutely-
  // positioned tooltip inside the button would get clipped by the
  // canvas edge (and the sidebar / cards painted on top by a higher
  // stacking context). Portal + fixed positioning lifts it out of
  // every clipping/stacking parent.
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const base: React.CSSProperties = {
    width: 36,
    height: 36,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease',
    fontFamily: 'inherit',
    color: hover ? '#0F1724' : 'var(--dex-color-gray-1600, #4A4A4A)',
  }
  const outlineStyle: React.CSSProperties = {
    background: hover ? '#F1F2F5' : '#FFFFFF',
    border: `1px solid ${hover ? '#C9CED5' : G.border}`,
    borderRadius: 8,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  }
  const transparentStyle: React.CSSProperties = {
    background: hover ? '#F1F2F5' : 'transparent',
    border: 'none',
    borderRadius: 0,
  }
  const onEnter = () => {
    setHover(true)
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setAnchor({ x: r.left + r.width / 2, y: r.top })
    }
  }
  const onLeave = () => {
    setHover(false)
    setAnchor(null)
  }
  return (
    <span style={{ display: 'inline-flex' }}>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        onClick={onClick}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        style={{ ...base, ...(variant === 'outline' ? outlineStyle : transparentStyle) }}
      >
        {children}
      </button>
      {hover && anchor && typeof document !== 'undefined' &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: 'fixed',
              left: anchor.x,
              top: anchor.y - 8,
              transform: 'translate(-50%, -100%)',
              padding: '6px 10px',
              background: '#272727',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 500,
              lineHeight: '16px',
              borderRadius: 6,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              zIndex: 9999,
            }}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  )
}

/** Right-side slide-out panel listing canvas keyboard shortcuts.
 *  Opens when the bottom-bar Keyboard-shortcuts button is clicked;
 *  closes via the X button, backdrop click, or Escape. Rendered into
 *  `document.body` via a portal so it overlays every canvas/sidebar
 *  layer regardless of the surrounding stacking context. */
/** "Tidy Up is here!" onboarding card. Auto-shows the first time a
 *  tester lands on the adv2 canvas; dismissed via the X button and
 *  not re-shown for the rest of the session. Anchored to the right
 *  side of the canvas as a floating card (not a blocking modal) so
 *  the tester can still see the messy layout behind it. */
function TidyUpIntroCard({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (typeof document === 'undefined') return null
  if (!open) return null
  return createPortal(
    <aside
      role="dialog"
      aria-label="Tidy Up is here!"
      style={{
        position: 'fixed',
        // Per spec, both edges sit 16 px in from the viewport.
        right: 16,
        bottom: 16,
        width: 360,
        maxHeight: 'calc(100vh - 120px)',
        background: '#FFFFFF',
        border: `1px solid ${G.border}`,
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(15, 23, 36, 0.16)',
        padding: '20px 22px 22px',
        fontFamily: 'inherit',
        color: '#0F1724',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 20, lineHeight: 1, marginTop: 1 }} aria-hidden>
          💡
        </span>
        <h2
          style={{
            flex: 1,
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            lineHeight: 1.3,
          }}
        >
          Tidy Up is here!
        </h2>
        <button
          type="button"
          aria-label="Dismiss Tidy Up intro"
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: '#0F1724',
            marginTop: -2,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="6" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: '#4A4A4A' }}>
        Once you select the desired objects, a tool panel will appear with the
        Tidy up tool — click it to instantly clean up and organize your
        selection.
      </p>

      {/* Demo clip — Tidy Up walkthrough as an auto-looping GIF
          served from this app's `public/` folder. GIFs auto-play in
          every browser and use their own indexed palette, so they
          side-step the .mov color-space quirk that made the video
          render darker than the source. No background / mask on the
          element — the raw frames render unmodified. */}
      <img
        src={`${(import.meta as any).env?.BASE_URL || '/'}tidy-up-demo.gif`}
        alt=""
        aria-hidden
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          borderRadius: 8,
        }}
      />
      {/* Original recreated SVG kept commented out below for fallback
          reference — render is now driven by the hosted screenshot. */}
      {false && (
      <svg
        viewBox="0 0 320 290"
        width="100%"
        height="auto"
        aria-hidden
        style={{ display: 'block' }}
      >
        {/* Tile 1 — top-left: green Ebook email open with purple
            (selected) border. */}
        <g transform="translate(28, 40)">
          <rect
            width="42"
            height="42"
            rx="9"
            fill="#FFFFFF"
            stroke="#6D2BD9"
            strokeWidth="1.5"
          />
          <path
            d="M10 15h22v15H10z"
            fill="none"
            stroke="#22C55E"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M10 15l11 8 11-8"
            fill="none"
            stroke="#22C55E"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="36" cy="8" r="3" fill="#F59E0B" />
        </g>
        <text
          x="49"
          y="98"
          fontSize="9"
          fill="#0F1724"
          textAnchor="middle"
          fontFamily="inherit"
        >
          Ebook email open
        </text>

        {/* Edge from top-left tile, dipping down before sweeping
            back up to the top-right tile — mirrors the gentle S-curve
            in the reference image. */}
        <path
          d="M76 60 C 130 80, 130 130, 196 116"
          stroke="#C9CED5"
          strokeWidth="1.3"
          fill="none"
        />

        {/* Tile 2 — top-right: blue Ebook email open with purple
            border. */}
        <g transform="translate(196, 96)">
          <rect
            width="42"
            height="42"
            rx="9"
            fill="#FFFFFF"
            stroke="#6D2BD9"
            strokeWidth="1.5"
          />
          <path
            d="M10 15h22v15H10z"
            fill="none"
            stroke="#2563EB"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M10 15l11 8 11-8"
            fill="none"
            stroke="#2563EB"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="36" cy="8" r="3" fill="#F59E0B" />
        </g>
        <text
          x="217"
          y="154"
          fontSize="9"
          fill="#0F1724"
          textAnchor="middle"
          fontFamily="inherit"
        >
          Ebook email open
        </text>
        {/* Edge stub extending past the top-right tile to the right
            border, hinting at the next sequence node off-canvas. */}
        <line
          x1="240"
          y1="117"
          x2="316"
          y2="117"
          stroke="#C9CED5"
          strokeWidth="1.3"
        />

        {/* Floating selection toolbar — centered above the top-right
            tile, with "Tidy up" tooltip above, three icons in a white
            pill, and a hand cursor pointing at the middle icon. */}
        <g transform="translate(150, 12)">
          {/* Black tooltip pill */}
          <rect x="22" y="0" width="48" height="20" rx="5" fill="#272727" />
          <text
            x="46"
            y="13"
            fontSize="10"
            fill="#FFFFFF"
            textAnchor="middle"
            fontFamily="inherit"
            fontWeight="500"
          >
            Tidy up
          </text>
          {/* Tooltip caret */}
          <path d="M41 20 L 46 25 L 51 20 Z" fill="#272727" />

          {/* White toolbar pill */}
          <rect
            x="0"
            y="32"
            width="92"
            height="28"
            rx="7"
            fill="#FFFFFF"
            stroke="#E4E7EB"
            strokeWidth="1"
          />
          {/* Duplicate icon */}
          <g
            transform="translate(10, 39)"
            fill="none"
            stroke="#0F1724"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="0" y="0" width="9" height="9" rx="1.5" />
            <rect x="3" y="3" width="9" height="9" rx="1.5" fill="#FFFFFF" />
          </g>
          {/* Tidy up dot-grid icon — hovered (gray bg) */}
          <rect x="34" y="36" width="22" height="20" rx="5" fill="#F1F2F5" />
          {[0, 1, 2].map((row) =>
            [0, 1, 2].map((col) => (
              <circle
                key={`${row}-${col}`}
                cx={39 + col * 6}
                cy={41 + row * 5}
                r="1.4"
                fill="#0F1724"
              />
            )),
          )}
          {/* Delete (trash) icon */}
          <g
            transform="translate(67, 39)"
            fill="none"
            stroke="#E02500"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="1" y1="3" x2="13" y2="3" />
            <path d="M3 3v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3" />
            <path d="M5 3V1.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V3" />
          </g>

          {/* Hand cursor pointing at the Tidy up icon */}
          <g transform="translate(40, 60)">
            <path
              d="M3 0 L 3 9 L 6 6.5 L 8 11 L 11 9.5 L 9 5 L 13 5 Z"
              fill="#FFFFFF"
              stroke="#0F1724"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </g>
        </g>

        {/* Tile 3 — middle: blue stack icon with long truncated label.
            Label flows to the right of the tile. */}
        <g transform="translate(108, 168)">
          <rect
            width="42"
            height="42"
            rx="9"
            fill="#FFFFFF"
            stroke="#6D2BD9"
            strokeWidth="1.5"
          />
          <path
            d="M8 17l13-6 13 6-13 6z"
            fill="none"
            stroke="#2563EB"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M8 23l13 6 13-6 M8 29l13 6 13-6"
            fill="none"
            stroke="#2563EB"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="36" cy="8" r="3" fill="#F59E0B" />
        </g>
        {/* Truncated long-label preview — five short lines hinting at
            the 5-row title clamp in the source image. */}
        <g fill="#0F1724" fontSize="8" fontFamily="inherit">
          <text x="158" y="206">I have a very long name</text>
          <text x="158" y="217">on the element maybe I</text>
          <text x="158" y="228">should not do that but I</text>
          <text x="158" y="239">still do that and it will cut</text>
          <text x="158" y="250">at 5 row so please do n…</text>
        </g>

        {/* Edge from bottom-left tile up to the middle stack. */}
        <path
          d="M76 240 C 95 240, 110 202, 128 196"
          stroke="#C9CED5"
          strokeWidth="1.3"
          fill="none"
        />

        {/* Tile 4 — bottom-left: tag tile (Cart - Viewed Product) */}
        <g transform="translate(28, 220)">
          <rect
            width="42"
            height="42"
            rx="9"
            fill="#FFFFFF"
            stroke="#6D2BD9"
            strokeWidth="1.5"
          />
          <path
            d="M22 8l11 11-11 11-11-11z"
            fill="none"
            stroke="#22C55E"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="19" cy="15" r="1.6" fill="#22C55E" />
          <circle cx="36" cy="8" r="3" fill="#E02500" />
        </g>
        <text
          x="49"
          y="278"
          fontSize="9"
          fill="#0F1724"
          textAnchor="middle"
          fontFamily="inherit"
        >
          Cart - Viewed Product&rdquo;
        </text>
      </svg>
      )}

      {/* Shortcut tip box */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: '12px 14px',
          background: '#EEF4FF',
          border: '1px solid #DCE7FB',
          borderRadius: 8,
        }}
      >
        <span aria-hidden style={{ color: '#2563EB', flexShrink: 0, marginTop: 1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </span>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: '#0F1724' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Keyboard shortcuts
          </div>
          <div>
            <strong style={{ fontWeight: 500 }}>Multi-select: </strong>
            <em style={{ fontStyle: 'italic' }}>Shift</em>{' '}+ drag to select
            multiple objects at once.
          </div>
          <div style={{ marginTop: 4 }}>
            <strong style={{ fontWeight: 500 }}>Manual-select: </strong>
            <em style={{ fontStyle: 'italic' }}>Shift</em>{' '}+ click on desired
            objects.
          </div>
        </div>
      </div>
    </aside>,
    document.body,
  )
}

function KeyboardShortcutsPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  // Reset the search box when the panel closes so the next open is
  // a clean state.
  React.useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  if (typeof document === 'undefined') return null

  const PANEL_WIDTH = 360
  const shortcuts: Array<{ label: string; keys: React.ReactNode }> = [
    {
      label: 'Select/unselect',
      keys: (
        <>
          <Kbd>Shift</Kbd>
          <Plus />
          <span style={{ fontSize: 13, color: '#4A4A4A' }}>Click</span>
        </>
      ),
    },
    {
      label: 'Select multiple',
      keys: (
        <>
          <Kbd>Shift</Kbd>
          <Plus />
          <span style={{ fontSize: 13, color: '#4A4A4A' }}>Drag to highlight</span>
        </>
      ),
    },
    {
      label: 'Delete selected item',
      keys: <Kbd>Delete</Kbd>,
    },
    {
      label: 'Duplicate items',
      keys: (
        <>
          <Kbd>Control</Kbd>
          <Plus />
          <span style={{ fontSize: 13, color: '#4A4A4A' }}>Drag</span>
        </>
      ),
    },
    {
      label: 'Find on canvas',
      keys: (
        <>
          <Kbd>⌘</Kbd>
          <Plus />
          <Kbd>j</Kbd>
        </>
      ),
    },
    {
      label: 'Open/close this menu',
      keys: (
        <>
          <Kbd>Shift</Kbd>
          <Plus />
          <Kbd>?</Kbd>
        </>
      ),
    },
    {
      label: 'Zoom out',
      keys: (
        <>
          <Kbd>⌘</Kbd>
          <Plus />
          <Kbd>−</Kbd>
        </>
      ),
    },
    {
      label: 'Zoom in',
      keys: (
        <>
          <Kbd>⌘</Kbd>
          <Plus />
          <Kbd>+</Kbd>
        </>
      ),
    },
  ]
  const q = query.trim().toLowerCase()
  const visible = q
    ? shortcuts.filter((s) => s.label.toLowerCase().includes(q))
    : shortcuts

  return createPortal(
    <>
      {/* Backdrop — captures clicks outside the panel to close it.
          A subtle dim helps the panel pop without burying the canvas. */}
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 36, 0.18)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 180ms ease',
          zIndex: 1200,
        }}
      />
      <aside
        role="dialog"
        aria-label="Keyboard shortcuts"
        aria-hidden={!open}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: PANEL_WIDTH,
          background: '#FFFFFF',
          boxShadow: '-8px 0 24px rgba(15, 23, 36, 0.12)',
          transform: open ? 'translateX(0)' : `translateX(${PANEL_WIDTH + 32}px)`,
          transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          zIndex: 1201,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'inherit',
        }}
      >
        {/* Header — X close, title, platform pill. The platform
            picker is decorative in the prototype (always macOS); the
            chevron hints at a future Windows/Linux toggle. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px 12px',
            borderBottom: `1px solid ${G.border}`,
          }}
        >
          <button
            type="button"
            aria-label="Close keyboard shortcuts"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: '#0F1724',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
          <h2
            style={{
              flex: 1,
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: '#0F1724',
            }}
          >
            Keyboard shortcuts
          </h2>
          <span
            aria-label="macOS shortcuts"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 6,
              background: '#F1F2F5',
              color: '#0F1724',
              fontSize: 13,
              cursor: 'default',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M17.05 12.04c-.03-2.5 2.04-3.7 2.13-3.76-1.16-1.7-2.97-1.94-3.61-1.96-1.54-.16-3 .9-3.78.9-.79 0-1.97-.88-3.24-.86-1.67.03-3.21.97-4.07 2.46-1.74 3.02-.44 7.49 1.25 9.94.83 1.2 1.81 2.54 3.1 2.49 1.25-.05 1.72-.81 3.23-.81 1.5 0 1.92.81 3.25.79 1.34-.02 2.19-1.21 3.01-2.42.95-1.39 1.34-2.74 1.36-2.81-.03-.02-2.6-1-2.63-3.95zM14.69 5.06c.69-.84 1.15-2 1.02-3.16-.99.04-2.19.66-2.9 1.5-.64.74-1.2 1.92-1.05 3.06 1.1.08 2.23-.56 2.93-1.4z" />
            </svg>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 20px 8px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shortcuts"
            aria-label="Search shortcuts"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${G.border}`,
              fontSize: 14,
              color: '#0F1724',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Rows */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 20px 20px',
          }}
        >
          {visible.length === 0 && (
            <p style={{ fontSize: 13, color: '#4A4A4A', padding: '12px 0' }}>
              No shortcuts match “{query}”.
            </p>
          )}
          {visible.map((s) => (
            <div
              key={s.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '14px 0',
                borderBottom: `1px solid ${G.border}`,
                fontSize: 14,
                color: '#0F1724',
              }}
            >
              <span>{s.label}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {s.keys}
              </span>
            </div>
          ))}
        </div>
      </aside>
    </>,
    document.body,
  )
}

/** Single keycap. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 28,
        height: 26,
        padding: '0 8px',
        borderRadius: 6,
        background: '#FFFFFF',
        border: `1px solid ${G.border}`,
        boxShadow: '0 1px 0 rgba(15, 23, 36, 0.08)',
        fontSize: 12,
        fontWeight: 500,
        color: '#0F1724',
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  )
}

/** Small "+" separator between keycaps. */
function Plus() {
  return (
    <span style={{ fontSize: 12, color: '#4A4A4A', padding: '0 2px' }}>+</span>
  )
}

function BottomToolbar({
  zoom, onZoomIn, onZoomOut, onOpenShortcuts, onReopenIntro,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onOpenShortcuts: () => void
  /** When defined, the Help & support button re-opens the Tidy-up
   *  intro card on click. Only passed in on the adv2 canvas; on
   *  every other canvas the button stays inert. */
  onReopenIntro?: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '10px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', pointerEvents: 'none',
      }}
    >
      {/* Left cluster — every canvas tool lives here, including the
          zoom segmented control. Keeping all canvas affordances on
          one side reads as a single toolbar rather than two
          competing clusters. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
        <BottomBarIconButton label="Keyboard shortcuts" onClick={onOpenShortcuts}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="2"/>
            <line x1="6" y1="10" x2="6.01" y2="10"/><line x1="10" y1="10" x2="10.01" y2="10"/><line x1="14" y1="10" x2="14.01" y2="10"/><line x1="18" y1="10" x2="18.01" y2="10"/>
            <line x1="7" y1="14" x2="17" y2="14"/>
          </svg>
        </BottomBarIconButton>
        <BottomBarIconButton label="Notes">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
        </BottomBarIconButton>
        <BottomBarIconButton label="Search on canvas">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </BottomBarIconButton>
        <BottomBarIconButton label="Fit to view">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
          </svg>
        </BottomBarIconButton>

        {/* Zoom segmented pill — moved from the center of the bar
            into the same cluster as every other canvas tool. */}
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 0,
            background: '#fff', border: `1px solid ${G.border}`,
            borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          <BottomBarIconButton variant="transparent" label="Zoom out" onClick={onZoomOut}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </BottomBarIconButton>
          <span style={{ minWidth: 52, textAlign: 'center', fontSize: 13, color: G.text, borderLeft: `1px solid ${G.border}`, borderRight: `1px solid ${G.border}`, padding: '0 8px', lineHeight: '34px' }}>
            {Math.round(zoom * 100)}%
          </span>
          <BottomBarIconButton variant="transparent" label="Zoom in" onClick={onZoomIn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </BottomBarIconButton>
        </div>
      </div>

      {/* Right cluster */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, pointerEvents: 'auto' }}>
        <div style={{ position: 'relative' }} data-help-anchor>
          <button
            type="button"
            aria-label="Help & support"
            onClick={onReopenIntro}
            style={{
              background: '#fff', border: `1px solid ${G.border}`,
              borderRadius: 8, padding: '6px 12px',
              fontSize: 13, color: G.primary, fontWeight: 500,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Help &amp; support
          </button>
          <span
            aria-label="54 unread notifications"
            style={{
              position: 'absolute', top: -6, right: -8,
              minWidth: 20, height: 20, borderRadius: 10,
              background: '#E02500', color: '#fff',
              fontSize: 11, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 6px', border: '2px solid #fff',
            }}
          >
            54
          </span>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- */
/* Decision Diamond editor                                      */
/* ---------------------------------------------------------- */

/** One rule row. Blank values are rendered as "Select" placeholders. */
type DDCondition = {
  id: string
  subject: string
  category: string
  field: string
  operator: string
  values: string[]
}
/** AND-joined conditions inside a single block. Blocks are OR-joined. */
type DDBlock = { id: string; conditions: DDCondition[] }
/** One rule group routes contacts to `targetFlowId` when any block matches. */
type DDGroup = {
  id: string
  targetFlowId: string
  targetName: string
  blocks: DDBlock[]
}
/** Full diamond config. `defaultRouting` is either a connected flowId or
 *  the sentinel `"__drop__"` meaning "Don't put them in a sequence."
 *
 *  `boundEntity` is the higher-level hierarchy: one diamond branches on
 *  exactly one entity (Deal / Appointment / Job / Invoice / Company /
 *  Contact). All rule cards inside the diamond inherit this binding and
 *  scope their field/operator/value pickers to the entity's schema. */
type DecisionDiamondConfig = {
  groups: DDGroup[]
  defaultRouting: string
  boundEntity?: EntityId
  /** Ordered list of rule streams. Each stream maps to one of the
   *  diamond's outgoing branches; rules evaluate top-to-bottom and the
   *  first match wins. Min 1 rule, max 10 (matches HubSpot's branch
   *  cap range / Salesforce Flow's practical UI ceiling). */
  presetRules?: DDPresetRuleSet[]
  /** When the diamond was forked into N siblings (e.g. appointments
   *  with 2+ rules), every sibling shares the same `forkGroupId`. All
   *  siblings carry the full rule list in `presetRules` (redundant
   *  copy) so opening any one of them in the modal still shows every
   *  rule. Each sibling's own rule for canvas chip / title rendering
   *  is `presetRules[forkRuleIndex]`. */
  forkGroupId?: string
  forkRuleIndex?: number
  /** Mode toggle (Manual / Templates) shown only on presets that
   *  declare `showTemplatesToggle: true` (currently
   *  pipeline-stage-is-moved). Defaults to `'manual'` — the standard
   *  rule-builder UI; `'templates'` swaps in a pre-built template
   *  picker. */
  presetMode?: 'manual' | 'templates'
}
type DDPresetRuleSet = {
  /** Stable id used as React key + addressing handle. */
  id: string
  /** Per-rule entity selection (Option C). When `'contact'`, the rule
   *  branches on the universal Contact preset's fields; when `undefined`
   *  or `'primary'`, the rule branches on the diamond's upstream-derived
   *  preset. Each rule in the same diamond can choose independently. */
  entityKey?: 'primary' | 'contact'
  /** Free-form list of AND-joined conditions. Each condition picks a
   *  field from the rule's effective preset, an operator, and one or
   *  more OR-joined values (chips). User can add ("+ And") or remove
   *  conditions; multiple conditions on the same field are allowed
   *  (e.g. Amount ≥ $1k AND Amount < $5k for a tier). */
  conditions: DDPresetCondition[]
  /** When set, this rule was seeded by the AI assistant. Stored so the
   *  rule card can show a "✨ Generated" provenance pill that re-opens
   *  the prompt for refinement. Cleared if the user resets the rule. */
  aiPrompt?: string
}
type DDPresetCondition = {
  /** Stable id for React keying + addressing inside the rule. */
  id: string
  /** Points to a `RulePresetField.id` in the rule's effective preset.
   *  When the rule's entity changes, conditions whose fieldId no longer
   *  resolves are dropped. */
  fieldId: string
  operator: string
  /** Multi-value list joined by `valueJoin` — chips render with a small
   *  comparison label ("Or" or "And") between them. */
  values: string[]
  /** How values are combined when `values.length > 1`. Set when the
   *  user clicks the inline `+ or` or `+ and` affordance on the value
   *  cell. Cleared when the comparator switches to a single-value op. */
  valueJoin?: 'or' | 'and'
}

/** Rough keyword-driven AI stub. Returns a list of conditions for the
 *  given preset based on keywords in the user's prompt. Real LLM call
 *  would replace this fn body — the rest of the wiring stays. */
function mockAiSeedConditions(
  prompt: string,
  preset: RulePreset,
): DDPresetCondition[] {
  const p = prompt.toLowerCase()
  const conds: DDPresetCondition[] = []
  const findField = (id: string) => preset.fields.find((f) => f.id === id)
  const stageEnum = findField('stage')?.enum ?? []
  const has = (re: RegExp) => re.test(p)

  if (has(/high.?value|premium|enterprise|large|big/)) {
    const amt = findField('amount')
    if (amt)
      conds.push({
        id: ddCondId(),
        fieldId: amt.id,
        operator: 'is at least',
        values: ['5000'],
      })
  }
  if (has(/over\s+\$?\d+|above\s+\$?\d+|more\s+than\s+\$?\d+/)) {
    const m = p.match(/\$?(\d{2,7})/)
    const amt = findField('amount')
    if (amt && m) {
      conds.push({
        id: ddCondId(),
        fieldId: amt.id,
        operator: 'is greater than',
        values: [m[1]],
      })
    }
  }
  if (has(/won|closed\W*won|sold|signed|sale/)) {
    const stage = findField('stage')
    if (stage && stageEnum.includes('Won'))
      conds.push({
        id: ddCondId(),
        fieldId: stage.id,
        operator: 'equals',
        values: ['Won'],
      })
  }
  if (has(/lost|win.?back|churn/)) {
    const stage = findField('stage')
    if (stage && stageEnum.includes('Lost'))
      conds.push({
        id: ddCondId(),
        fieldId: stage.id,
        operator: 'equals',
        values: ['Lost'],
      })
  }
  if (has(/stalled|stuck|no.?movement|stagnant|sit/)) {
    const days = findField('daysInStage')
    if (days)
      conds.push({
        id: ddCondId(),
        fieldId: days.id,
        operator: 'is greater than',
        values: ['14'],
      })
  }
  if (has(/onboarding|new.?customer|first.?time/)) {
    const stage = findField('stage')
    if (stage && stageEnum.includes('Won'))
      conds.push({
        id: ddCondId(),
        fieldId: stage.id,
        operator: 'equals',
        values: ['Won'],
      })
    const amt = findField('amount')
    if (amt)
      conds.push({
        id: ddCondId(),
        fieldId: amt.id,
        operator: 'is less than',
        values: ['5000'],
      })
  }
  // Fallback — at least seed an empty condition on the first field so
  // the user can edit further.
  if (conds.length === 0 && preset.fields.length > 0) {
    conds.push({
      id: ddCondId(),
      fieldId: preset.fields[0].id,
      operator: '',
      values: [],
    })
  }
  return conds
}
const ddCondId = () =>
  `c-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
/** Build a default condition list for a freshly-created rule — one
 *  empty condition per field in the rule's effective preset, in
 *  declared order. This keeps the UX matching the prior preset-driven
 *  default while letting the user add / remove conditions freely. */
const defaultConditionsFor = (preset: RulePreset): DDPresetCondition[] =>
  preset.fields.map((f) => ({
    id: ddCondId(),
    fieldId: f.id,
    operator: '',
    values: [],
  }))
const MAX_PRESET_RULES = 10
const ddRuleId = () =>
  `r-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`

/* ---------------------------------------------------------- */
/* "When a purchase is made" trigger config                    */
/* ---------------------------------------------------------- */
/** Configuration for the `product-is-purchased` When trigger. Mirrors the
 *  Keap goal-modal surface: a required single-select purchase type, an
 *  optional product list (only when type='product'), and an optional
 *  payment-type filter. Saved per-node in `purchaseConfigs` so a Save
 *  click commits a draft from the editor. */
type PurchaseTriggerConfig = {
  purchaseType: 'product' | 'any' | null
  productIds: string[]
  paymentTypeIds: string[]
}
const blankPurchaseConfig = (): PurchaseTriggerConfig => ({
  purchaseType: null,
  productIds: [],
  // Pre-seeded per spec: first render opens with these two chips already
  // attached. Both are removable via the chip's × button.
  paymentTypeIds: ['cc-now', 'include-zero'],
})

/** Mock product catalog — replace with a real product API in production. */
const PRODUCT_OPTIONS: Array<{ id: string; name: string; category: string }> = [
  { id: 'prod-1hr', name: '1 Hour Consult', category: 'Uncategorized' },
  { id: 'prod-1-13-21', name: '1.13.21', category: 'Uncategorized' },
  { id: 'prod-1-20-21', name: '1.20.21', category: 'Uncategorized' },
  { id: 'prod-2-3-21', name: '2.3.21', category: 'Uncategorized' },
  { id: 'prod-15', name: '15', category: 'Uncategorized' },
  { id: 'prod-tune-up', name: 'Maintenance Tune-Up', category: 'Service' },
  { id: 'prod-install', name: 'New System Install', category: 'Service' },
  { id: 'prod-quarterly', name: 'Quarterly Pest Plan', category: 'Subscription' },
  { id: 'prod-annual', name: 'Annual Service Plan', category: 'Subscription' },
  { id: 'prod-emerg', name: 'Emergency Visit', category: 'Service' },
]

/** Mock payment-type catalog. Each option carries its own subtext that the
 *  Keap surface renders beneath the label in the dropdown. The first two
 *  ids are the pre-seeded defaults (see blankPurchaseConfig); they appear
 *  as chips on first render and are filtered out of the dropdown list. */
const PAYMENT_TYPE_OPTIONS: Array<{ id: string; label: string; description: string }> = [
  {
    id: 'cc-now',
    label: 'Credit Card (charge now)',
    description: 'Run when payment type is made by credit card (charge now)',
  },
  {
    id: 'include-zero',
    label: 'Include $0 invoices',
    description: 'Run even when the invoice total is $0',
  },
  {
    id: 'cc-manual',
    label: 'Credit Card (Manual)',
    description: 'Run when payment type is made by credit card (manual)',
  },
  { id: 'check', label: 'Check', description: 'Run when payment type is made by check' },
  { id: 'cash', label: 'Cash', description: 'Run when payment type is made by cash' },
  {
    id: 'money-order',
    label: 'Money Order',
    description: 'Run when payment type is made by money order',
  },
  {
    id: 'adjustment',
    label: 'Adjustment',
    description: 'Run when payment type is made by adjustment',
  },
  {
    id: 'any',
    label: 'Any payment type',
    description: 'Run on any payment type (Including any future payment types created)',
  },
]

/* ---------------------------------------------------------- */
/* "Appointments" goal config                                  */
/* ---------------------------------------------------------- */
type AppointmentGoalConfig = {
  whenContact: 'Schedules' | 'Reschedules' | 'Cancels'
  appointmentTypeId: string | null
}
const blankAppointmentGoalConfig = (): AppointmentGoalConfig => ({
  whenContact: 'Schedules',
  appointmentTypeId: null,
})
const APPOINTMENT_WHEN_OPTIONS: Array<'Schedules' | 'Reschedules' | 'Cancels'> = [
  'Schedules',
  'Reschedules',
  'Cancels',
]
/** Mock appointment-type catalog. Production wiring would pull from the
 *  appointments API keyed by tenant. Names + durations match the spec. */
const APPOINTMENT_TYPE_OPTIONS: Array<{ id: string; name: string; duration: string }> = [
  { id: 'apt-1', name: '60-Minute Coaching Call with Whiskers Pawington', duration: '60 minutes' },
  { id: 'apt-2', name: '15-Minute Initial Consultation with Whiskers Pawington', duration: '15 minutes' },
  { id: 'apt-3', name: 'Appointment 2 with Mochi Tofu', duration: '2 hours' },
  { id: 'apt-4', name: 'Appointment 1 with Biscuit Pillow', duration: '15 minutes' },
  { id: 'apt-5', name: 'linting_appt_test with Mochi Tofu', duration: '15 minutes' },
  { id: 'apt-6', name: 'bn_test_appt_type with Catnip Workshop', duration: '30 minutes' },
  { id: 'apt-7', name: 'Online Onboarding with Smudge Whiskerfield', duration: '60 minutes' },
  { id: 'apt-8', name: 'Booking online Meeting with Smudge Whiskerfield', duration: '30 minutes' },
  { id: 'apt-9', name: 'Appointment Test 2 with Biscuit Pillow', duration: '2 hours' },
  { id: 'apt-10', name: 'Test with Olive Pawson', duration: '15 minutes' },
  { id: 'apt-11', name: 'My 15 min test Appt with Marshmallow Pudding', duration: '15 minutes' },
  { id: 'apt-12', name: 'My 15 min test Appt with Marshmallow Pudding', duration: '15 minutes' },
  { id: 'apt-13', name: 'My 15 min test Appt with Pepper Boots', duration: '1 hour and 30 minutes' },
  { id: 'apt-14', name: '60-Minute Coaching Call with Catnip Workshop', duration: '60 minutes' },
  { id: 'apt-15', name: '15-Minute Initial Consultation with Catnip Workshop', duration: '15 minutes' },
  { id: 'apt-16', name: 'Name with Salem Nightshade', duration: '15 minutes' },
  { id: 'apt-17', name: '60-Minute Coaching Call with Catnip Workshop', duration: '60 minutes' },
  { id: 'apt-18', name: '15-Minute Initial Consultation with Catnip Workshop', duration: '15 minutes' },
  { id: 'apt-19', name: 'Quick sync with Catnip Workshop', duration: '30 minutes' },
  { id: 'apt-20', name: 'Test with Catnip Workshop', duration: '30 minutes' },
  { id: 'apt-21', name: 'Office hours with Catnip Workshop', duration: '30 minutes' },
  { id: 'apt-22', name: 'Video Conference Call with Salem Nightshade', duration: '60 minutes' },
  { id: 'apt-23', name: '60-Minute Coaching Call with Catnip Workshop', duration: '60 minutes' },
  { id: 'apt-24', name: '15-Minute Initial Consultation with Catnip Workshop', duration: '15 minutes' },
  { id: 'apt-25', name: '60-Minute Coaching Call with Catnip Workshop', duration: '60 minutes' },
  { id: 'apt-26', name: '15-Minute Initial Consultation with Catnip Workshop', duration: '15 minutes' },
  { id: 'apt-27', name: 'Consultation with Ginger Snaps', duration: '1 hour and 30 minutes' },
  { id: 'apt-28', name: 'Hair Cutz with Mittens Marlowe', duration: '45 minutes' },
  { id: 'apt-29', name: 'Hair Consultation with Mittens Marlowe', duration: '60 minutes' },
  { id: 'apt-30', name: 'meet with Catnip Workshop', duration: '15 minutes' },
]

/* ---------------------------------------------------------- */
/* "Pipeline stage move" goal config                           */
/* ---------------------------------------------------------- */
type PipelineStageMoveConfig = {
  whenMoving: 'Into' | 'Out of' | null
  pipelineId: string | null
  stageId: string | null
}
const blankPipelineStageMoveConfig = (): PipelineStageMoveConfig => ({
  whenMoving: null,
  pipelineId: null,
  stageId: null,
})
const PIPELINE_WHEN_OPTIONS: Array<'Into' | 'Out of'> = ['Into', 'Out of']
/** Mock pipelines — production wiring would fetch these per tenant. */
const PIPELINE_OPTIONS: Array<{ id: string; name: string; stages: Array<{ id: string; name: string }> }> = [
  {
    id: 'pl-sales',
    name: 'Sales Pipeline',
    stages: [
      { id: 'pls-new', name: 'New' },
      { id: 'pls-qualified', name: 'Qualified' },
      { id: 'pls-estimate-sent', name: 'Estimate Sent' },
      { id: 'pls-estimate-signed', name: 'Estimate Signed' },
      { id: 'pls-scheduled', name: 'Scheduled' },
      { id: 'pls-won', name: 'Won' },
      { id: 'pls-lost', name: 'Lost' },
    ],
  },
  {
    id: 'pl-onboarding',
    name: 'Onboarding Pipeline',
    stages: [
      { id: 'plo-welcome', name: 'Welcome' },
      { id: 'plo-kickoff', name: 'Kickoff' },
      { id: 'plo-training', name: 'Training' },
      { id: 'plo-active', name: 'Active' },
    ],
  },
  {
    id: 'pl-renewals',
    name: 'Renewals Pipeline',
    stages: [
      { id: 'plr-upcoming', name: 'Upcoming' },
      { id: 'plr-outreach', name: 'Outreach Sent' },
      { id: 'plr-negotiating', name: 'Negotiating' },
      { id: 'plr-renewed', name: 'Renewed' },
      { id: 'plr-churned', name: 'Churned' },
    ],
  },
]

// DD_* arrays are derived from the canonical option lists in
// ../decisionDiamond/dropdowns.ts so there's a single source of truth.
// The editor's schema stores labels as strings (cond.subject, cond.category,
// cond.field, cond.operator), so we project Option.label out of each list.
const DD_SUBJECTS = SUBJECT_OPTIONS.map((o) => o.label)
const DD_CATEGORIES = FIELD_CATEGORY_OPTIONS.map((o) => o.label)
const DD_FIELDS_BY_CATEGORY: Record<string, string[]> = {
  'Contact Fields': CONTACT_FIELD_OPTIONS.map((o) => o.label),
  Tags: [],
  'Custom Fields': CUSTOM_FIELD_OPTIONS.map((o) => o.label),
  'Constant Contact Fields (From Import)': [],
}
const DD_OPERATORS = OPERATOR_OPTIONS.map((o) => o.label)

/** What kind of input the value picker should render for a given operator.
 *   - `unary`  : no value (operator is self-contained, e.g. "is empty")
 *   - `number` : numeric input (operator's value is N days / a count)
 *   - `asField`: input shape matches the field's own type (text / number /
 *                currency / date / enum) — equality and comparison ops fall
 *                here and adapt to whichever field the user picked. */
type OperatorValueShape = 'unary' | 'number' | 'asField'
const OPERATOR_VALUE_SHAPE_BY_LABEL: Record<string, OperatorValueShape> = (() => {
  const byValue: Record<string, OperatorValueShape> = {
    equals: 'asField',
    notEquals: 'asField',
    isEmpty: 'unary',
    isNotEmpty: 'unary',
    greaterThan: 'asField',
    greaterOrEqual: 'asField',
    lessThan: 'asField',
    lessOrEqual: 'asField',
    isToday: 'unary',
    isTomorrow: 'unary',
    isInThePast: 'unary',
    isInTheFuture: 'unary',
    daysAgoAtLeast: 'number',
    daysAgoAtMost: 'number',
    daysFromNowAtMost: 'number',
  }
  const byLabel: Record<string, OperatorValueShape> = {}
  for (const op of OPERATOR_OPTIONS) {
    byLabel[op.label] = byValue[op.value] ?? 'asField'
  }
  return byLabel
})()
// The unary set in dropdowns.ts is keyed by value; translate to labels.
const DD_UNARY_OPERATORS = new Set(
  OPERATOR_OPTIONS.filter((o) => UNARY_OPERATORS.has(o.value)).map((o) => o.label),
)
// Field-specific value options. Used by the condition-row value picker when
// an enum is appropriate (e.g. Country -> full ISO list).
const DD_VALUE_OPTIONS_BY_FIELD: Record<string, string[]> = {
  Country: COUNTRY_OPTIONS.map((o) => o.label),
}

const ddId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

const makeBlankCondition = (): DDCondition => ({
  id: ddId('c'),
  subject: '',
  category: '',
  field: '',
  operator: '',
  values: [],
})

const makeBlankBlock = (): DDBlock => ({
  id: ddId('b'),
  conditions: [makeBlankCondition()],
})

const makeBlankGroup = (
  targetFlowId: string,
  targetName: string,
  withBlock = false,
): DDGroup => ({
  id: ddId('g'),
  targetFlowId,
  targetName,
  // Empty groups render an info banner + single "Add a rule" CTA. Seeding
  // the first group with one blank block lets the user start typing
  // immediately without an extra click.
  blocks: withBlock ? [makeBlankBlock()] : [],
})

/** Small labeled dropdown styled to match the Keap editor screenshot: a
 *  floating "Select" label above a value, with a right-side chevron. */
function DDSelect({
  label,
  value,
  options,
  onChange,
  width,
  placeholder = 'Select',
}: {
  label?: string
  value: string
  options: string[]
  onChange: (v: string) => void
  width?: number | string
  placeholder?: string
}) {
  return (
    <label
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        minWidth: width ?? 120,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: -8,
          left: 10,
          background: '#fff',
          padding: '0 4px',
          fontSize: 11,
          color: '#6B7280',
          pointerEvents: 'none',
        }}
      >
        {label ?? 'Select'}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          height: 40,
          padding: '0 32px 0 12px',
          borderRadius: 6,
          border: '1px solid #D1D5DB',
          background: `#fff url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>") no-repeat right 10px center`,
          fontSize: 14,
          color: value ? '#111827' : '#9CA3AF',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Inline chip used for value tokens (e.g., `Algeria ×`). */
function DDValueChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: '#F3F4F6',
        borderRadius: 4,
        padding: '2px 6px 2px 8px',
        fontSize: 13,
        color: '#111827',
      }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          border: 'none',
          background: 'transparent',
          color: '#6B7280',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        ×
      </button>
    </span>
  )
}

/** The rule-row value input. Picks the right control for the (operator,
 *  field-type) combination so the user gets the input shape they expect:
 *
 *   - operator is unary       → render nothing (caller already gates on
 *                                hideValue, but we double-guard here)
 *   - operator wants a number → numeric input (e.g. "is at least N days
 *                                ago" — value is N, regardless of field)
 *   - field is enum + value-as-field op → select dropdown (Country, Stage)
 *   - field is number / currency → numeric input
 *   - field is date / datetime → date input
 *   - field is text or unresolved → text input
 *
 *  Multiple values are supported via "+ or": existing values render as
 *  chips, an inline input is offered for the next value. Values are
 *  committed on Enter or blur. */
function DDValueInput({
  valueShape,
  fieldType,
  enumOptions,
  values,
  onChange,
}: {
  valueShape: OperatorValueShape
  fieldType: FieldType | undefined
  enumOptions: string[] | undefined
  values: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  if (valueShape === 'unary') return null

  const commit = (raw: string) => {
    const v = raw.trim()
    if (!v) {
      setDraft('')
      return
    }
    if (values.includes(v)) {
      setDraft('')
      return
    }
    onChange([...values, v])
    setDraft('')
  }
  const remove = (v: string) => onChange(values.filter((x) => x !== v))

  // Decide effective input control.
  const effectiveType: FieldType | 'enum' = (() => {
    if (valueShape === 'number') return 'number'
    if (enumOptions && enumOptions.length > 0) return 'enum'
    if (!fieldType) return 'text'
    return fieldType
  })()

  // Render chips for already-committed values.
  const chips =
    values.length > 0 ? (
      <div
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {values.map((v) => (
          <DDValueChip key={v} label={v} onRemove={() => remove(v)} />
        ))}
      </div>
    ) : null

  // Render the type-appropriate next-value input.
  let input: React.ReactNode = null
  if (effectiveType === 'enum') {
    input = (
      <DDSelect
        value=""
        options={(enumOptions ?? []).filter((o) => !values.includes(o))}
        onChange={(v) => commit(v)}
        width={170}
        placeholder={values.length > 0 ? '+ or' : 'Select'}
      />
    )
  } else {
    const baseInputStyle: React.CSSProperties = {
      height: 40,
      padding: '0 12px',
      fontSize: 14,
      color: '#111827',
      border: '1px solid #D1D5DB',
      borderRadius: 6,
      background: '#FFFFFF',
      outline: 'none',
      boxSizing: 'border-box',
    }
    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commit((e.target as HTMLInputElement).value)
      }
    }
    const onBlur = (e: React.FocusEvent<HTMLInputElement>) =>
      commit(e.currentTarget.value)

    if (effectiveType === 'number') {
      input = (
        <input
          type="number"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={onKey}
          onBlur={onBlur}
          placeholder={values.length > 0 ? '+ or' : 'Enter number'}
          style={{ ...baseInputStyle, width: 140 }}
        />
      )
    } else if (effectiveType === 'currency') {
      input = (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            border: '1px solid #D1D5DB',
            borderRadius: 6,
            background: '#FFFFFF',
            height: 40,
            paddingLeft: 10,
          }}
        >
          <span style={{ color: '#6B7280', fontSize: 14 }}>$</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={onKey}
            onBlur={onBlur}
            placeholder={values.length > 0 ? 'or' : '0.00'}
            style={{
              border: 'none',
              outline: 'none',
              padding: '0 10px 0 4px',
              height: 38,
              fontSize: 14,
              color: '#111827',
              width: 120,
              background: 'transparent',
            }}
          />
        </span>
      )
    } else if (effectiveType === 'date' || effectiveType === 'datetime') {
      input = (
        <input
          type={effectiveType === 'datetime' ? 'datetime-local' : 'date'}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={onKey}
          onBlur={onBlur}
          style={{ ...baseInputStyle, width: 170 }}
        />
      )
    } else if (effectiveType === 'boolean') {
      input = (
        <DDSelect
          value=""
          options={['true', 'false']}
          onChange={(v) => commit(v)}
          width={120}
          placeholder="Select"
        />
      )
    } else {
      // text — and the safe fallback for unresolved field types.
      input = (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={onKey}
          onBlur={onBlur}
          placeholder={values.length > 0 ? '+ or' : 'Enter value'}
          style={{ ...baseInputStyle, width: 200 }}
        />
      )
    }
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {chips}
      {input}
    </div>
  )
}

/** "When a purchase is made" trigger editor. Matches the Keap goal-modal
 *  surface: top header (close · title · primary Save), summary block,
 *  three configuration sections with progressive disclosure.
 *
 *  Save semantics: the editor holds a draft locally; `onSave` commits to
 *  the parent's `purchaseConfigs` map. Closing without Save discards. */
function PurchaseTriggerEditor({
  config: initial,
  onSave,
  onClose,
}: {
  config: PurchaseTriggerConfig
  onSave: (next: PurchaseTriggerConfig) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<PurchaseTriggerConfig>(initial)
  const [productQuery, setProductQuery] = useState('')
  const [productOpen, setProductOpen] = useState(false)
  const [paymentQuery, setPaymentQuery] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [purchaseTypeOpen, setPurchaseTypeOpen] = useState(false)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Esc dismisses any open dropdown first; only closes the modal when
      // no dropdown is open. Matches the spec's "Pressing Escape closes
      // the open dropdown" rule.
      if (purchaseTypeOpen || productOpen || paymentOpen) {
        setPurchaseTypeOpen(false)
        setProductOpen(false)
        setPaymentOpen(false)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, purchaseTypeOpen, productOpen, paymentOpen])

  // Click-outside handlers for the three open dropdowns.
  React.useEffect(() => {
    if (!productOpen && !paymentOpen && !purchaseTypeOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t?.closest('[data-purchase-dropdown]')) {
        setProductOpen(false)
        setPaymentOpen(false)
        setPurchaseTypeOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [productOpen, paymentOpen, purchaseTypeOpen])

  const purchaseTypeOptions: Array<{ id: 'product' | 'any'; label: string; subtext: string }> = [
    { id: 'product', label: 'Product', subtext: 'When a specific product is purchased' },
    { id: 'any', label: 'Any purchase', subtext: 'When any purchase is made' },
  ]
  const selectedPurchaseType = purchaseTypeOptions.find((o) => o.id === draft.purchaseType)

  const filteredProducts = PRODUCT_OPTIONS.filter(
    (p) =>
      !draft.productIds.includes(p.id) &&
      p.name.toLowerCase().includes(productQuery.toLowerCase()),
  )
  const filteredPayments = PAYMENT_TYPE_OPTIONS.filter((p) => {
    if (draft.paymentTypeIds.includes(p.id)) return false
    const q = paymentQuery.toLowerCase()
    return (
      p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    )
  })

  const productById = (id: string) => PRODUCT_OPTIONS.find((p) => p.id === id)
  const paymentById = (id: string) => PAYMENT_TYPE_OPTIONS.find((p) => p.id === id)

  /** Render `text` with the substring matching `query` wrapped in <strong>
   *  so search filters bold-highlight the matching characters. Falls back
   *  to plain text when query is empty or doesn't match. */
  const highlight = (text: string, query: string): React.ReactNode => {
    const q = query.trim()
    if (!q) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <strong style={{ fontWeight: 700 }}>{text.slice(idx, idx + q.length)}</strong>
        {text.slice(idx + q.length)}
      </>
    )
  }

  // Save enabled only when (Field A has a value) AND
  // (if Field A === "Product", Field B has at least one product).
  const canSave =
    draft.purchaseType != null &&
    (draft.purchaseType !== 'product' || draft.productIds.length > 0)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="When a purchase is made"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17, 24, 39, 0.5)',
        zIndex: 1000,
        display: 'flex',
        // Anchor the modal in the upper third of the viewport rather than
        // centering it. paddingTop ~12vh puts the modal's top edge cleanly
        // inside the top-third zone on typical screen heights.
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '12vh 24px 24px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 540,
          maxWidth: '100%',
          background: '#FFFFFF',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          // Visible (not hidden) so dropdown menus rendered inside the body
          // can extend past the modal's bottom/side boundary, matching
          // typical floating-popover behavior.
          overflow: 'visible',
          // Tokens taken directly from the canonical Keap goal-modal markup:
          //   font: Sul Sans (HEADER_FONT)
          //   text color: rgba(0,0,0,.824)
          //   shadow: heavy three-layer
          fontFamily: HEADER_FONT,
          color: 'rgba(0,0,0,0.824)',
          fontSize: 14,
          boxShadow:
            '0 24px 38px 3px rgba(0,0,0,0.14), 0 9px 46px 8px rgba(0,0,0,0.12), 0 11px 15px -7px rgba(0,0,0,0.2)',
        }}
      >
        {/* ----- Header (canonical: 56px height, 8px padding, faint border)
                The title itself carries no padding/margin — visible spacing
                around it comes from the header's 8px padding plus the flex
                layout of leading icon · main · trailing button. ----- */}
        <div
          style={{
            display: 'flex',
            boxSizing: 'border-box',
            height: 56,
            padding: 8,
            margin: 0,
            background: '#FFFFFF',
            border: 0,
            borderBottom: '1px solid rgba(0, 0, 0, 0.09)',
            borderRadius: '12px 12px 0 0',
            alignItems: 'center',
            fontFamily: HEADER_FONT,
          }}
        >
          {/* Leading: close icon button (40×40, 7px padding, gray-1600 icon) */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 40,
                height: 40,
                padding: 7,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: 8,
                color: 'rgb(44, 44, 44)',
              }}
            >
              <svg height="24" width="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path
                  d="M18.707 6.707a1 1 0 0 0-1.414-1.414L12 10.586 6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 1 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12z"
                  fillRule="evenodd"
                />
              </svg>
            </button>
          </div>
          {/* Main: title (20px / 400 / line-height 20px / color #444). The
              h4 itself carries no padding/margin — visible spacing comes
              from the wrapper's flex padding. */}
          <div style={{ flex: 1, padding: '0 8px' }}>
            <h4
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 400,
                lineHeight: '20px',
                color: '#444',
                letterSpacing: 'normal',
              }}
            >
              When a purchase is made
            </h4>
          </div>
          {/* Trailing: primary Save (40px height, 11/15 padding, 8px radius) */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              data-qa="goal-modal-save-button"
              disabled={!canSave}
              onClick={() => {
                // Save and close immediately — no transient toast/tooltip,
                // so the canvas behind doesn't get a chance to flash a
                // hover state through the dimmed overlay.
                onSave(draft)
                // eslint-disable-next-line no-console
                console.log('PurchaseTrigger saved:', JSON.stringify(draft, null, 2))
                onClose()
              }}
              style={{
                height: 40,
                padding: '11px 15px',
                borderRadius: 8,
                border: '1px solid transparent',
                background: canSave ? 'rgb(0, 108, 235)' : 'rgba(0, 108, 235, 0.4)',
                color: '#FFFFFF',
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 600,
                lineHeight: '16px',
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}
            >
              Save
            </button>
          </div>
        </div>

        {/* ----- Body (canonical: white surface, 24px inner padding) ----- */}
        {/* overflow:visible lets the field dropdown menus extend past the
            modal's boundary instead of being clipped at the body bounds.
            The outer overlay is the scroll container if total content
            exceeds the viewport (overflowY:auto on the overlay). */}
        <div
          style={{
            flex: 1,
            overflow: 'visible',
            padding: 24,
            background: '#FFFFFF',
            borderRadius: '0 0 12px 12px',
          }}
        >
          {/* Summary — small muted label + body text, 24px below */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 12,
                lineHeight: '16px',
                color: 'rgba(0,0,0,0.6)',
              }}
            >
              Summary
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 14,
                lineHeight: '20px',
                color: 'rgba(0,0,0,0.824)',
              }}
            >
              This is used to move a contact into or out of an action sequence based on a
              purchase they&rsquo;ve made.
            </div>
          </div>

          {/* Configuration — vertical stack, 16px gap between sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section 1 — Purchase type (canonical input-container layout) */}
          <section data-purchase-dropdown>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setPurchaseTypeOpen((v) => !v)
                  setProductOpen(false)
                  setPaymentOpen(false)
                }}
                style={purchaseInputStyle({ active: purchaseTypeOpen })}
              >
                <div style={purchaseTagsStyle()}>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 14,
                      lineHeight: '20px',
                      color: 'rgba(0,0,0,0.824)',
                    }}
                  >
                    {selectedPurchaseType?.label ?? ''}
                  </span>
                </div>
                <span
                  style={purchaseFloatingLabelStyle(
                    purchaseTypeOpen,
                    selectedPurchaseType != null,
                  )}
                >
                  Select purchase type
                  <span style={{ color: '#d0021b', marginLeft: 2, fontWeight: 600 }}>*</span>
                </span>
                <span style={purchaseChevronStyle()}>
                  <ChevronDown />
                </span>
              </button>
              {purchaseTypeOpen && (
                <DropdownMenu>
                  {purchaseTypeOptions.map((opt) => {
                    const selected = draft.purchaseType === opt.id
                    return (
                      <PurchaseDropdownItem
                        key={opt.id}
                        selected={selected}
                        onClick={() => {
                          setDraft((d) => ({
                            ...d,
                            purchaseType: opt.id,
                            productIds: opt.id === 'any' ? [] : d.productIds,
                          }))
                          setPurchaseTypeOpen(false)
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: 14, color: 'inherit' }}>
                            {opt.label}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: 'inherit',
                              opacity: 0.7,
                              marginTop: 2,
                            }}
                          >
                            {opt.subtext}
                          </span>
                        </div>
                      </PurchaseDropdownItem>
                    )
                  })}
                </DropdownMenu>
              )}
            </div>
          </section>

          {/* Section 2 — Products (canonical input-container layout) */}
          {draft.purchaseType === 'product' && (
            <section data-purchase-dropdown>
              <div style={{ position: 'relative' }}>
                <div
                  style={purchaseInputStyle({ active: productOpen })}
                  onClick={() => setProductOpen(true)}
                >
                  <div style={purchaseTagsStyle()}>
                    {draft.productIds.map((id) => {
                      const p = productById(id)
                      if (!p) return null
                      return (
                        <span key={id} style={chipStyle()}>
                          <span style={{ margin: '0 4px', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${p.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setDraft((d) => ({
                                ...d,
                                productIds: d.productIds.filter((x) => x !== id),
                              }))
                            }}
                            style={chipRemoveStyle()}
                          >
                            <ChipX />
                          </button>
                        </span>
                      )
                    })}
                    <span
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        flex: 1,
                        minWidth: 60,
                        height: 40,
                      }}
                    >
                      <input
                        type="search"
                        autoComplete="off"
                        placeholder=""
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.currentTarget.value)}
                        onFocus={() => setProductOpen(true)}
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                          outline: 'none',
                          fontFamily: 'inherit',
                          fontSize: 14,
                          color: 'rgba(0,0,0,0.824)',
                          background: 'transparent',
                          padding: 0,
                        }}
                      />
                    </span>
                  </div>
                  <span
                    style={purchaseFloatingLabelStyle(
                      productOpen,
                      draft.productIds.length > 0,
                    )}
                  >
                    Select products
                  </span>
                  <span style={purchaseChevronStyle()}>
                    <ChevronDown />
                  </span>
                </div>
                {productOpen && (
                  <DropdownMenu>
                    {filteredProducts.length === 0 ? (
                      <div
                        style={{ padding: '12px 14px', color: '#6B7280', fontSize: 13 }}
                      >
                        No matches
                      </div>
                    ) : (
                      filteredProducts.map((p) => (
                        <PurchaseDropdownItem
                          key={p.id}
                          selected={false}
                          onClick={() => {
                            setDraft((d) => ({
                              ...d,
                              productIds: [...d.productIds, p.id],
                            }))
                            setProductQuery('')
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 14, color: 'inherit' }}>
                              {highlight(p.name, productQuery)}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                color: 'inherit',
                                opacity: 0.7,
                                marginTop: 2,
                              }}
                            >
                              {highlight(p.category, productQuery)}
                            </span>
                          </div>
                        </PurchaseDropdownItem>
                      ))
                    )}
                  </DropdownMenu>
                )}
              </div>
            </section>
          )}

          {/* Section 3 — Payment type (chips-in-input, optional, gated by sentence) */}
          {draft.purchaseType != null && (
            <section style={{ marginTop: 8 }} data-purchase-dropdown>
              <div
                style={{
                  margin: '0 0 12px 0',
                  fontSize: 14,
                  lineHeight: '20px',
                  color: 'rgba(0,0,0,0.824)',
                }}
              >
                and only run on selected payment types
              </div>
              <div style={{ position: 'relative' }}>
                <div
                  style={purchaseInputStyle({ active: paymentOpen })}
                  onClick={() => setPaymentOpen(true)}
                >
                  <div style={purchaseTagsStyle()}>
                    {draft.paymentTypeIds.map((id) => {
                      const p = paymentById(id)
                      if (!p) return null
                      return (
                        <span key={id} style={chipStyle()}>
                          <span style={{ margin: '0 4px', whiteSpace: 'nowrap' }}>
                            {p.label}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${p.label}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setDraft((d) => ({
                                ...d,
                                paymentTypeIds: d.paymentTypeIds.filter((x) => x !== id),
                              }))
                            }}
                            style={chipRemoveStyle()}
                          >
                            <ChipX />
                          </button>
                        </span>
                      )
                    })}
                    <span
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        flex: 1,
                        minWidth: 60,
                        height: 40,
                      }}
                    >
                      <input
                        type="search"
                        autoComplete="off"
                        placeholder=""
                        value={paymentQuery}
                        onChange={(e) => setPaymentQuery(e.currentTarget.value)}
                        onFocus={() => setPaymentOpen(true)}
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                          outline: 'none',
                          fontFamily: 'inherit',
                          fontSize: 14,
                          color: 'rgba(0,0,0,0.824)',
                          background: 'transparent',
                          padding: 0,
                        }}
                      />
                    </span>
                  </div>
                  <span
                    style={purchaseFloatingLabelStyle(
                      paymentOpen,
                      draft.paymentTypeIds.length > 0,
                    )}
                  >
                    Payment type (optional)
                    <span style={{ color: '#d0021b', marginLeft: 2, fontWeight: 600 }}>*</span>
                  </span>
                  <span style={purchaseChevronStyle()}>
                    <ChevronDown />
                  </span>
                </div>
                {paymentOpen && (
                  <DropdownMenu>
                    {filteredPayments.length === 0 ? (
                      <div
                        style={{ padding: '12px 14px', color: '#6B7280', fontSize: 13 }}
                      >
                        No matches
                      </div>
                    ) : (
                      filteredPayments.map((p) => (
                        <PurchaseDropdownItem
                          key={p.id}
                          selected={false}
                          onClick={() => {
                            setDraft((d) => ({
                              ...d,
                              paymentTypeIds: [...d.paymentTypeIds, p.id],
                            }))
                            setPaymentQuery('')
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 14, color: 'inherit' }}>
                              {highlight(p.label, paymentQuery)}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                color: 'inherit',
                                opacity: 0.7,
                                marginTop: 2,
                              }}
                            >
                              {highlight(p.description, paymentQuery)}
                            </span>
                          </div>
                        </PurchaseDropdownItem>
                      ))
                    )}
                  </DropdownMenu>
                )}
              </div>
            </section>
          )}
          </div>
        </div>

      </div>
    </div>
  )
}

/* ---- Small style helpers shared by the purchase modal ---- */
/** Notched-outline input shell — the label sits on the top border, with a
 *  white background "punching out" the border line so it reads as a
 *  Material/Keap-style outlined field. */
/** Canonical field shell — `.input-container`. Tokens from the live Keap
 *  goal modal: 42px height, 8px radius, #cccccc border, white bg. The
 *  chevron and floating label are positioned absolutely on top of this.
 *  Pass `active: true` when the field's dropdown is open — border
 *  switches to 2px blue per the active-state spec. */
function purchaseInputStyle(
  opts: { asContainer?: boolean; active?: boolean } = {},
): React.CSSProperties {
  const active = opts.active ?? false
  return {
    position: 'relative',
    width: '100%',
    height: 42,
    minHeight: 40,
    background: '#FFFFFF',
    border: active ? '2px solid #006CEB' : '1px solid #cccccc',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    boxSizing: 'border-box',
    textAlign: 'left',
    transition: 'border-color .12s ease, box-shadow .12s ease',
  }
}
/** Canonical `.multiselect-tags` — flex container that holds chips + input
 *  with right padding reserved for the absolutely-positioned chevron. */
function purchaseTagsStyle(): React.CSSProperties {
  return {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    minHeight: 40,
    padding: '0 32px 0 12px',
    gap: 0,
  }
}
/** Canonical chevron — absolutely positioned over the right padding. */
function purchaseChevronStyle(): React.CSSProperties {
  return {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 24,
    height: 24,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgb(44, 44, 44)',
    pointerEvents: 'none',
  }
}
/** Floating label rendered absolutely so it overlaps the field's top border
 *  for the notched-outline effect. White background punches out the border. */
function purchaseFloatingLabelStyle(
  active: boolean,
  hasValue: boolean = true,
): React.CSSProperties {
  // At rest (no value, dropdown closed) the label sits inside the field
  // centered-left at 14px. When focused or filled, it floats to the top
  // border in 12px (notched outline) — blue when active, gray otherwise.
  const floated = active || hasValue
  return {
    position: 'absolute',
    left: floated ? 12 : 16,
    top: floated ? -9 : '50%',
    transform: floated ? 'none' : 'translateY(-50%)',
    padding: floated ? '0 4px' : '0',
    background: floated ? '#FFFFFF' : 'transparent',
    fontSize: floated ? 12 : 14,
    lineHeight: floated ? '16px' : '20px',
    color: active ? '#006CEB' : 'rgba(0,0,0,0.6)',
    fontWeight: active ? 600 : 400,
    pointerEvents: 'none',
    zIndex: 1,
    transition: 'top 0.15s ease, font-size 0.15s ease, color 0.12s ease',
  }
}
function chipStyle(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    height: 24,
    padding: '0 4px',
    margin: '4px 8px 4px 0',
    background: 'rgba(0,0,0,0.06)',
    border: 'none',
    borderRadius: 36,
    fontSize: 12,
    lineHeight: '18px',
    color: 'rgba(0,0,0,0.824)',
  }
}
function chipRemoveStyle(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    border: 'none',
    background: 'transparent',
    color: 'rgba(0,0,0,0.5)',
    cursor: 'pointer',
    padding: 0,
    borderRadius: 999,
    marginLeft: 4,
  }
}
function dropdownItemStyle(
  selected: boolean,
  hovered: boolean,
): React.CSSProperties {
  // Selected wins over hovered: solid primary blue with white text.
  // Hovered (when not selected): light gray surface, dark text.
  // Default: white surface, dark text.
  const bg = selected
    ? 'rgb(0, 108, 235)'
    : hovered
      ? 'rgba(0, 0, 0, 0.08)'
      : '#FFFFFF'
  const fg = selected ? '#FFFFFF' : 'rgba(0,0,0,0.824)'
  return {
    width: '100%',
    padding: '8px 16px',
    background: bg,
    border: 'none',
    borderBottom: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    color: fg,
    transition: 'background-color .1s ease',
  }
}

/** Self-managing dropdown item — owns its hover state so the visual
 *  states match the live Keap surface (selected = solid blue, hovered =
 *  light gray, default = white). */
function PurchaseDropdownItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={dropdownItemStyle(selected, hover)}
    >
      {children}
    </button>
  )
}
function ChevronDown() {
  return (
    <svg
      height="24"
      width="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path
        d="M6.293 9.293a1 1 0 0 1 1.414 0L12 13.586l4.293-4.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 0 1 0-1.414z"
        fillRule="evenodd"
      />
    </svg>
  )
}
function ChipX() {
  return (
    <svg height="14" width="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        d="M12 1c6.075 0 11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12 5.925 1 12 1zM8.707 7.293a1 1 0 0 0-1.414 1.414L10.586 12l-3.293 3.293a1 1 0 1 0 1.414 1.414L12 13.414l3.293 3.293a1 1 0 0 0 1.414-1.414L13.414 12l3.293-3.293a1 1 0 0 0-1.414-1.414L12 10.586z"
        fillRule="evenodd"
      />
    </svg>
  )
}
function DropdownMenu({ children }: { children: React.ReactNode }) {
  // Canonical popover from the Keap goal modal: 12px radius, special triple
  // shadow, max-height 240, 6px top/bottom padding.
  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        right: 0,
        minWidth: '100%',
        maxHeight: 240,
        padding: '6px 0',
        background: '#FFFFFF',
        border: '1px solid rgba(0,0,0,0.2)',
        borderRadius: 12,
        boxShadow:
          '0 8px 10px 1px rgba(0,0,0,0.14), 0 3px 14px 2px rgba(0,0,0,0.12), 0 5px 5px -3px rgba(0,0,0,0.2)',
        overflow: 'auto',
        zIndex: 50,
      }}
    >
      {children}
    </div>
  )
}

/* ---------------------------------------------------------- */
/* "Appointment" goal editor                                   */
/* ---------------------------------------------------------- */
/** Modal for the `appointments` When trigger. Two single-selects
 *  ("When a contact" + "an" appointment type) plus a Pro Tip callout.
 *  Mirrors the purchase modal's shell + draft/Save semantics; styling
 *  follows the spec (above-field bold labels, full-width inputs, info
 *  banner with Learn more link). */
function AppointmentGoalEditor({
  config: initial,
  onSave,
  onClose,
}: {
  config: AppointmentGoalConfig
  onSave: (next: AppointmentGoalConfig) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<AppointmentGoalConfig>(initial)
  const [whenOpen, setWhenOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (whenOpen || typeOpen) {
        setWhenOpen(false)
        setTypeOpen(false)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, whenOpen, typeOpen])

  React.useEffect(() => {
    if (!whenOpen && !typeOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t?.closest('[data-appt-dropdown]')) {
        setWhenOpen(false)
        setTypeOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [whenOpen, typeOpen])

  const apptTypeById = (id: string | null) =>
    id ? APPOINTMENT_TYPE_OPTIONS.find((a) => a.id === id) ?? null : null
  const selectedAptType = apptTypeById(draft.appointmentTypeId)

  // Save enabled only when the required appointment type is set.
  const canSave = draft.appointmentTypeId != null

  // Common dropdown trigger — active state (dropdown open) gets a 2px
  // blue border to match the spec's focus treatment.
  const inputStyleFor = (active: boolean): React.CSSProperties => ({
    width: '100%',
    height: 42,
    background: '#FFFFFF',
    border: active ? '2px solid #006CEB' : '1px solid #CCCCCC',
    paddingLeft: active ? 15 : 16,
    paddingRight: active ? 35 : 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    color: 'rgba(0,0,0,0.824)',
    textAlign: 'left',
    position: 'relative',
    boxSizing: 'border-box',
  })
  // Above-field bold label — active state turns the label blue.
  const labelStyleFor = (active: boolean): React.CSSProperties => ({
    display: 'block',
    fontSize: 14,
    fontWeight: 700,
    color: active ? '#006CEB' : 'rgba(0,0,0,0.824)',
    marginBottom: 8,
  })
  const SmallChevron = ({ active }: { active?: boolean }) => (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: active ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
        width: 16,
        height: 16,
        color: active ? '#006CEB' : '#444',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform .15s ease',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path
          d="M6.293 9.293a1 1 0 0 1 1.414 0L12 13.586l4.293-4.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 0 1 0-1.414z"
          fillRule="evenodd"
        />
      </svg>
    </span>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Appointment"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '12vh 24px 24px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 640,
          maxWidth: '100%',
          background: '#FFFFFF',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'visible',
          fontFamily: HEADER_FONT,
          color: 'rgba(0,0,0,0.824)',
          fontSize: 14,
          boxShadow:
            '0 24px 38px 3px rgba(0,0,0,0.14), 0 9px 46px 8px rgba(0,0,0,0.12), 0 11px 15px -7px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            boxSizing: 'border-box',
            height: 56,
            padding: 8,
            background: '#FFFFFF',
            borderBottom: '1px solid rgba(0, 0, 0, 0.09)',
            borderRadius: '12px 12px 0 0',
            alignItems: 'center',
            fontFamily: HEADER_FONT,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 40,
                height: 40,
                padding: 7,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: 8,
                color: '#444',
              }}
            >
              <svg height="24" width="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path
                  d="M18.707 6.707a1 1 0 0 0-1.414-1.414L12 10.586 6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 1 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12z"
                  fillRule="evenodd"
                />
              </svg>
            </button>
          </div>
          <div style={{ flex: 1, padding: '0 8px' }}>
            <h4
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 400,
                lineHeight: '20px',
                color: '#444',
              }}
            >
              Appointment
            </h4>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              data-qa="appt-modal-save-button"
              disabled={!canSave}
              onClick={() => {
                onSave(draft)
                // eslint-disable-next-line no-console
                console.log('AppointmentGoal saved:', JSON.stringify(draft, null, 2))
                onClose()
              }}
              style={{
                height: 40,
                padding: '11px 15px',
                borderRadius: 8,
                border: '1px solid transparent',
                background: canSave ? '#006CEB' : 'rgba(0, 108, 235, 0.4)',
                color: '#FFFFFF',
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 600,
                lineHeight: '16px',
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}
            >
              Save
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 24, background: '#FFFFFF', borderRadius: '0 0 12px 12px' }}>
          {/* Summary */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: 'rgba(0,0,0,0.6)',
                marginBottom: 4,
              }}
            >
              Summary
            </div>
            <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.824)', lineHeight: '20px' }}>
              This is used to move a contact into or out of an action sequence when an
              appointment is booked, canceled, or rescheduled.
            </div>
          </div>

          {/* When a contact */}
          <div style={{ marginBottom: 20 }} data-appt-dropdown>
            <label style={labelStyleFor(whenOpen)}>When a contact</label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setWhenOpen((v) => !v)
                  setTypeOpen(false)
                }}
                style={inputStyleFor(whenOpen)}
              >
                <span style={{ flex: 1 }}>{draft.whenContact}</span>
                <SmallChevron active={whenOpen} />
              </button>
              {whenOpen && (
                <DropdownMenu>
                  {APPOINTMENT_WHEN_OPTIONS.map((opt) => (
                    <PurchaseDropdownItem
                      key={opt}
                      selected={draft.whenContact === opt}
                      onClick={() => {
                        setDraft((d) => ({ ...d, whenContact: opt }))
                        setWhenOpen(false)
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{opt}</span>
                    </PurchaseDropdownItem>
                  ))}
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* an appointment type */}
          <div style={{ marginBottom: 20 }} data-appt-dropdown>
            <label style={labelStyleFor(typeOpen)}>an</label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setTypeOpen((v) => !v)
                  setWhenOpen(false)
                }}
                style={inputStyleFor(typeOpen)}
              >
                <span style={{ flex: 1 }}>
                  {selectedAptType ? (
                    selectedAptType.name
                  ) : (
                    <>
                      <span style={{ color: 'rgba(0,0,0,0.6)' }}>
                        Select an appointment type
                      </span>
                      <span
                        style={{ color: '#d0021b', marginLeft: 4, fontWeight: 600 }}
                      >
                        *
                      </span>
                    </>
                  )}
                </span>
                <SmallChevron active={typeOpen} />
              </button>
              {typeOpen && (
                <DropdownMenu>
                  {APPOINTMENT_TYPE_OPTIONS.map((opt) => (
                    <PurchaseDropdownItem
                      key={opt.id}
                      selected={draft.appointmentTypeId === opt.id}
                      onClick={() => {
                        setDraft((d) => ({ ...d, appointmentTypeId: opt.id }))
                        setTypeOpen(false)
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 14, color: 'inherit' }}>{opt.name}</span>
                        <span
                          style={{
                            fontSize: 12,
                            color: 'inherit',
                            opacity: 0.7,
                            marginTop: 2,
                          }}
                        >
                          {opt.duration}
                        </span>
                      </div>
                    </PurchaseDropdownItem>
                  ))}
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Pro tip callout */}
          <div
            style={{
              background: '#D6F0FF',
              borderRadius: 8,
              padding: 12,
              display: 'flex',
              gap: 12,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 20,
                height: 20,
                flexShrink: 0,
                color: '#006CEB',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1zm0 8a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"
                />
              </svg>
            </span>
            <div style={{ flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: '20px',
                  color: 'rgba(0,0,0,0.824)',
                }}
              >
                <strong>Pro tip:</strong> You can use this Appointments goal to stop an
                automation as well as starting an automation.
              </p>
              <a
                href="https://help.keap.com/help/campaign-goals-appointments"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 10,
                  background: 'rgba(0,0,0,0.06)',
                  color: 'rgba(0,0,0,0.824)',
                  borderRadius: 8,
                  padding: '8px 12px 8px 8px',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Learn more
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M14 3h7v7" />
                  <path d="M21 3l-9 9" />
                  <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Modal for the `pipeline-stage-is-moved` When trigger. Cloned from the
 *  Appointment goal editor — same shell, same dropdown styling, same
 *  draft/Save semantics. Three required selects (When moving / Pipeline
 *  / Stage) plus a Pro-tip callout. Stage options filter by the picked
 *  pipeline; Stage clears whenever the Pipeline selection changes. */
function PipelineStageMoveEditor({
  config: initial,
  onSave,
  onClose,
}: {
  config: PipelineStageMoveConfig
  onSave: (next: PipelineStageMoveConfig) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<PipelineStageMoveConfig>(initial)
  const [whenOpen, setWhenOpen] = useState(false)
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const [stageOpen, setStageOpen] = useState(false)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (whenOpen || pipelineOpen || stageOpen) {
        setWhenOpen(false)
        setPipelineOpen(false)
        setStageOpen(false)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, whenOpen, pipelineOpen, stageOpen])

  React.useEffect(() => {
    if (!whenOpen && !pipelineOpen && !stageOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t?.closest('[data-pipeline-dropdown]')) {
        setWhenOpen(false)
        setPipelineOpen(false)
        setStageOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [whenOpen, pipelineOpen, stageOpen])

  const selectedPipeline =
    PIPELINE_OPTIONS.find((p) => p.id === draft.pipelineId) ?? null
  const selectedStage =
    selectedPipeline?.stages.find((s) => s.id === draft.stageId) ?? null

  // Save enabled only when all three required fields are set.
  const canSave =
    draft.whenMoving != null &&
    draft.pipelineId != null &&
    draft.stageId != null

  // Shared input + label styles — match the Appointment editor exactly.
  /** Field shell — active state (dropdown open) gets a blue 2px border
   *  to match the spec's focus treatment. Default border is 1px gray.
   *  Height matches the Appointment modal's 42px so all goal-trigger
   *  modals share one input size. */
  const inputStyleFor = (active: boolean): React.CSSProperties => ({
    width: '100%',
    height: 42,
    background: '#FFFFFF',
    border: active ? '2px solid #006CEB' : '1px solid #CCCCCC',
    // Compensate for the 1px → 2px border shift so layout doesn't twitch.
    paddingLeft: active ? 15 : 16,
    paddingRight: active ? 35 : 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    color: 'rgba(0,0,0,0.824)',
    textAlign: 'left',
    position: 'relative',
    boxSizing: 'border-box',
  })
  /** Material-style floating label. At rest (no value, dropdown closed),
   *  the label sits *inside* the field at center-left in 14px gray.
   *  When the field is active (open) OR has a committed value, the
   *  label floats to the top border in 12px (notched outline), turning
   *  blue if active. The transition uses a 150ms ease so the motion
   *  reads as a single property change. */
  const labelStyleFor = (
    active: boolean,
    hasValue: boolean,
  ): React.CSSProperties => {
    const floated = active || hasValue
    return {
      position: 'absolute',
      left: floated ? 12 : 16,
      top: floated ? -9 : '50%',
      transform: floated ? 'none' : 'translateY(-50%)',
      padding: floated ? '0 4px' : '0',
      background: floated ? '#FFFFFF' : 'transparent',
      fontSize: floated ? 12 : 14,
      lineHeight: floated ? '16px' : '20px',
      color: active ? '#006CEB' : 'rgba(0,0,0,0.6)',
      fontWeight: active ? 600 : 400,
      pointerEvents: 'none',
      zIndex: 1,
      transition: 'top 0.15s ease, font-size 0.15s ease, color 0.12s ease',
    }
  }
  const SmallChevron = ({ active }: { active?: boolean }) => (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: active ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
        width: 16,
        height: 16,
        color: active ? '#006CEB' : '#444',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform .15s ease',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path
          d="M6.293 9.293a1 1 0 0 1 1.414 0L12 13.586l4.293-4.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 0 1 0-1.414z"
          fillRule="evenodd"
        />
      </svg>
    </span>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pipeline stage move"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '12vh 24px 24px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 640,
          maxWidth: '100%',
          background: '#FFFFFF',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'visible',
          fontFamily: HEADER_FONT,
          color: 'rgba(0,0,0,0.824)',
          fontSize: 14,
          boxShadow:
            '0 24px 38px 3px rgba(0,0,0,0.14), 0 9px 46px 8px rgba(0,0,0,0.12), 0 11px 15px -7px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            boxSizing: 'border-box',
            height: 56,
            padding: 8,
            background: '#FFFFFF',
            borderBottom: '1px solid rgba(0, 0, 0, 0.09)',
            borderRadius: '12px 12px 0 0',
            alignItems: 'center',
            fontFamily: HEADER_FONT,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 40,
                height: 40,
                padding: 7,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: 8,
                color: '#444',
              }}
            >
              <svg height="24" width="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path
                  d="M18.707 6.707a1 1 0 0 0-1.414-1.414L12 10.586 6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 1 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12z"
                  fillRule="evenodd"
                />
              </svg>
            </button>
          </div>
          <div style={{ flex: 1, padding: '0 8px' }}>
            <h4
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 400,
                lineHeight: '20px',
                color: '#444',
              }}
            >
              Pipeline stage move
            </h4>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              data-qa="pipeline-modal-save-button"
              disabled={!canSave}
              onClick={() => {
                onSave(draft)
                // eslint-disable-next-line no-console
                console.log('PipelineStageMove saved:', JSON.stringify(draft, null, 2))
                onClose()
              }}
              style={{
                height: 40,
                padding: '11px 15px',
                borderRadius: 8,
                border: '1px solid transparent',
                background: canSave ? '#006CEB' : 'rgba(0, 108, 235, 0.4)',
                color: '#FFFFFF',
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 600,
                lineHeight: '16px',
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}
            >
              Save
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 24, background: '#FFFFFF', borderRadius: '0 0 12px 12px' }}>
          {/* Summary */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: 'rgba(0,0,0,0.6)',
                marginBottom: 4,
              }}
            >
              Summary
            </div>
            <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.824)', lineHeight: '20px' }}>
              Trigger automation when a deal is moved into or out of a particular stage
              within a Pipeline.
            </div>
          </div>

          {/* When moving */}
          <div style={{ marginBottom: 16 }} data-pipeline-dropdown>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setWhenOpen((v) => !v)
                  setPipelineOpen(false)
                  setStageOpen(false)
                }}
                style={inputStyleFor(whenOpen)}
              >
                <span style={{ flex: 1, color: draft.whenMoving ? 'rgba(0,0,0,0.824)' : 'transparent' }}>
                  {draft.whenMoving ?? '·'}
                </span>
                <SmallChevron active={whenOpen} />
              </button>
              <span style={labelStyleFor(whenOpen, draft.whenMoving != null)}>
                When moving
                <span style={{ color: '#d0021b', marginLeft: 2, fontWeight: 600 }}>*</span>
              </span>
              {whenOpen && (
                <DropdownMenu>
                  {PIPELINE_WHEN_OPTIONS.map((opt) => (
                    <PurchaseDropdownItem
                      key={opt}
                      selected={draft.whenMoving === opt}
                      onClick={() => {
                        setDraft((d) => ({ ...d, whenMoving: opt }))
                        setWhenOpen(false)
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{opt}</span>
                    </PurchaseDropdownItem>
                  ))}
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Pipeline */}
          <div style={{ marginBottom: 16 }} data-pipeline-dropdown>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setPipelineOpen((v) => !v)
                  setWhenOpen(false)
                  setStageOpen(false)
                }}
                style={inputStyleFor(pipelineOpen)}
              >
                <span style={{ flex: 1, color: selectedPipeline ? 'rgba(0,0,0,0.824)' : 'transparent' }}>
                  {selectedPipeline?.name ?? '·'}
                </span>
                <SmallChevron active={pipelineOpen} />
              </button>
              <span style={labelStyleFor(pipelineOpen, selectedPipeline != null)}>
                Pipeline
                <span style={{ color: '#d0021b', marginLeft: 2, fontWeight: 600 }}>*</span>
              </span>
              {pipelineOpen && (
                <DropdownMenu>
                  {PIPELINE_OPTIONS.map((p) => (
                    <PurchaseDropdownItem
                      key={p.id}
                      selected={draft.pipelineId === p.id}
                      onClick={() => {
                        // Clear the stage when the pipeline changes — the
                        // old stage id won't resolve under the new
                        // pipeline.
                        setDraft((d) => ({
                          ...d,
                          pipelineId: p.id,
                          stageId: d.pipelineId === p.id ? d.stageId : null,
                        }))
                        setPipelineOpen(false)
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{p.name}</span>
                    </PurchaseDropdownItem>
                  ))}
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Stage — disabled until a Pipeline is picked */}
          <div style={{ marginBottom: 20 }} data-pipeline-dropdown>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                disabled={!selectedPipeline}
                onClick={() => {
                  if (!selectedPipeline) return
                  setStageOpen((v) => !v)
                  setWhenOpen(false)
                  setPipelineOpen(false)
                }}
                style={{
                  ...inputStyleFor(stageOpen),
                  cursor: selectedPipeline ? 'pointer' : 'not-allowed',
                  background: selectedPipeline ? '#FFFFFF' : '#F5F5F5',
                }}
              >
                <span style={{ flex: 1, color: selectedStage ? 'rgba(0,0,0,0.824)' : 'transparent' }}>
                  {selectedStage?.name ?? '·'}
                </span>
                <SmallChevron active={stageOpen} />
              </button>
              <span style={labelStyleFor(stageOpen, selectedStage != null)}>
                Stage
                <span style={{ color: '#d0021b', marginLeft: 2, fontWeight: 600 }}>*</span>
              </span>
              {stageOpen && selectedPipeline && (
                <DropdownMenu>
                  {selectedPipeline.stages.map((s) => (
                    <PurchaseDropdownItem
                      key={s.id}
                      selected={draft.stageId === s.id}
                      onClick={() => {
                        setDraft((d) => ({ ...d, stageId: s.id }))
                        setStageOpen(false)
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{s.name}</span>
                    </PurchaseDropdownItem>
                  ))}
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Pro tip callout */}
          <div
            style={{
              background: '#D6F0FF',
              borderRadius: 8,
              padding: 12,
              display: 'flex',
              gap: 12,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 20,
                height: 20,
                flexShrink: 0,
                color: '#006CEB',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1zm0 8a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"
                />
              </svg>
            </span>
            <div style={{ flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: '20px',
                  color: 'rgba(0,0,0,0.824)',
                }}
              >
                <strong>Pro-tip:</strong> If the goal is selected to trigger when a Deal
                is moved &lsquo;Into&rsquo; a stage, it won&rsquo;t trigger when creating
                a Deal in that stage either manually or through Easy/Automation Builder.
                The Deal must instead be moved from another stage into that stage to
                trigger the goal. For a solution that will trigger based on the
                Deal&rsquo;s starting stage, you can use an Easy Automation
                &lsquo;Deal enters stage&rsquo; trigger.
              </p>
              <a
                href="https://help.keap.com/help/campaign-goals-pipeline-stage-move"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 10,
                  background: 'rgba(0,0,0,0.06)',
                  color: 'rgba(0,0,0,0.824)',
                  borderRadius: 8,
                  padding: '8px 12px 8px 8px',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Learn more
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M14 3h7v7" />
                  <path d="M21 3l-9 9" />
                  <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- */
/* Rule preset registry                                         */
/* ---------------------------------------------------------- */
/**
 *  A `RulePreset` is the declarative contract between an upstream node
 *  type and a rule-builder modal. Given the upstream slug, the modal
 *  knows which fields to render, what operators each field accepts, and
 *  what input shape each value expects.
 *
 *  Adding a new preset = one entry in `RULE_PRESETS`. Different node
 *  types (decision diamond, future filter / update / branch nodes)
 *  consume the same registry and renderer, so rule-input UX stays
 *  consistent across the canvas.
 */
type RulePresetField = {
  /** Stable id; used as the key inside `config.presetFlow`. */
  id: string
  /** Human label shown to the left of the row. */
  label: string
  /** Drives the value-input shape: enum → select, currency → $ input,
   *  number → numeric, date → date, etc. */
  type: FieldType
  /** Operators offered for this field. */
  operators: string[]
  /** Enum values when `type === 'enum'`. */
  enum?: string[]
}
type RulePreset = {
  /** Entity name shown in the canvas node title (e.g. "Deal",
   *  "Appointment"). Reflects the upstream-derived entity context. */
  entity: string
  /** One-line context string shown in the Summary card. */
  summary: string
  /** Title at the top of the conditions card (e.g. "If the deal"). */
  header: string
  /** Helper text under the header explaining the if/else semantics. */
  helperText: string
  /** Ordered list of pre-built rule rows. */
  fields: RulePresetField[]
  /** When true, the modal renders a Manual / Templates toggle between
   *  the Summary and the rule stack. Currently set only on the
   *  pipeline-stage-is-moved preset. */
  showTemplatesToggle?: boolean
}

/** Registry: upstream slug → preset definition. */
const RULE_PRESETS: Record<string, RulePreset> = {
  'product-is-purchased': {
    entity: 'Deal',
    summary:
      'A purchase just generated a deal. Evaluate the deal to decide which branch to follow.',
    header: 'If the deal',
    helperText:
      'Rules evaluate top-to-bottom — the first match decides which stream the contact follows. Anything that doesn’t match any rule falls through to the default branch.',
    fields: [
      {
        id: 'amount',
        label: 'Amount',
        type: 'currency',
        operators: [
          'is greater than',
          'is at least',
          'is less than',
          'is at most',
          'equals',
        ],
      },
      {
        id: 'stage',
        label: 'Stage',
        type: 'enum',
        operators: ['equals', 'does not equal'],
        enum: ENTITIES.deal.fields.find((f) => f.id === 'stage')?.enum,
      },
    ],
  },
  'pipeline-stage-is-moved': {
    entity: 'Deal',
    summary:
      'A deal just moved between pipeline stages. Evaluate the deal to decide which branch to follow.',
    header: 'If the deal',
    helperText:
      'Rules evaluate top-to-bottom — the first match decides which stream the contact follows. Anything that doesn’t match falls through to the default branch.',
    showTemplatesToggle: true,
    fields: [
      {
        id: 'amount',
        label: 'Amount',
        type: 'currency',
        operators: ['is greater than', 'is at least', 'is less than', 'is at most', 'equals'],
      },
      {
        id: 'stage',
        label: 'Stage',
        type: 'enum',
        operators: ['equals', 'does not equal'],
        enum: ENTITIES.deal.fields.find((f) => f.id === 'stage')?.enum,
      },
      {
        id: 'daysInStage',
        label: 'Days in Current Stage',
        type: 'number',
        operators: ['is greater than', 'is at least', 'is less than', 'is at most', 'equals'],
      },
    ],
  },
  'appointments': {
    entity: 'Appointment',
    summary:
      'An appointment was just scheduled, rescheduled, or canceled. Evaluate the appointment to decide which branch to follow.',
    header: 'If the appointment',
    helperText:
      'Rules evaluate top-to-bottom — the first match decides which stream the contact follows. Anything that doesn’t match any rule falls through to the default branch.',
    fields: [
      {
        id: 'type',
        label: 'Type',
        type: 'enum',
        operators: ['equals', 'does not equal'],
        enum: ENTITIES.appointment.fields.find((f) => f.id === 'type')?.enum,
      },
      {
        id: 'date',
        label: 'Date',
        type: 'date',
        operators: [
          'is today',
          'is tomorrow',
          'is in the past',
          'is in the future',
          'equals',
          'is at least N days ago',
          'is within last N days',
          'is within next N days',
        ],
      },
    ],
  },
}

/** Universally-available Contact preset (Option C). Selected per-rule via
 *  the rule card's entity dropdown, swapping the rule's field rows to
 *  contact-shaped predicates while leaving sibling rules on the primary
 *  entity unaffected. */
const CONTACT_PRESET: RulePreset = {
  entity: 'Contact',
  summary:
    'Branch on the contact’s profile, marketing consent, or order history.',
  header: 'If the contact',
  helperText:
    'Rules evaluate top-to-bottom — the first match decides which stream the contact follows.',
  fields: [
    {
      id: 'lifecycleStage',
      label: 'Lifecycle Stage',
      type: 'enum',
      operators: ['equals', 'does not equal'],
      enum: ENTITIES.contact.fields.find((f) => f.id === 'lifecycleStage')?.enum,
    },
    {
      id: 'marketingConsent',
      label: 'Marketing Consent',
      type: 'boolean',
      operators: ['equals'],
    },
    {
      id: 'lifetimeValue',
      label: 'Lifetime Value',
      type: 'currency',
      operators: ['is greater than', 'is at least', 'is less than', 'is at most', 'equals'],
    },
    {
      id: 'totalOrders',
      label: 'Total Orders',
      type: 'number',
      operators: ['is greater than', 'is at least', 'is less than', 'equals'],
    },
    {
      id: 'daysSinceLastOrder',
      label: 'Days Since Last Order',
      type: 'number',
      operators: ['is greater than', 'is at least', 'is less than', 'equals'],
    },
  ],
}

/** Resolve the active preset for a given rule. When the rule's
 *  `entityKey` is `'contact'`, the universal Contact preset wins;
 *  otherwise the diamond's primary (upstream-derived) preset is used. */
function presetForRule(
  rule: DDPresetRuleSet,
  primary: RulePreset | null,
): RulePreset | null {
  if (rule.entityKey === 'contact') return CONTACT_PRESET
  return primary
}

/** Format a single rule's field values as a one-line summary, e.g.
 *  `Amount is at least $1,000 · Stage equals Won`. Skips fields with no
 *  operator or no value. Returns null when the rule has zero entries. */
function branchSummaryFor(
  rule: DDPresetRuleSet,
  preset: RulePreset,
): string | null {
  // Free-form conditions list (one per AND row). Multi-value OR chips
  // render as "Value1 or Value2".
  const parts: string[] = []
  for (const c of rule.conditions ?? []) {
    if (!c.operator || !c.values.length) continue
    const f = preset.fields.find((x) => x.id === c.fieldId)
    if (!f) continue
    const formatted = c.values.map((v) => {
      if (f.type === 'currency') {
        const n = Number(v)
        return Number.isFinite(n)
          ? '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 })
          : v
      }
      return v
    })
    const join = c.valueJoin === 'and' ? 'and' : 'or'
    const valText =
      formatted.length === 1
        ? formatted[0]
        : formatted.length === 2
          ? `${formatted[0]} ${join} ${formatted[1]}`
          : `${formatted[0]} ${join} ${formatted.length - 1} more`
    parts.push(`${f.label} ${c.operator} ${valText}`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

/** Walk upstream from `startId` and return the first encountered node's
 *  catalog slug + node id — used to pick the rule preset for a decision
 *  diamond AND look up that upstream node's own configuration so the
 *  preset can specialize its fields based on what the user already
 *  picked there (e.g. drop the "Type" field when the appointment trigger
 *  already filters to a specific type). */
function upstreamPresetCtxFor(
  startId: string,
  nodes: BuilderNode[],
  edges: BuilderEdge[],
): { slug: string; nodeId: string } | null {
  const seen = new Set<string>([startId])
  const q: string[] = [startId]
  while (q.length > 0) {
    const id = q.shift()!
    for (const e of edges) {
      if (e.to !== id) continue
      if (seen.has(e.from)) continue
      seen.add(e.from)
      const n = nodes.find((x) => x.id === e.from)
      if (n?.name) return { slug: n.name, nodeId: n.id }
      q.push(e.from)
    }
  }
  return null
}

/** Slug-only convenience wrapper kept for places that don't need the
 *  upstream node id. */
function upstreamSlugFor(
  startId: string,
  nodes: BuilderNode[],
  edges: BuilderEdge[],
): string | null {
  return upstreamPresetCtxFor(startId, nodes, edges)?.slug ?? null
}

/** Specialize the base RULE_PRESETS[slug] entry using the upstream node's
 *  own configuration. This is what makes the diamond modal feel grounded
 *  in the actual flow rather than showing a generic field list:
 *
 *   - product-is-purchased + purchaseType="any"   → expose Product field
 *   - product-is-purchased + specific products    → summary names them,
 *                                                    Product field omitted
 *                                                    (already filtered)
 *   - appointments + specific appointment type    → drop Type field,
 *                                                    summary names the type
 *   - appointments + whenContact only             → tighten summary to that
 *                                                    transition (Schedules /
 *                                                    Reschedules / Cancels)
 *
 *  Returns null when the slug has no registered preset. */
function derivePresetFor(
  slug: string | null,
  upstreamNodeId: string | null,
  purchaseConfigs: Record<string, PurchaseTriggerConfig>,
  appointmentConfigs: Record<string, AppointmentGoalConfig>,
  pipelineConfigs: Record<string, PipelineStageMoveConfig> = {},
): RulePreset | null {
  if (!slug) return null
  const base = RULE_PRESETS[slug]
  if (!base) return null

  if (slug === 'product-is-purchased') {
    const cfg = upstreamNodeId ? purchaseConfigs[upstreamNodeId] : undefined
    let fields = [...base.fields]
    let summary = base.summary
    if (cfg?.purchaseType === 'any') {
      // No specific product picked upstream — let the diamond branch on
      // which product it actually was.
      fields = [
        {
          id: 'product',
          label: 'Product',
          type: 'enum',
          operators: ['equals', 'does not equal'],
          enum: PRODUCT_OPTIONS.map((p) => p.name),
        },
        ...fields,
      ]
      summary =
        'Any purchase generated a deal. Evaluate the deal — including which product it was — to decide which branch to follow.'
    } else if (cfg?.purchaseType === 'product' && cfg.productIds.length > 0) {
      const names = cfg.productIds
        .map((id) => PRODUCT_OPTIONS.find((p) => p.id === id)?.name)
        .filter((n): n is string => Boolean(n))
      const list =
        names.length === 1
          ? names[0]
          : names.length === 2
            ? `${names[0]} or ${names[1]}`
            : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
      summary = `A purchase of ${list} generated a deal. Evaluate the deal to decide which branch to follow.`
    }
    return { ...base, fields, summary }
  }

  if (slug === 'pipeline-stage-is-moved') {
    const cfg = upstreamNodeId ? pipelineConfigs[upstreamNodeId] : undefined
    let fields = [...base.fields]
    let summary = base.summary
    if (cfg?.pipelineId && cfg?.stageId) {
      // Stage is already pinned by the trigger — drop it from the rule
      // fields (testing it again is a no-op).
      fields = fields.filter((f) => f.id !== 'stage')
      const pipeline = PIPELINE_OPTIONS.find((p) => p.id === cfg.pipelineId)
      const stage = pipeline?.stages.find((s) => s.id === cfg.stageId)
      const dir = (cfg.whenMoving ?? 'Into').toLowerCase()
      summary = pipeline && stage
        ? `When a deal moves ${dir} the "${stage.name}" stage in ${pipeline.name}, evaluate the deal to decide which branch to follow.`
        : base.summary
    } else if (cfg?.pipelineId) {
      const pipeline = PIPELINE_OPTIONS.find((p) => p.id === cfg.pipelineId)
      summary = pipeline
        ? `When a deal moves between stages in ${pipeline.name}, evaluate the deal to decide which branch to follow.`
        : base.summary
    }
    return { ...base, fields, summary }
  }

  if (slug === 'appointments') {
    const cfg = upstreamNodeId ? appointmentConfigs[upstreamNodeId] : undefined
    let fields = [...base.fields]
    let summary = base.summary
    if (cfg?.appointmentTypeId) {
      // Type is already pinned by the upstream trigger — branching on it
      // again would be a no-op, so drop the row.
      fields = fields.filter((f) => f.id !== 'type')
      const apt = APPOINTMENT_TYPE_OPTIONS.find(
        (a) => a.id === cfg.appointmentTypeId,
      )
      const whenLower = cfg.whenContact.toLowerCase()
      summary = apt
        ? `When a contact ${whenLower} a "${apt.name}" appointment. Evaluate the appointment to decide which branch to follow.`
        : base.summary
    } else if (cfg?.whenContact) {
      summary = `When a contact ${cfg.whenContact.toLowerCase()} an appointment. Evaluate the appointment to decide which branch to follow.`
    }
    return { ...base, fields, summary }
  }

  return base
}

/** Render one rule row uniformly: [label] [operator] [type-aware value]. */
/** One free-form condition row inside a rule. The user picks the
 *  field, then the operator, then one or more values (multi-value OR
 *  chips). Inline "+ Or" appends a value chip; inline "+ And" delegates
 *  to the parent (same handler as the rule card's bottom "+ And"). */
function RulePresetRow({
  condition,
  field,
  fieldOptions,
  isFirst,
  onChangeField,
  onChangeOperator,
  onAddValue,
  onRemoveValue,
  onSetValueJoin,
  onAddAnd,
  onRemove,
}: {
  condition: DDPresetCondition
  field: RulePresetField | null
  fieldOptions: string[]
  isFirst: boolean
  onChangeField: (label: string) => void
  onChangeOperator: (op: string) => void
  onAddValue: (v: string) => void
  onRemoveValue: (v: string) => void
  /** Sets `valueJoin` for this condition. Called when the user clicks
   *  the inline `+ or` or `+ and` affordance to commit the join scope
   *  before adding the next value. */
  onSetValueJoin: (join: 'or' | 'and') => void
  /** Set on the LAST condition only — clicking the inline "+ And"
   *  delegates to the parent's append-AND handler. */
  onAddAnd?: () => void
  /** × icon for removing the row. Hidden when only one condition exists. */
  onRemove?: () => void
}) {
  const op = condition.operator
  const linkBtn: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#006ceb',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    padding: '4px 2px',
  }
  const inputBase: React.CSSProperties = {
    height: 40,
    padding: '0 12px',
    fontSize: 14,
    color: '#111827',
    border: '1px solid #D1D5DB',
    borderRadius: 6,
    background: '#FFFFFF',
    outline: 'none',
  }

  // Inline "next-value" input — typed value commits via Enter / blur,
  // then the input clears. Used for adding chips beyond the first.
  const [draft, setDraft] = useState('')
  const commitDraft = () => {
    const v = draft.trim()
    if (!v) return
    onAddValue(v)
    setDraft('')
  }

  const renderValueArea = () => {
    if (!op || !field) return null
    const shape = OPERATOR_VALUE_SHAPE_BY_LABEL[op] ?? 'asField'
    if (shape === 'unary') return null
    const chips = condition.values.length > 0 && (
      <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
        {condition.values.map((v) => (
          <DDValueChip key={v} label={v} onRemove={() => onRemoveValue(v)} />
        ))}
      </div>
    )

    let input: React.ReactNode = null
    if (shape === 'number') {
      input = (
        <input
          type="number"
          inputMode="numeric"
          placeholder="N"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitDraft()
            }
          }}
          style={{ ...inputBase, width: 100 }}
        />
      )
    } else if (field.type === 'enum') {
      // Enum: show a select that adds the picked value as a chip.
      const remaining = (field.enum ?? []).filter(
        (v) => !condition.values.includes(v),
      )
      input = (
        <DDSelect
          value=""
          options={remaining}
          onChange={(v) => onAddValue(v)}
          width={200}
          placeholder={
            condition.values.length > 0
              ? '+ or'
              : `Pick a ${field.label.toLowerCase()}`
          }
        />
      )
    } else if (field.type === 'currency') {
      input = (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            border: '1px solid #D1D5DB',
            borderRadius: 6,
            background: '#FFFFFF',
            height: 40,
            paddingLeft: 10,
          }}
        >
          <span style={{ color: '#6B7280', fontSize: 14 }}>$</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0.00"
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitDraft()
              }
            }}
            style={{
              border: 'none',
              outline: 'none',
              padding: '0 10px 0 4px',
              height: 38,
              fontSize: 14,
              color: '#111827',
              width: 140,
              background: 'transparent',
            }}
          />
        </span>
      )
    } else if (field.type === 'number') {
      input = (
        <input
          type="number"
          inputMode="numeric"
          placeholder="Enter number"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitDraft()
            }
          }}
          style={{ ...inputBase, width: 160 }}
        />
      )
    } else if (field.type === 'date' || field.type === 'datetime') {
      input = (
        <input
          type={field.type === 'datetime' ? 'datetime-local' : 'date'}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitDraft()
            }
          }}
          style={{ ...inputBase, width: 180 }}
        />
      )
    } else {
      input = (
        <input
          type="text"
          placeholder="Enter value"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitDraft()
            }
          }}
          style={{ ...inputBase, width: 220 }}
        />
      )
    }

    // Render chips with a small comparison label between them, matching
    // the spec: each appended value gets an "Or"/"And" inline label
    // based on the condition's valueJoin. The "+ or" / "+ and" cluster
    // sits at the end of the value cell — only rendered when the
    // operator supports a list (already gated above by shape !== 'unary').
    const join = condition.valueJoin ?? 'or'
    const joinLabelStyle: React.CSSProperties = {
      fontSize: 12,
      color: 'rgba(0,0,0,0.6)',
      padding: '0 4px',
    }
    return (
      <div
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {condition.values.map((v, i) => (
          <React.Fragment key={v + i}>
            {i > 0 && (
              <span style={joinLabelStyle}>
                {join === 'and' ? 'And' : 'Or'}
              </span>
            )}
            <DDValueChip label={v} onRemove={() => onRemoveValue(v)} />
          </React.Fragment>
        ))}
        {input}
        {/* Value-level inline affordances. "+ or" / "+ and" both append
            to the same rule's value list; the only difference is the
            comparison label rendered between values. Lower-case is
            deliberate — see the spec's casing rationale. */}
        {condition.values.length > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginLeft: 4,
            }}
          >
            <button
              type="button"
              onClick={() => {
                onSetValueJoin('or')
                commitDraft()
              }}
              style={linkBtn}
            >
              + or
            </button>
            <button
              type="button"
              onClick={() => {
                onSetValueJoin('and')
                commitDraft()
              }}
              style={linkBtn}
            >
              + and
            </button>
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 12,
      }}
    >
      <span style={{ fontSize: 13, color: '#4B5563', minWidth: 70 }}>
        {isFirst ? 'If the' : 'AND If the'}
      </span>
      <DDSelect
        value={field?.label ?? ''}
        options={fieldOptions}
        onChange={onChangeField}
        width={170}
        placeholder="Select"
      />
      {field && (
        <DDSelect
          value={op}
          options={field.operators}
          onChange={onChangeOperator}
          width={170}
          placeholder="Select"
        />
      )}
      {renderValueArea()}
      {onAddAnd && (
        <button type="button" onClick={onAddAnd} style={linkBtn}>
          + And
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label="Remove condition"
          title="Remove condition"
          onClick={onRemove}
          style={{
            width: 28,
            height: 28,
            border: 'none',
            background: 'transparent',
            color: '#6B7280',
            cursor: 'pointer',
            borderRadius: 4,
            fontSize: 18,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 'auto',
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

/** Body for the Decision Diamond editor. Receives the upstream-derived
 *  primary preset; resolves the effective preset per-rule against
 *  `rule.entityKey` (Option C — per-rule entity tabs). Each rule card
 *  has its own entity dropdown so different rules in the same diamond
 *  can branch on different entities. */
function DDPresetBody({
  preset,
  config,
  onChange,
}: {
  preset: RulePreset | null
  config: DecisionDiamondConfig
  onChange: (next: DecisionDiamondConfig) => void
}) {
  if (!preset) {
    return (
      <div
        style={{
          background: '#fff',
          border: '1px dashed #D1D5DB',
          borderRadius: 10,
          padding: '24px 20px',
          textAlign: 'center',
          color: '#6B7280',
          fontSize: 13,
        }}
      >
        Connect this diamond after a configured trigger so the editor can
        load the right rule preset. Today &ldquo;When a purchase is
        made&rdquo; is the wired preset.
      </div>
    )
  }

  // Multi-rule storage: default to one empty rule on first open. Mutations
  // address rules by id rather than index so concurrent edits stay sane.
  const rules: DDPresetRuleSet[] =
    config.presetRules && config.presetRules.length > 0
      ? config.presetRules
      : [{ id: 'r1', conditions: [] }]
  const setRules = (next: DDPresetRuleSet[]) =>
    onChange({ ...config, presetRules: next })

  // Top-level AI prompt input (Option A — diamond-wide cold start).
  const [topAiPrompt, setTopAiPrompt] = useState('')
  // Per-rule AI prompt expansion. Holds {ruleId, draft} when one rule's
  // ✨ panel is open; null when no rule is in AI-input mode.
  const [aiInputForRuleId, setAiInputForRuleId] = useState<string | null>(null)
  const [aiPromptDraft, setAiPromptDraft] = useState('')
  const addRule = () => {
    if (rules.length >= MAX_PRESET_RULES) return
    setRules([...rules, { id: ddRuleId(), conditions: [] }])
  }
  const removeRule = (ruleId: string) => {
    if (rules.length <= 1) return
    setRules(rules.filter((r) => r.id !== ruleId))
  }
  const atCap = rules.length >= MAX_PRESET_RULES

  return (
    <>
      {/* Summary — plain inline label + body text. Matches the
          purchase-trigger modal's Summary block (no card, small muted
          label, 14/20 body in primary text color). */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 12,
            lineHeight: '16px',
            color: 'rgba(0,0,0,0.6)',
          }}
        >
          Summary
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 14,
            lineHeight: '20px',
            color: 'rgba(0,0,0,0.824)',
          }}
        >
          {preset.summary}
        </div>
      </div>

      {/* AI assistant + template chips (Option B + A from the spec).
          The top-level "Describe your routing" bar generates a single
          rule from a natural-language prompt; the chip row underneath
          is the quick-pick equivalent. Both surfaces opt in via the
          preset's `showTemplatesToggle` flag. */}
      {preset.showTemplatesToggle && (
        <div style={{ marginBottom: 16 }}>
          {/* Top AI bar — single input + Generate. Replaces the diamond's
              entire rule list with one rule seeded from the prompt. */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const v = topAiPrompt.trim()
              if (!v) return
              const seeded = mockAiSeedConditions(v, preset)
              setRules([
                {
                  id: ddRuleId(),
                  conditions: seeded,
                  aiPrompt: v,
                },
              ])
              setTopAiPrompt('')
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <span
              aria-hidden
              style={{ fontSize: 16, color: '#8358F1' }}
              title="AI assistant"
            >
              ✨
            </span>
            <input
              type="text"
              placeholder="Describe your routing"
              value={topAiPrompt}
              onChange={(e) => setTopAiPrompt(e.currentTarget.value)}
              style={{
                flex: 1,
                height: 36,
                padding: '0 12px',
                fontSize: 13,
                color: '#111827',
                border: '1px solid #D1D5DB',
                borderRadius: 8,
                outline: 'none',
                background: '#FFFFFF',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="submit"
              disabled={!topAiPrompt.trim()}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                border: 'none',
                background: topAiPrompt.trim() ? '#8358F1' : '#D1D5DB',
                color: '#FFFFFF',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                cursor: topAiPrompt.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Generate
            </button>
          </form>
          {/* Template chips — quick-pick alternative to the AI bar. */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {[
              'High-value deal won',
              'Stalled deal (≥ 14 days in stage)',
              'New customer onboarding',
              'Lost-deal win-back',
            ].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  // Reuse the AI seeder — chip names are deliberately
                  // close to the keyword regexes so the same code path
                  // works for both surfaces.
                  const seeded = mockAiSeedConditions(t, preset)
                  setRules([
                    {
                      id: ddRuleId(),
                      conditions: seeded,
                      aiPrompt: `Template: ${t}`,
                    },
                  ])
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 28,
                  padding: '0 12px',
                  background: 'rgba(0,0,0,0.06)',
                  border: 'none',
                  borderRadius: 36,
                  fontFamily: 'inherit',
                  fontSize: 12,
                  lineHeight: '18px',
                  color: 'rgba(0,0,0,0.824)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual rule list — always visible; AI bar + chips above act as
          alternative seed paths but never replace the rule builder. */}
      {/* Helper text above rule stack — explains the multi-rule semantics. */}
      <div
        style={{
          fontSize: 13,
          color: '#4B5563',
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        {preset.helperText}
      </div>

      {/* One card per rule. Rules evaluate top-to-bottom; first match wins. */}
      {rules.map((rule, idx) => (
        <div
          key={rule.id}
          style={{
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #E5E7EB',
            padding: '18px 20px',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#111827',
                }}
              >
                {`Rule ${idx + 1}`}
              </div>
              {/* Per-rule entity selector (Option C). Default = primary
                  upstream preset; switching to Contact swaps just this
                  rule's field rows to contact-shaped predicates. Each
                  rule chooses independently of its siblings. */}
              {(() => {
                const rulePreset = presetForRule(rule, preset) ?? preset
                const opts = [preset.entity]
                if (preset.entity !== CONTACT_PRESET.entity) {
                  opts.push(CONTACT_PRESET.entity)
                }
                return (
                  <DDSelect
                    value={rulePreset.entity}
                    options={opts}
                    onChange={(picked) => {
                      const nextKey: 'primary' | 'contact' =
                        picked === CONTACT_PRESET.entity ? 'contact' : 'primary'
                      // Wipe conditions when entity changes — schemas
                      // don't carry across, so leftover entries would be
                      // dangling references.
                      setRules(
                        rules.map((r) =>
                          r.id === rule.id
                            ? { ...r, entityKey: nextKey, conditions: [] }
                            : r,
                        ),
                      )
                    }}
                    width={150}
                  />
                )
              })()}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  color: '#6B7280',
                }}
              >
                — {(presetForRule(rule, preset) ?? preset).header.toLowerCase()}
              </span>
            </div>
            {/* Per-rule ✨ AI button — opens the in-card prompt panel
                that seeds (or replaces) THIS rule's conditions only.
                Opt-in via preset.showTemplatesToggle so it only shows
                up on presets that have a registered AI seeder. */}
            {preset.showTemplatesToggle && (
              <button
                type="button"
                aria-label={`Generate rule ${idx + 1} with AI`}
                title="Describe this rule"
                onClick={() => {
                  if (aiInputForRuleId === rule.id) {
                    setAiInputForRuleId(null)
                  } else {
                    setAiInputForRuleId(rule.id)
                    setAiPromptDraft(rule.aiPrompt ?? '')
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  border: 'none',
                  background:
                    aiInputForRuleId === rule.id
                      ? 'rgba(131,88,241,0.12)'
                      : 'transparent',
                  color: '#8358F1',
                  cursor: 'pointer',
                  borderRadius: 6,
                  fontSize: 16,
                  marginLeft: 'auto',
                  marginRight: 4,
                }}
              >
                ✨
              </button>
            )}
            {rules.length > 1 && (
              <button
                type="button"
                aria-label={`Remove rule ${idx + 1}`}
                title="Remove rule"
                onClick={() => removeRule(rule.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--dex-color-gray-1600, #272727)',
                  cursor: 'pointer',
                  borderRadius: 6,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
          {/* Provenance pill — shown on AI-generated rules. Click "Edit
              prompt" to re-open the AI panel with the previous prompt
              pre-filled; "Clear" wipes the prompt + conditions. */}
          {rule.aiPrompt && aiInputForRuleId !== rule.id && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(131,88,241,0.08)',
                color: '#5b3fb5',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              <span aria-hidden>✨</span>
              <span>
                Generated · &ldquo;
                {rule.aiPrompt.length > 48
                  ? rule.aiPrompt.slice(0, 48) + '…'
                  : rule.aiPrompt}
                &rdquo;
              </span>
              <button
                type="button"
                onClick={() => {
                  setAiInputForRuleId(rule.id)
                  setAiPromptDraft(rule.aiPrompt ?? '')
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#5b3fb5',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '0 4px',
                }}
              >
                Edit
              </button>
            </div>
          )}
          {/* In-card AI prompt panel — open when the user clicks the ✨
              button on this rule. Submit replaces the rule's conditions
              with mock-AI output and stores the prompt for provenance. */}
          {aiInputForRuleId === rule.id && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const v = aiPromptDraft.trim()
                if (!v) return
                const rulePreset = presetForRule(rule, preset) ?? preset
                const seeded = mockAiSeedConditions(v, rulePreset)
                setRules(
                  rules.map((r) =>
                    r.id === rule.id
                      ? { ...r, conditions: seeded, aiPrompt: v }
                      : r,
                  ),
                )
                setAiInputForRuleId(null)
                setAiPromptDraft('')
              }}
              style={{
                background: 'rgba(131,88,241,0.06)',
                border: '1px solid rgba(131,88,241,0.25)',
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#5b3fb5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span aria-hidden>✨</span>
                Describe this rule
              </div>
              <input
                type="text"
                autoFocus
                value={aiPromptDraft}
                onChange={(e) => setAiPromptDraft(e.currentTarget.value)}
                placeholder='e.g. "high-value won deals over $5,000"'
                style={{
                  height: 36,
                  padding: '0 12px',
                  fontSize: 13,
                  color: '#111827',
                  border: '1px solid #D1D5DB',
                  borderRadius: 8,
                  outline: 'none',
                  background: '#FFFFFF',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setAiInputForRuleId(null)
                    setAiPromptDraft('')
                  }}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    border: '1px solid #D1D5DB',
                    background: '#FFFFFF',
                    color: '#374151',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!aiPromptDraft.trim()}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    border: 'none',
                    background: aiPromptDraft.trim() ? '#8358F1' : '#D1D5DB',
                    color: '#FFFFFF',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: aiPromptDraft.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Generate
                </button>
              </div>
            </form>
          )}
          {(() => {
            const rulePreset = presetForRule(rule, preset) ?? preset
            // Auto-seed conditions on first render — keeps the existing
            // preset-driven default UX (one row per preset field) while
            // letting the user grow / shrink the list freely.
            const conds: DDPresetCondition[] =
              rule.conditions && rule.conditions.length > 0
                ? rule.conditions
                : defaultConditionsFor(rulePreset)
            const setConds = (next: DDPresetCondition[]) =>
              setRules(
                rules.map((r) =>
                  r.id === rule.id ? { ...r, conditions: next } : r,
                ),
              )
            const updateCond = (
              condId: string,
              patch: Partial<DDPresetCondition>,
            ) =>
              setConds(
                conds.map((c) => (c.id === condId ? { ...c, ...patch } : c)),
              )
            const appendAndCondition = () => {
              const firstField = rulePreset.fields[0]?.id ?? ''
              setConds([
                ...conds,
                {
                  id: ddCondId(),
                  fieldId: firstField,
                  operator: '',
                  values: [],
                },
              ])
            }
            const removeCond = (condId: string) => {
              // Spec edge case: deleting the only rule in a group
              // removes the whole group (no empty groups). Otherwise
              // just drop this condition.
              if (conds.length <= 1) {
                if (rules.length <= 1) return
                setRules(rules.filter((r) => r.id !== rule.id))
                return
              }
              setConds(conds.filter((c) => c.id !== condId))
            }
            const fieldOptions = rulePreset.fields.map((f) => f.label)
            return (
              <>
                {conds.map((cond, condIdx) => {
                  const field = rulePreset.fields.find(
                    (f) => f.id === cond.fieldId,
                  )
                  const isLast = condIdx === conds.length - 1
                  return (
                    <RulePresetRow
                      key={cond.id}
                      condition={cond}
                      field={field ?? null}
                      fieldOptions={fieldOptions}
                      isFirst={condIdx === 0}
                      onChangeField={(label) => {
                        const next = rulePreset.fields.find(
                          (f) => f.label === label,
                        )
                        if (!next) return
                        // Reset op + values when field changes — different
                        // schemas don't carry across.
                        updateCond(cond.id, {
                          fieldId: next.id,
                          operator: '',
                          values: [],
                        })
                      }}
                      onChangeOperator={(op) => {
                        // When the comparator switches to a unary
                        // (single-value) op, drop trailing values and
                        // clear valueJoin per spec.
                        const shape = OPERATOR_VALUE_SHAPE_BY_LABEL[op] ?? 'asField'
                        if (shape === 'unary') {
                          updateCond(cond.id, {
                            operator: op,
                            values: [],
                            valueJoin: undefined,
                          })
                        } else {
                          updateCond(cond.id, { operator: op })
                        }
                      }}
                      onAddValue={(v) => {
                        if (!v) return
                        if (cond.values.includes(v)) return
                        updateCond(cond.id, { values: [...cond.values, v] })
                      }}
                      onRemoveValue={(v) =>
                        updateCond(cond.id, {
                          values: cond.values.filter((x) => x !== v),
                        })
                      }
                      onSetValueJoin={(j) =>
                        updateCond(cond.id, { valueJoin: j })
                      }
                      onAddAnd={isLast ? appendAndCondition : undefined}
                      onRemove={
                        conds.length > 1 ? () => removeCond(cond.id) : undefined
                      }
                    />
                  )
                })}
                {/* Bottom "+ And" — adds another rule into the same
                    group (rule-level scope; capital "And" because it's
                    its own line, blue-link weight). Spec scope 2. */}
                <div style={{ marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={appendAndCondition}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#006ceb',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '4px 2px',
                    }}
                  >
                    + And
                  </button>
                </div>
              </>
            )
          })()}
          {/* Capital "Or" separator pill (group-level, scope 3). The
              spec anchors it inside each group's body-card at the
              bottom — it visually marks the boundary to the next group
              (or to the trailing "Add a rule" CTA after the last
              group). Hairline behind, grey pill on top. */}
          <div
            style={{
              position: 'relative',
              margin: '20px 0 0',
              padding: '6px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '50%',
                height: 1,
                background: '#DDDDDD',
              }}
            />
            <span
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 20,
                width: 31,
                height: 24,
                background: '#F0F0F0',
                borderRadius: 6,
                fontSize: 12,
                color: 'rgba(0,0,0,0.824)',
              }}
            >
              Or
            </span>
          </div>
        </div>
      ))}

      {/* Add rule — disabled at the 10-rule cap. Max set per scan of
          competitor tools (HubSpot 20 / Zapier 7 / Salesforce ~10 / AC 5);
          10 lands in the middle and matches Salesforce's practical UI cap. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <button
          type="button"
          onClick={addRule}
          disabled={atCap}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            color: atCap ? '#9CA3AF' : '#006ceb',
            fontSize: 14,
            fontWeight: 500,
            cursor: atCap ? 'not-allowed' : 'pointer',
            padding: '4px 2px',
          }}
        >
          + Add rule
        </button>
        <span style={{ fontSize: 12, color: '#6B7280' }}>
          {rules.length} of {MAX_PRESET_RULES}
        </span>
      </div>
    </>
  )
}

/** Modal for editing a Decision Diamond. v1 visual fidelity + local state;
 *  does not yet wire into an evaluation engine, auto-insertion, or XML. */
function DecisionDiamondEditor({
  config,
  relevantEntities: _relevantEntities,
  preset,
  onChange,
  onSave,
  onClose,
}: {
  config: DecisionDiamondConfig
  /** Reserved for future preset selection. Currently unused — the modal
   *  picks its preset flow off `preset` rather than the relevance set.
   *  Kept on the prop list so the parent's existing wiring works. */
  relevantEntities: Set<EntityId>
  /** Pre-derived rule preset specialized to the upstream node's own
   *  configuration (e.g. specific product or appointment type already
   *  chosen upstream). Drives which fields the rule-card rows show. */
  preset: RulePreset | null
  onChange: (next: DecisionDiamondConfig) => void
  /** Optional Save callback. Fires before close so the parent can
   *  reconcile the canvas (rename / split the diamond) based on the
   *  saved rules. */
  onSave?: () => void
  onClose: () => void
}) {
  // Close on Escape.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Decision diamond editor"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17, 24, 39, 0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1080px, calc(100vw - 48px))',
          maxHeight: 'calc(100vh - 48px)',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: '"Proxima Nova", Inter, system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid #E5E7EB',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 20,
                color: '#111827',
              }}
            >
              ×
            </button>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#111827' }}>
              Decision diamond
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HeaderIconButton ariaLabel="More options" width={32} height={32}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 17a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0-7a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0-7a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
              </svg>
            </HeaderIconButton>
            {/* Primary Save — same style + position as the purchase-trigger
                modal's Save button. Onchange propagates writes live, so
                Save's job here is just "I'm done, close the modal". */}
            <button
              type="button"
              data-qa="dd-modal-save-button"
              onClick={() => {
                // Hand off to the parent so it can reconcile the canvas
                // (rename / split the diamond) before tearing down the modal.
                onSave?.()
                onClose()
              }}
              style={{
                height: 40,
                padding: '11px 15px',
                borderRadius: 8,
                border: '1px solid transparent',
                background: 'rgb(0, 108, 235)',
                color: '#FFFFFF',
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 600,
                lineHeight: '16px',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px 28px',
            background: '#F9FAFB',
          }}
        >
          <DDPresetBody
            preset={preset}
            config={config}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  color: 'var(--dex-color-gray-1600, #272727)',
  cursor: 'pointer',
  borderRadius: 6,
}
const groupMenuItemStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  border: 'none',
  background: 'transparent',
  color: 'var(--dex-color-gray-1600, #272727)',
  fontSize: 14,
  textAlign: 'left',
  borderRadius: 6,
  cursor: 'pointer',
}
const linkBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#006ceb',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  padding: '4px 2px',
}
const iconTrash = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></svg>
)

/* ---------------------------------------------------------- */
/* Main page                                                   */
/* ---------------------------------------------------------- */

export default function AutomationBuilder() {
  const { automationId } = useParams<{ automationId: string }>()
  const navigate = useNavigate()
  const automation = advancedAutomations.find((a) => a.id === automationId) || advancedAutomations[0]

  // URL guard — if the route's automationId doesn't exist in the
  // (now-trimmed) `advancedAutomations` list, redirect back to the
  // list view. Build remains in place; deleted rows are just
  // unreachable until they're added back to the data array.
  //
  // Single-canvas builds (VITE_FORCED_AUTOMATION_ID) hijack this
  // redirect: if the visitor's URL doesn't match the forced id, we
  // bounce them straight to the forced canvas instead of the list
  // (which itself bounces to the forced canvas, so this just
  // short-circuits a loop).
  const FORCED_ID: string | undefined =
    (import.meta as any).env?.VITE_FORCED_AUTOMATION_ID || undefined
  React.useEffect(() => {
    if (!automationId) return
    if (FORCED_ID && automationId !== FORCED_ID) {
      navigate(`/my-automations/list/advanced/${FORCED_ID}`, { replace: true })
      return
    }
    const exists = advancedAutomations.some((a) => a.id === automationId)
    if (!exists) {
      navigate(
        FORCED_ID
          ? `/my-automations/list/advanced/${FORCED_ID}`
          : '/my-automations/list/advanced',
        { replace: true },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automationId])

  // ----- Shared name overrides (cross-page sync) -----
  // The user can rename the automation from the list view OR from
  // the builder's top bar; both surfaces read & write through
  // `src/data/automationNames.ts`. Within a single tab the rename
  // broadcasts via a `automation-names-changed` window event so
  // the other surface picks up the change without polling; across
  // tabs the native `storage` event handles it.
  const [nameOverrides, setNameOverrides] = React.useState(() => loadNameOverrides())
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('keap-automation-name-overrides:')) {
        setNameOverrides(loadNameOverrides())
      }
    }
    const onSelf = () => setNameOverrides(loadNameOverrides())
    window.addEventListener('storage', onStorage)
    window.addEventListener('automation-names-changed', onSelf)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('automation-names-changed', onSelf)
    }
  }, [])
  const displayedAutomationName = automationId
    ? getDisplayName(nameOverrides, automationId, automation.name)
    : automation.name
  const handleRenameAutomation = (next: string) => {
    if (!automationId) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === displayedAutomationName) return
    setNameOverrides((prev) => {
      const updated = renameInMap(prev, automationId, trimmed)
      saveNameOverrides(updated)
      window.dispatchEvent(new Event('automation-names-changed'))
      return updated
    })
  }

  /** One-shot read of any previously-persisted canvas state for this
   *  automation id. Held in a ref so the lookup runs ONCE per mount
   *  (not on every render) and is shared across every `useState`
   *  initializer below. Null when nothing has been saved yet — each
   *  initializer then falls back to the seed. */
  const persistedOnMountRef = React.useRef<PersistedState | null | undefined>(
    undefined,
  )
  if (persistedOnMountRef.current === undefined) {
    // Isolated demo builds (VITE_FORCED_AUTOMATION_ID set) always boot
    // from the seed so every tester opens the same messy starting layout
    // — and so a tester's previous session doesn't leak into their next
    // open. We also proactively clear any stale snapshot the user might
    // have accumulated before this gate landed, so the first reload
    // after this ships also resets cleanly.
    const FORCED =
      (import.meta as any).env?.VITE_FORCED_AUTOMATION_ID || undefined
    if (FORCED && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(canvasStorageKey(automationId || 'default'))
      } catch {
        /* ignore */
      }
      persistedOnMountRef.current = null
    } else {
      persistedOnMountRef.current = loadCanvasState(automationId || 'default')
    }
  }
  const persistedOnMount = persistedOnMountRef.current

  const [activeTab, setActiveTab] = useState<'when' | 'then'>('when')
  const [search, setSearch] = useState('')
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [zoom, setZoom] = useState(() =>
    persistedOnMount?.zoom != null ? persistedOnMount.zoom : 0.5,
  )
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  // Auto-show the "Tidy Up is here!" onboarding card on the adv2
  // canvas (the tidy-up demo). Initialized lazily from `automationId`
  // so it fires on first paint without a flicker. Dismissed via the
  // X button and not reshown until the next fresh load — which on
  // isolated builds happens every refresh (no persistence) but on the
  // combined site happens once per browser tab.
  const [tidyIntroOpen, setTidyIntroOpen] = useState(
    () => automationId === 'adv2',
  )
  /** Multi-select set of node ids. Plain click replaces; Shift+Click toggles
   *  membership. The action menu is anchored to the single most-recently
   *  clicked node and only shown when exactly one node is selected. */
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(() => new Set())
  /** The id whose pointer gesture was most recent — used to resolve which
   *  node the action menu should anchor to when the selection is a single
   *  node. */
  const [primarySelectedId, setPrimarySelectedId] = useState<string | null>(null)
  /** Anchor node id for the multi-select toolbar's positioning.
   *   - Shift+Click flow → the FIRST node the user clicked. Stays put
   *     as subsequent Shift+Clicks add more nodes.
   *   - Shift+Drag marquee → the topmost-leftmost node inside the
   *     marquee result.
   *  The toolbar centers above the connected sequence that contains
   *  this anchor. Cleared when the selection is cleared. */
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null)
  /** Currently selected edge (connector). Mutually exclusive with
   *  `selectedNodeId` — clicking a connector clears the node selection and
   *  vice-versa. Canvas-background click clears both. */
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  /** Canvas-space (pre-zoom) cursor position at the moment the current
   *  selection opened. Drives where `NodeActionMenu` floats. Null whenever
   *  nothing is selected. */
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  const [droppedTrigger, setDroppedTrigger] = useState<string | null>(null)
  /** Ref on the non-scaled canvas wrapper — used to convert a screen-space
   *  pointer position into canvas-space (pre-zoom) coordinates. */
  const canvasWrapperRef = React.useRef<HTMLDivElement | null>(null)

  /** Tracks the (anchor-id, multi-select-size) snapshot the last
   *  time we auto-panned for the multi-select toolbar. Re-checks
   *  only when either changes — prevents an infinite loop where
   *  the pan adjustment itself re-triggers the effect. */
  const lastToolbarPanRef = React.useRef<{
    anchorId: string | null
    size: number
  }>({ anchorId: null, size: 0 })

  /** Auto-pan the canvas the MINIMUM amount needed to keep the
   *  multi-select toolbar AND ITS HOVER TOOLTIP inside the
   *  viewport. Fires only when the toolbar APPEARS (selection size
   *  crosses into ≥2) or when its anchor changes (user shift-
   *  clicked a different first node, or the anchor was rebuilt
   *  after a delete). Reads pan/zoom/nodes from closure once per
   *  trigger — does NOT depend on them in the deps array, so
   *  subsequent pan/zoom adjustments don't re-trigger.
   *
   *  Toolbar geometry assumptions (matches the render block below):
   *    width  ≈ 124 px (three 36×36 buttons + 4 px padding × 2 + 2 px gap × 2)
   *    height ≈ 44  px (36 + 4 px padding × 2)
   *    translate(-50%, -100%) means the rendered bbox is
   *      left  = screenCenterX - W/2
   *      right = screenCenterX + W/2
   *      top   = screenTop - H
   *      bottom = screenTop
   *
   *  Tooltip reserve — each toolbar button's hover label is a dark
   *  pill anchored `bottom: calc(100% + 8px)` above the button. The
   *  pill is ~28 px tall (6 px padding + 16 px line-height + 6 px
   *  padding) + 8 px gap = ~36 px of vertical headroom needed
   *  ABOVE the toolbar's top edge so the tooltip never clips
   *  against the viewport top. The widest tooltip ("Duplicate"
   *  is the longest of the three labels — Duplicate / Tidy up /
   *  Delete) is ~80 px wide. Centered on each button, the tooltip
   *  can extend up to ~30 px past the toolbar's L/R edges when
   *  hovering the first or last button — so we also widen the
   *  horizontal reserve by `TOOLTIP_H_RESERVE` on each side. */
  React.useEffect(() => {
    const currentAnchor = selectionAnchorId
    const currentSize = selectedNodeIds.size
    if (currentSize < 2) {
      lastToolbarPanRef.current = { anchorId: null, size: 0 }
      return
    }
    if (
      lastToolbarPanRef.current.anchorId === currentAnchor &&
      lastToolbarPanRef.current.size >= 2
    ) {
      // Same anchor as last check, toolbar already accommodated.
      return
    }
    lastToolbarPanRef.current = { anchorId: currentAnchor, size: currentSize }

    const sel = nodes.filter((n) => selectedNodeIds.has(n.id))
    if (sel.length === 0) return
    const anchor =
      (currentAnchor && sel.find((n) => n.id === currentAnchor)) ||
      [...sel].sort((a, b) => a.y - b.y || a.x - b.x)[0]
    if (!anchor) return

    const wrapperRect = canvasWrapperRef.current?.getBoundingClientRect()
    if (!wrapperRect) return

    const TOOLBAR_W = 124
    const TOOLBAR_H = 44
    const TOOLBAR_MARGIN = 8
    const VIEWPORT_PAD = 8
    // Reserve headroom above the toolbar so the hover tooltip pill
    // (~28 px tall + 8 px gap = 36 px) doesn't get clipped when
    // the user hovers any button.
    const TOOLTIP_V_RESERVE = 36
    // The tooltip is centered on each button, so the leftmost
    // button's tooltip can overhang the toolbar's left edge, and
    // similarly on the right. Reserve enough horizontal headroom
    // for the widest label ("Duplicate") halved.
    const TOOLTIP_H_RESERVE = 30

    const screenCenterX = pan.x + anchor.x * zoom
    const screenTop = pan.y + (anchor.y - NODE_H / 2) * zoom - TOOLBAR_MARGIN
    const tbLeft = screenCenterX - TOOLBAR_W / 2
    const tbRight = screenCenterX + TOOLBAR_W / 2
    const tbTop = screenTop - TOOLBAR_H
    const tbBottom = screenTop

    // Expand the bbox to include the tooltip reserve. The bottom
    // edge doesn't need extension (tooltip appears ABOVE buttons).
    const effLeft = tbLeft - TOOLTIP_H_RESERVE
    const effRight = tbRight + TOOLTIP_H_RESERVE
    const effTop = tbTop - TOOLTIP_V_RESERVE
    const effBottom = tbBottom

    let dx = 0
    let dy = 0
    if (effLeft < VIEWPORT_PAD) dx = VIEWPORT_PAD - effLeft
    else if (effRight > wrapperRect.width - VIEWPORT_PAD)
      dx = wrapperRect.width - VIEWPORT_PAD - effRight
    if (effTop < VIEWPORT_PAD) dy = VIEWPORT_PAD - effTop
    else if (effBottom > wrapperRect.height - VIEWPORT_PAD)
      dy = wrapperRect.height - VIEWPORT_PAD - effBottom

    if (dx !== 0 || dy !== 0) {
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeIds, selectionAnchorId])
  /** Canvas pan offset in SCREEN pixels (applied before `scale(zoom)` in the
   *  transform so the translation is not scaled itself). Drag the empty
   *  background to move the viewport. Wheel/trackpad scroll is
   *  intentionally NOT wired — panning is drag-only. */
  const [pan, setPan] = useState<{ x: number; y: number }>(() =>
    persistedOnMount?.pan ?? { x: 0, y: 0 },
  )
  /** Active pan gesture. `null` while idle. Captured on pointerdown over
   *  the empty background; flushed on pointerup. Using a ref (not state)
   *  avoids re-rendering every pointermove. */
  const panGestureRef = React.useRef<
    { startClientX: number; startClientY: number; startPanX: number; startPanY: number; moved: boolean } | null
  >(null)
  const [isPanning, setIsPanning] = useState(false)
  /** Pan mode toggle. Default = off (cursor stays as the regular arrow,
   *  drag does nothing on empty canvas — only Shift+Drag still
   *  marquees). Pressing Tab (when focus isn't on an input) toggles
   *  pan mode; cursor becomes the hand grab/grabbing while it's on. */
  const [panMode, setPanMode] = useState(false)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const t = e.target as HTMLElement | null
      // Don't hijack Tab when the user is typing in a form field — Tab
      // still cycles inputs there. Only intercept when focus is on the
      // canvas chrome (body, buttons, etc).
      if (t) {
        const tag = t.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return
      }
      e.preventDefault()
      setPanMode((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  /** Active Shift+Drag rectangle selection. Coordinates are canvas-space
   *  (post-pan, pre-zoom). When non-null, the canvas renders a translucent
   *  rectangle from (x1,y1)→(x2,y2) and any node whose bounding box
   *  intersects that rectangle joins the selection on pointerup. */
  const [marquee, setMarquee] = useState<
    { x1: number; y1: number; x2: number; y2: number } | null
  >(null)
  const marqueeStartRef = React.useRef<{
    clientX: number
    clientY: number
    canvasX: number
    canvasY: number
    prevIds: Set<string>
  } | null>(null)
  // While a marquee or pan gesture is live, the pointer may travel
  // out of the canvas (over the header / sidebar) before pointerup
  // fires — and without a global guard the browser would highlight
  // any text the cursor passes through. Lock user-select on the
  // document root for the duration of the gesture, and clear any
  // selection that already started. Restores prior values on cleanup.
  React.useEffect(() => {
    const dragging = isPanning || marquee != null
    if (!dragging) return
    const prevBody = document.body.style.userSelect
    const prevHtml = document.documentElement.style.userSelect
    document.body.style.userSelect = 'none'
    document.documentElement.style.userSelect = 'none'
    // Wipe any text selection that the browser already started before
    // our lock kicked in (e.g. selection that began on a header label
    // when the gesture-start moved the pointer over it).
    try {
      window.getSelection()?.removeAllRanges()
    } catch {}
    return () => {
      document.body.style.userSelect = prevBody
      document.documentElement.style.userSelect = prevHtml
    }
  }, [isPanning, marquee])
  /** Toast notification shown after each multi-select action. Auto-
   *  dismisses after ~4s; clicking Undo restores from `lastAction` and
   *  hides the toast immediately. */
  const [toast, setToast] = useState<{ title: string; body: string } | null>(
    null,
  )
  React.useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])
  // Undo toast and the Tidy Up intro card share the bottom-right
  // corner. When a toast appears, dismiss the intro card so the
  // toast (with its Undo button) is fully readable and clickable.
  React.useEffect(() => {
    if (toast) setTidyIntroOpen(false)
  }, [toast])

  /** Latest reversible action — set after Duplicate / Tidy up / Delete
   *  fires. The toast notification's Undo button reads this to restore
   *  the captured `snapshot` (full canvas state). Cleared when undone
   *  or replaced. */
  /** Bounded undo/redo history. `undoStack` holds the snapshots
   *  captured BEFORE each mutating action; `redoStack` collects the
   *  inverse so the user can step forward again after an undo. New
   *  actions push to `undoStack` and clear `redoStack` (the standard
   *  branching-history rule — once you undo and then make a fresh
   *  change, redo of the abandoned branch is no longer reachable). */
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([])

  /** Convert a client-space (viewport) pointer position into canvas-space
   *  (pre-zoom, pre-pan) coordinates. This is the inverse of the surface's
   *  `translate(pan) scale(zoom)` transform. Used by every site that needs
   *  to place or hit-test something in the node coordinate system. */
  const clientToCanvas = React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasWrapperRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      }
    },
    [pan.x, pan.y, zoom],
  )

  // Seed graph matching the mockup. Promoted to state so drag-drops + keyboard
  // activation can append new nodes.
  // ----- Seed: multi-branch DD test scenario -----
  // Layout reads left-to-right with three rows fanning out of D1:
  //
  //   trigger        D1            row 0 →  Apply tag → Send email
  //   "Purchase" →  diamond  ────  row 1 →  [locked pair: Email Confirmation → Confirm Email] → Add to sequence
  //                              \─ row 2 →  Create a deal → D2 ──── row 2 →  Notify rep
  //                                                              \── row 3 →  Apply a note
  //
  // Exercises: 3-way fork at D1, nested DD at D2, a locked pair in
  // the middle branch (lock badge on the connector, drag-together,
  // delete-together, tidy expansion), title-aware spacing on the
  // "Email Confirmation Request" wide label, multi-row tidy-up.
  const [nodes, setNodes] = useState<BuilderNode[]>(() => {
    // If we have a persisted snapshot for this automation, rebuild
    // nodes from it (icons reconstructed from the slug `name` via
    // `iconForPersistedNode`). Otherwise check the per-id seed
    // dispatcher (adv2–adv6 get the chaotic-image seed). Last
    // resort: the inline default DD test seed below.
    if (persistedOnMount?.nodes) {
      return persistedOnMount.nodes.map(deserializeNode)
    }
    const idSeed = seedForAutomation(automationId || '')
    if (idSeed) return idSeed.nodes
    return [
    // Trigger
    {
      id: 'n1', type: 'trigger', title: 'When a purchase is made',
      name: 'product-is-purchased',
      x: 200, y: 360, warning: true,
      accent: G.success,
      icon: (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>
        </svg>
      ),
    },
    // Decision Diamond #1
    { id: 'd1', type: 'decision', title: 'Customer · Decision Diamond', x: 460, y: 360, warning: true },

    // Branch 1 (row 0): Apply loyalty tag → Send loyalty email
    {
      id: 'n2', type: 'action', title: 'Apply loyalty tag',
      name: 'apply-or-remove-tag',
      x: 720, y: 100,
      accent: G.primary,
      icon: (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41 13 21l-9-9V3h9l9 9-1.41 1.41z"/><circle cx="7.5" cy="7.5" r="1.5"/>
        </svg>
      ),
    },
    {
      id: 'n3', type: 'action', title: 'Send loyalty coupon',
      name: 'send-email',
      x: 930, y: 100,
      accent: G.primary,
      icon: (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
    },

    // Branch 2 (row 1) — LOCKED PAIR in the middle
    {
      id: 'n4', type: 'action', title: 'Email Confirmation Request',
      name: 'get-email-opt-in',
      x: 720, y: 360,
      accent: G.primary,
      icon: <IconSvg svg={EMAIL_CONFIRMATION_REQUEST_SVG} size={ICON_SIZE} />,
    },
    {
      id: 'n5', type: 'trigger', title: 'Confirm Email',
      name: 'confirm-email',
      x: 1050, y: 360,
      accent: G.success,
      icon: <IconSvg svg={CONFIRM_EMAIL_SVG} size={ICON_SIZE} />,
    },
    {
      id: 'n6', type: 'action', title: 'Add to nurture sequence',
      name: 'add-or-remove-from-sequence',
      x: 1260, y: 360,
      accent: G.primary,
      icon: (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
        </svg>
      ),
    },

    // Branch 3 (row 2 + nested DD): Create a deal → D2 → notify rep / apply a note
    {
      id: 'n7', type: 'action', title: 'Create a deal', subtitle: 'High-value pipeline',
      name: 'create-a-deal',
      x: 720, y: 620,
      accent: G.primary,
      icon: (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4.5L6 21l1.5-7.5L2 9h7z"/>
        </svg>
      ),
    },
    { id: 'd2', type: 'decision', title: 'Deal · Decision Diamond', x: 930, y: 620, warning: true },
    {
      id: 'n8', type: 'action', title: 'Notify sales rep',
      name: 'create-a-task',
      x: 1140, y: 620,
      accent: G.primary,
      icon: (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
      ),
    },
    {
      id: 'n9', type: 'action', title: 'Apply a note',
      name: 'apply-a-note',
      x: 1140, y: 870,
      accent: G.primary,
      icon: (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="9" y1="13" x2="15" y2="13"/>
          <line x1="9" y1="17" x2="13" y2="17"/>
        </svg>
      ),
    },
  ]
  })

  const [edges, setEdges] = useState<BuilderEdge[]>(() => {
    if (persistedOnMount?.edges) return persistedOnMount.edges
    const idSeed = seedForAutomation(automationId || '')
    if (idSeed) return idSeed.edges
    return [
    // Trigger → D1
    { id: 'e1', from: 'n1', to: 'd1' },
    // D1 → three branches
    { id: 'e2', from: 'd1', to: 'n2' },   // row 0
    { id: 'e3', from: 'd1', to: 'n4' },   // row 1 — locked-pair host
    { id: 'e4', from: 'd1', to: 'n7' },   // row 2 — into nested DD
    // Branch 1
    { id: 'e5', from: 'n2', to: 'n3' },
    // Branch 2 — locked pair edge gets the lock badge (registered below)
    { id: 'e6', from: 'n4', to: 'n5' },
    { id: 'e7', from: 'n5', to: 'n6' },
    // Branch 3 + nested DD
    { id: 'e8', from: 'n7', to: 'd2' },
    { id: 'e9', from: 'd2', to: 'n8' },   // row 2
    { id: 'e10', from: 'd2', to: 'n9' },  // row 3
  ]
  })

  /** Locked pairs — pairs of nodes that were auto-spawned together and
   *  must travel as a unit. Today the only producer is the Then
   *  `get-email-opt-in` pick, which auto-spawns a When `Confirm Email`
   *  partner and links them with a locked edge (rendered with a lock
   *  badge mid-line). Pair semantics:
   *    - Deleting either half deletes the other half + the locked edge.
   *    - Dragging either half moves the partner by the same delta.
   *    - The locked edge cannot be re-routed or detached.
   *    - Tidy-up treats the partner as part of the host's sequence
   *      (the host registers a tail column when its partner is not in
   *      the active selection — see `tailColsByHostId`). */
  const [lockedPairs, setLockedPairs] = useState<LockedPair[]>(() => {
    if (persistedOnMount?.lockedPairs) return persistedOnMount.lockedPairs
    const idSeed = seedForAutomation(automationId || '')
    if (idSeed) return idSeed.lockedPairs
    return [
    // Seed the multi-branch test scenario's middle-row locked pair:
    // n4 "Email Confirmation Request" (host) → n5 "Confirm Email"
    // (partner) joined by edge e6 with a lock badge mid-line.
    { hostId: 'n4', partnerId: 'n5', edgeId: 'e6' },
  ]
  })

  /** Locked-pair Y-alignment guard.
   *
   *  The lock-decorated connector is supposed to read as a single
   *  horizontal beam between host and partner — losing horizontal
   *  alignment makes the lock badge sit on a diagonal and breaks the
   *  visual idiom of "these two are bonded into one step."
   *
   *  Normal drag already keeps them aligned (handleNodeMove translates
   *  both halves by the same dx/dy), but other paths — initial seed,
   *  inline-add fan-out, tidy-up edge cases, undo to a desynced
   *  snapshot — can leave the partner's y diverging from the host's.
   *  This effect runs after every node change and snaps the partner's
   *  y back to the host's. It returns `prev` unchanged when alignment
   *  is already correct, so it doesn't cause a render loop. */
  React.useEffect(() => {
    if (lockedPairs.length === 0) return
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]))
      let changed = false
      const next = prev.map((n) => {
        const pair = lockedPairs.find((p) => p.partnerId === n.id)
        if (!pair) return n
        const host = byId.get(pair.hostId)
        if (!host || host.y === n.y) return n
        changed = true
        return { ...n, y: host.y }
      })
      return changed ? next : prev
    })
    // `nodes` is intentionally in deps even though we read via the
    // setter callback — we want the guard to re-evaluate on any
    // position change, not just lockedPairs mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedPairs, nodes])

  /** Lookup: returns the pair entry this node belongs to (either as
   *  host or partner), or null if it isn't locked. */
  const findLockedPair = React.useCallback(
    (nodeId: string): LockedPair | null =>
      lockedPairs.find((p) => p.hostId === nodeId || p.partnerId === nodeId) ?? null,
    [lockedPairs],
  )

  /** Picker popover state — null when closed. `originId` is the node whose
   *  "+" button was clicked; `type` determines which catalog to show; `anchor`
   *  is canvas-space coords for popover placement. */
  const [picker, setPicker] = useState<
    { originId: string; type: 'when' | 'then'; anchor: { x: number; y: number } } | null
  >(null)

  /** When non-null, the Decision Diamond configuration modal is open for
   *  this node id. Closing simply sets back to null — config state lives
   *  in `decisionConfigs` keyed by node id so it persists across open/close. */
  const [decisionEditorId, setDecisionEditorId] = useState<string | null>(null)
  // "When a purchase is made" trigger config — opens automatically when the
  // user picks `product-is-purchased` from the "+" picker, and re-opens via
  // the node action menu's "View and edit". Save commits a draft from the
  // editor; close-without-save discards the draft.
  const [purchaseEditorId, setPurchaseEditorId] = useState<string | null>(null)
  const [purchaseConfigs, setPurchaseConfigs] = useState<
    Record<string, PurchaseTriggerConfig>
  >(() =>
    (persistedOnMount?.purchaseConfigs as Record<
      string,
      PurchaseTriggerConfig
    >) ?? {},
  )
  // "Appointments" goal trigger config — opens automatically when the user
  // picks `appointments` from the "+" picker, and re-opens via the node
  // action menu's "View and edit".
  const [appointmentEditorId, setAppointmentEditorId] = useState<string | null>(null)
  const [appointmentConfigs, setAppointmentConfigs] = useState<
    Record<string, AppointmentGoalConfig>
  >(() =>
    (persistedOnMount?.appointmentConfigs as Record<
      string,
      AppointmentGoalConfig
    >) ?? {},
  )
  // "Pipeline stage move" trigger config — opens automatically when the
  // user picks `pipeline-stage-is-moved` from the "+" picker, and
  // re-opens via the action menu's "View and edit".
  const [pipelineEditorId, setPipelineEditorId] = useState<string | null>(null)
  const [pipelineConfigs, setPipelineConfigs] = useState<
    Record<string, PipelineStageMoveConfig>
  >(() =>
    (persistedOnMount?.pipelineConfigs as Record<
      string,
      PipelineStageMoveConfig
    >) ?? {},
  )
  // Inline-rename target — set when the user picks "Rename" from the
  // action menu of a non-decision node. CanvasNode swaps its title for
  // an input while this is the matching id.
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null)
  /** Per-diamond configuration. Keyed by node id. A fresh diamond starts
   *  with one rule group per outgoing edge + a default-routing stub. */
  const [decisionConfigs, setDecisionConfigs] = useState<
    Record<string, DecisionDiamondConfig>
  >(() =>
    (persistedOnMount?.decisionConfigs as Record<
      string,
      DecisionDiamondConfig
    >) ?? {},
  )

  /** Persist the canvas to localStorage whenever any saved-piece of
   *  state changes — node positions, edges, locked pairs, configs,
   *  or camera. Debounced 250 ms so a continuous drag doesn't fire
   *  the writer on every frame. Keyed by `automationId` so different
   *  automations each have their own snapshot. Isolated demo builds
   *  skip the save entirely so each tester always opens the same seed. */
  React.useEffect(() => {
    const FORCED =
      (import.meta as any).env?.VITE_FORCED_AUTOMATION_ID || undefined
    if (FORCED) return
    const id = automationId || 'default'
    const handle = window.setTimeout(() => {
      saveCanvasState(id, {
        v: CANVAS_STORAGE_VERSION,
        nodes: nodes.map(serializeNode),
        edges,
        lockedPairs,
        decisionConfigs,
        purchaseConfigs,
        appointmentConfigs,
        pipelineConfigs,
        pan,
        zoom,
      })
    }, 250)
    return () => window.clearTimeout(handle)
  }, [
    automationId,
    nodes,
    edges,
    lockedPairs,
    decisionConfigs,
    purchaseConfigs,
    appointmentConfigs,
    pipelineConfigs,
    pan,
    zoom,
  ])

  /** Active drag-to-connect gesture. `null` when idle. All coordinates are
   *  in canvas-space (pre-zoom, pre-pan). `targetId` is the node currently
   *  under the cursor (if any, and not the origin itself) — the drop target
   *  that will receive an incoming edge if the user releases now. */
  const [connecting, setConnecting] = useState<{
    originId: string
    startX: number
    startY: number
    currentX: number
    currentY: number
    targetId: string | null
  } | null>(null)

  /** Kicks off a drag-to-connect. Called by CanvasNode when the user moves
   *  past the click-vs-drag threshold on the hover "+". Starts window
   *  pointermove / pointerup listeners so the cursor tracking works even
   *  when the pointer leaves the button's bounds. */
  const beginConnect = React.useCallback(
    (originId: string, clientX: number, clientY: number) => {
      const start = clientToCanvas(clientX, clientY)
      setConnecting({
        originId,
        startX: start.x,
        startY: start.y,
        currentX: start.x,
        currentY: start.y,
        targetId: null,
      })
    },
    [clientToCanvas],
  )

  // While a connect-drag is in flight, attach window pointer listeners so
  // the preview line tracks the cursor anywhere on the page and the drop
  // is detected even if the release lands outside any node.
  React.useEffect(() => {
    if (!connecting) return
    const originId = connecting.originId
    const onMove = (e: PointerEvent) => {
      const p = clientToCanvas(e.clientX, e.clientY)
      // Hit-test: find the [data-node-id] under the cursor, excluding the
      // origin itself. elementsFromPoint sees through the transparent
      // preview SVG so we don't false-positive on our own overlay.
      let targetId: string | null = null
      const els = document.elementsFromPoint(e.clientX, e.clientY)
      for (const el of els) {
        const match = (el as HTMLElement).closest?.('[data-node-id]') as HTMLElement | null
        if (match) {
          const id = match.getAttribute('data-node-id')
          if (id && id !== originId) {
            targetId = id
            break
          }
        }
      }
      setConnecting((prev) =>
        prev
          ? { ...prev, currentX: p.x, currentY: p.y, targetId }
          : prev,
      )
    }
    const onUp = () => {
      setConnecting((prev) => {
        if (prev && prev.targetId) {
          // Commit: create edge origin → target, unless one already exists.
          setEdges((cur) => {
            if (
              cur.some((e) => e.from === prev.originId && e.to === prev.targetId)
            ) {
              return cur
            }
            return [
              ...cur,
              {
                id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                from: prev.originId,
                to: prev.targetId!,
              },
            ]
          })
          announce('Connected nodes')
        }
        return null
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [connecting, clientToCanvas])

  /** Auto-insert / route-through Decision Diamond on fan-out.
   *
   *  Rule (per §2 of the spec): when a non-decision node gains a 2nd
   *  outgoing connection, the builder inserts a Decision Diamond between
   *  it and its targets. Subsequent connections from the same source are
   *  routed through the existing diamond rather than creating a second.
   *
   *  We also dissolve diamonds that end up with a single outgoing target
   *  (e.g., after a target node is deleted) by reconnecting the source
   *  directly to the remaining target.
   *
   *  Runs as an effect on edges/nodes change. The `changed` guard ensures
   *  we never schedule a state update unless the graph actually needs
   *  restructuring — this prevents infinite effect loops. */
  React.useEffect(() => {
    let nextNodes = nodes
    let nextEdges = edges
    let changed = false

    // --- Pass 1: route-through for sources that already have a diamond -----
    // If a source has an outgoing edge to a diamond AND also has other
    // direct outgoing edges, re-wire those direct edges to originate from
    // the diamond instead. This is what makes "3rd connection from the
    // same source" append to the existing diamond (spec §2).
    const idsByType = new Map(nextNodes.map((n) => [n.id, n.type]))
    for (const src of nextNodes) {
      if (src.type === 'decision') continue
      const outgoing = nextEdges.filter((e) => e.from === src.id)
      if (outgoing.length < 2) continue
      const diamondEdge = outgoing.find((e) => idsByType.get(e.to) === 'decision')
      if (!diamondEdge) continue
      const diamondId = diamondEdge.to
      const directIds = outgoing
        .filter((e) => idsByType.get(e.to) !== 'decision')
        .map((e) => e.id)
      if (directIds.length === 0) continue
      nextEdges = nextEdges.map((e) =>
        directIds.includes(e.id) ? { ...e, from: diamondId } : e,
      )
      changed = true
    }

    // --- Pass 2: create a new diamond for sources with 2+ direct outputs --
    // Any non-decision source with ≥2 outgoing edges to non-diamond
    // targets and NO existing diamond gets one inserted. The diamond is
    // positioned midway between the source and its targets' centroid.
    const sourcesNeedingDiamond: string[] = []
    for (const src of nextNodes) {
      if (src.type === 'decision') continue
      const outgoing = nextEdges.filter((e) => e.from === src.id)
      if (outgoing.length < 2) continue
      const hasDiamond = outgoing.some(
        (e) => idsByType.get(e.to) === 'decision',
      )
      if (hasDiamond) continue
      const directTargets = outgoing.filter(
        (e) => idsByType.get(e.to) !== 'decision',
      )
      if (directTargets.length < 2) continue
      sourcesNeedingDiamond.push(src.id)
    }

    for (const srcId of sourcesNeedingDiamond) {
      const source = nextNodes.find((n) => n.id === srcId)!
      const directEdges = nextEdges.filter(
        (e) => e.from === srcId && idsByType.get(e.to) !== 'decision',
      )
      const targets = directEdges
        .map((e) => nextNodes.find((n) => n.id === e.to)!)
        .filter(Boolean)
      const avgTargetX =
        targets.reduce((s, t) => s + t.x, 0) / targets.length
      const avgTargetY =
        targets.reduce((s, t) => s + t.y, 0) / targets.length
      const diamondId = `d-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
      const diamond: BuilderNode = {
        id: diamondId,
        type: 'decision',
        title: 'Decision Diamond',
        // Sit midway between source and the centroid of its direct
        // targets — matches the "between source and targets" position
        // requested by spec §3.
        x: (source.x + avgTargetX) / 2,
        y: (source.y + avgTargetY) / 2,
        warning: true,
      }
      nextNodes = [...nextNodes, diamond]
      // Remove old direct edges, add source→diamond + diamond→each target.
      const directIds = new Set(directEdges.map((e) => e.id))
      nextEdges = nextEdges.filter((e) => !directIds.has(e.id))
      nextEdges = [
        ...nextEdges,
        {
          id: `e-${Date.now()}-sd-${Math.random().toString(36).slice(2, 5)}`,
          from: srcId,
          to: diamondId,
        },
        ...directEdges.map((e, i) => ({
          id: `e-${Date.now()}-dt-${i}-${Math.random().toString(36).slice(2, 5)}`,
          from: diamondId,
          to: e.to,
        })),
      ]
      // Refresh the type map so later passes see the new diamond.
      idsByType.set(diamondId, 'decision')
      changed = true
    }

    // --- Pass 3: dissolve diamonds that have collapsed back to a single ---
    // outgoing target. We DON'T dissolve diamonds with zero outgoing — those
    // are freshly-inserted user-created diamonds (via the picker's featured
    // "Decision diamond" card) waiting for the user to wire their branches.
    // We also DON'T dissolve diamonds with `presetRules` configured (those
    // were saved from the modal — they're load-bearing routing nodes, not
    // collapse candidates, even when chained at 1 outgoing).
    const diamonds = nextNodes.filter((n) => n.type === 'decision')
    for (const d of diamonds) {
      const outgoing = nextEdges.filter((e) => e.from === d.id)
      if (outgoing.length !== 1) continue
      const cfg = decisionConfigs[d.id]
      if (cfg?.presetRules && cfg.presetRules.length > 0) continue
      const incoming = nextEdges.filter((e) => e.to === d.id)
      // Remove the diamond and all edges touching it.
      nextEdges = nextEdges.filter((e) => e.from !== d.id && e.to !== d.id)
      nextNodes = nextNodes.filter((n) => n.id !== d.id)
      // Reconnect each upstream source directly to each remaining target.
      for (const inc of incoming) {
        for (const out of outgoing) {
          nextEdges = [
            ...nextEdges,
            {
              id: `e-diss-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              from: inc.from,
              to: out.to,
            },
          ]
        }
      }
      changed = true
    }

    if (changed) {
      setNodes(nextNodes)
      setEdges(nextEdges)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, nodes])

  /** The latest node — the most recently added surviving node. Since we
   *  always append on insert and filter on delete, `nodes[nodes.length-1]`
   *  is the freshest one. The `InlineAddPlaceholder` only docks here, and
   *  only if it's still an "open leaf" (has no outgoing edge yet). */
  const latestNode = nodes[nodes.length - 1]
  const latestIsOpenLeaf =
    latestNode != null && !edges.some((e) => e.from === latestNode.id)
  const openLeaves = latestIsOpenLeaf && latestNode ? [latestNode] : []

  // edge anchor points — right edge of "from", left edge of "to"
  const nodeAnchorRight = (n: BuilderNode) =>
    n.type === 'decision'
      ? { x: n.x + DIAMOND / 2 * Math.SQRT2, y: n.y } // rotated box edge approximation
      : { x: n.x + NODE_W / 2, y: n.y }
  const nodeAnchorLeft = (n: BuilderNode) =>
    n.type === 'decision'
      ? { x: n.x - DIAMOND / 2 * Math.SQRT2, y: n.y }
      : { x: n.x - NODE_W / 2, y: n.y }

  const announce = (msg: string) => {
    setDroppedTrigger(msg)
    setTimeout(() => setDroppedTrigger(null), 2200)
  }

  /** Build a `BuilderNode` from a palette cell payload at the given
   *  canvas-space coordinates. Resolves the icon from the source library so
   *  the cell's original SVG renders on the canvas tile. */
  const buildNodeFromPayload = (
    payload: { type: 'when' | 'then'; name: string; defaultName: string },
    x: number,
    y: number,
  ): BuilderNode => {
    const source = payload.type === 'when' ? TRIGGERS : ACTIONS
    const def = source.find((t) => t.slug === payload.name)
    const accent = payload.type === 'when' ? G.success : G.primary
    return {
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: payload.type === 'when' ? 'trigger' : 'action',
      title: payload.defaultName,
      name: payload.name,
      x,
      y,
      accent,
      icon: def ? <IconSvg svg={def.svg} size={ICON_SIZE} /> : undefined,
    }
  }

  /** Clamp a drop point to a reasonable grid so nodes never straddle the
   *  canvas edge. Node is positioned by its center. */
  const clampToCanvas = (x: number, y: number) => ({
    x: Math.max(NODE_W / 2 + 12, x),
    y: Math.max(NODE_H / 2 + 12, y),
  })

  /** Center-to-center horizontal stride sufficient for two nodes with
   *  the given titles to sit next to each other without their titles
   *  overlapping, while preserving `gap` edge-to-edge whitespace. The
   *  per-side footprint is `max(NODE_W/2, measuredTitleWidth/2)` —
   *  short titles fall back to the tile width, long titles (e.g.
   *  "Email Confirmation Request") get the breathing room they need.
   *
   *  Used by every inline-add insert path so adding to a sequence
   *  with a wide-titled predecessor doesn't crowd the new node into
   *  the predecessor's label. */
  const titleAwareStride = (
    originTitle: string,
    newTitle: string,
    gap: number,
  ): number => {
    const originHalfW = Math.max(
      NODE_W / 2,
      measureTitleVisualWidth(originTitle) / 2,
    )
    const newHalfW = Math.max(
      NODE_W / 2,
      measureTitleVisualWidth(newTitle) / 2,
    )
    return originHalfW + gap + newHalfW
  }

  /** Insert a new node as the next step after `originId`, then draw a
   *  default connector from origin → new node. The freshly-created node
   *  becomes the new open leaf, so its own `InlineAddPlaceholder` will
   *  render on the next paint. */
  const insertAfterOrigin = (
    originId: string,
    payload: { type: 'when' | 'then'; name: string; defaultName: string },
  ): string | null => {
    const origin = nodes.find((n) => n.id === originId)
    if (!origin) return null
    pushUndo(`Added "${payload.defaultName}"`)
    // Title-aware stride so a wide-titled origin (or new node) gets a
    // proportionally wider gap. Falls back to NODE_W + PH_GAP for the
    // typical short-title case.
    const target = {
      x: origin.x + titleAwareStride(origin.title, payload.defaultName, PH_GAP),
      y: origin.y,
    }
    const node = buildNodeFromPayload(payload, target.x, target.y)
    setNodes((prev) => [...prev, node])
    setEdges((prev) => [
      ...prev,
      { id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, from: originId, to: node.id },
    ])
    selectOnly(node.id)
    announce(`Added "${payload.defaultName}"`)
    return node.id
  }

  /** Insert a decision-diamond node directly after `originId` and open the
   *  config modal so the user can start building rules immediately. The
   *  modal is the higher-level home for entity hierarchy + rule cards. */
  const insertDecisionDiamondAfter = (originId: string) => {
    const origin = nodes.find((n) => n.id === originId)
    if (!origin) return
    pushUndo('Added decision diamond')
    const diamondId = `d-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    const diamond: BuilderNode = {
      id: diamondId,
      type: 'decision',
      title: 'Decision Diamond',
      x: origin.x + titleAwareStride(origin.title, 'Decision Diamond', PH_GAP),
      y: origin.y,
    }
    setNodes((prev) => [...prev, diamond])
    setEdges((prev) => [
      ...prev,
      {
        id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        from: originId,
        to: diamondId,
      },
    ])
    selectOnly(diamondId)
    setDecisionEditorId(diamondId)
    announce('Added decision diamond')
  }

  /** Insert the Get email opt-in Then node AND its locked Confirm Email
   *  When partner as a single atomic action. Both nodes + the connecting
   *  edge land in one render so the pair never appears half-formed, and
   *  the pair is registered in `lockedPairs` so subsequent
   *  delete/drag/tidy operations treat them as one unit.
   *
   *  Layout: host sits where any normal Then would (origin + stride);
   *  partner sits one full stride to the right of the host on the same
   *  row. The InlineAddPlaceholder docks past the partner because the
   *  partner becomes the new open leaf. */
  /** Build the host + Confirm Email partner cells and the locked
   *  host→partner edge at the given (host) coordinates. Returns the
   *  cells + edge as a tuple so callers (after-origin pick OR
   *  free-standing sidebar drop) can splice them into state with
   *  whatever incoming edge is appropriate.
   *
   *  Matches the Keap funnel-editor data model: the host is the
   *  "sequence" cell marked `methodLocked`/`flowItemsLocked`, the
   *  partner is the WHEN goal (`GOAL_EMAIL_CONFIRM`, non-configurable),
   *  and the lock badge on the connector is a property of the locked
   *  sequence rather than of the edge itself. */
  const buildEmailOptInLockedPairCells = (
    payload: { type: 'when' | 'then'; name: string; defaultName: string },
    hostX: number,
    hostY: number,
  ) => {
    // Locked-pair stride uses the wider LOCKED_PAIR_GAP rather than
    // the standard PH_GAP so the enlarged padlock badge sits in
    // generous whitespace and the dependency reads visually. Stride
    // is also title-aware so the host's wide "Email Confirmation
    // Request" label can't crowd the partner.
    const hostBase = buildNodeFromPayload(payload, hostX, hostY)
    const host: BuilderNode = {
      ...hostBase,
      title: 'Email Confirmation Request',
      icon: <IconSvg svg={EMAIL_CONFIRMATION_REQUEST_SVG} size={ICON_SIZE} />,
    }
    const partnerId = `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-p`
    const partner: BuilderNode = {
      id: partnerId,
      type: 'trigger',
      title: 'Confirm Email',
      name: 'confirm-email',
      x:
        hostX +
        titleAwareStride(host.title, 'Confirm Email', LOCKED_PAIR_GAP),
      y: hostY,
      accent: G.success,
      icon: <IconSvg svg={CONFIRM_EMAIL_SVG} size={ICON_SIZE} />,
    }
    const edgeHostToPartner: BuilderEdge = {
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 5)}-hp`,
      from: host.id,
      to: partner.id,
    }
    return { host, partner, edgeHostToPartner }
  }

  /** Inline-picker variant: insert the locked pair as a downstream of
   *  `originId`. Adds the origin→host edge in the same batch so the
   *  pair is rendered fully wired on the next paint. */
  const insertGetEmailOptInLockedPair = (
    originId: string,
    payload: { type: 'when' | 'then'; name: string; defaultName: string },
  ): string | null => {
    const origin = nodes.find((n) => n.id === originId)
    if (!origin) return null
    pushUndo(`Added "${payload.defaultName}" + Confirm Email`)
    // Origin → host stride is title-aware (the host's
    // "Email Confirmation Request" label is wider than NODE_W, so a
    // fixed stride would clip into the origin's title).
    const stride = titleAwareStride(
      origin.title,
      'Email Confirmation Request',
      PH_GAP,
    )
    const { host, partner, edgeHostToPartner } = buildEmailOptInLockedPairCells(
      payload,
      origin.x + stride,
      origin.y,
    )
    const edgeOriginToHost: BuilderEdge = {
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 5)}-oh`,
      from: originId,
      to: host.id,
    }
    setNodes((prev) => [...prev, host, partner])
    setEdges((prev) => [...prev, edgeOriginToHost, edgeHostToPartner])
    setLockedPairs((prev) => [
      ...prev,
      { hostId: host.id, partnerId: partner.id, edgeId: edgeHostToPartner.id },
    ])
    selectOnly(host.id)
    announce(`Added "${payload.defaultName}" + Confirm Email (locked)`)
    return host.id
  }

  /** Sidebar-drop variant: spawn the locked pair as a free-standing
   *  pair at the drop point. No incoming edge — the pair stands on
   *  its own until the user wires it up. Matches the Keap "drop on
   *  blank canvas" path where the sequence + goal appear together. */
  const dropEmailOptInLockedPair = (
    payload: { type: 'when' | 'then'; name: string; defaultName: string },
    hostX: number,
    hostY: number,
  ): string => {
    pushUndo(`Added "${payload.defaultName}" + Confirm Email`)
    const { host, partner, edgeHostToPartner } = buildEmailOptInLockedPairCells(
      payload,
      hostX,
      hostY,
    )
    setNodes((prev) => [...prev, host, partner])
    setEdges((prev) => [...prev, edgeHostToPartner])
    setLockedPairs((prev) => [
      ...prev,
      { hostId: host.id, partnerId: partner.id, edgeId: edgeHostToPartner.id },
    ])
    selectOnly(host.id)
    announce(`Added "${payload.defaultName}" + Confirm Email (locked)`)
    return host.id
  }

  const handleDropCellOnCanvas = (payload: {
    type: 'when' | 'then'
    name: string
    defaultName: string
    x: number
    y: number
  }) => {
    // Drop coordinates come in canvas-wrapper pixels; divide by zoom to get
    // pre-scale canvas-space coords since the surface is transformed.
    const { x, y } = clampToCanvas(payload.x / zoom, payload.y / zoom)
    // Locked-pair drop: the sidebar Then `get-email-opt-in` cell
    // spawns the same Email-Confirmation-Request + Confirm Email pair
    // the inline picker produces, free-standing at the drop point. The
    // Keap funnel editor's `onAddCell` calls into the same
    // `addEmailConfirmationElements` regardless of source surface.
    if (payload.type === 'then' && payload.name === 'get-email-opt-in') {
      dropEmailOptInLockedPair(payload, x, y)
      return
    }
    pushUndo(`Added "${payload.defaultName}"`)
    const node = buildNodeFromPayload(payload, x, y)
    setNodes((prev) => [...prev, node])
    selectOnly(node.id)
    announce(`Added "${payload.defaultName}"`)
  }

  /** Replace the current selection with a single node id (also updates the
   *  "primary" id, which drives the single-node action menu anchor). */
  const selectOnly = (id: string | null) => {
    if (id == null) {
      setSelectedNodeIds(new Set())
      setPrimarySelectedId(null)
      setSelectionAnchorId(null)
    } else {
      setSelectedNodeIds(new Set([id]))
      setPrimarySelectedId(id)
      // Plain (re)selection resets the toolbar anchor to this node —
      // any subsequent Shift+Click multi-select will keep this one as
      // the anchor.
      setSelectionAnchorId(id)
    }
  }

  /** Tracks whether the in-flight drag has already snapshotted for
   *  undo. We push ONCE per gesture — on the first frame where the
   *  node's position differs from its previous render position — and
   *  reset when the pointer comes up anywhere on the document. */
  const dragSnapshotRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    const onUp = () => {
      dragSnapshotRef.current = null
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  /** Update a node's canvas-space center. Called repeatedly while
   *  dragging. The single-node drag path becomes a group translate
   *  whenever:
   *    - The dragged node belongs to a **locked pair** — the partner
   *      moves by the same delta so the lock-decorated connector
   *      doesn't visually stretch.
   *    - The dragged node is part of a **multi-selection** (size ≥ 2)
   *      — every selected node moves by the same delta, so the user
   *      can reposition a whole sub-graph as a rigid block. Any
   *      locked partners of any selected node ride along too (a
   *      locked pair is never split, even if only one half is in
   *      the selection set).
   *
   *  The dragged node's absolute (x, y) comes from the gesture
   *  handler; everyone else gets translated by the incremental
   *  delta this frame, so subsequent frames stay aligned. */
  const handleNodeMove = (id: string, x: number, y: number) => {
    // Push undo ONCE per drag gesture, on the first move frame.
    // Subsequent frames in the same gesture share that snapshot.
    if (dragSnapshotRef.current !== id) {
      pushUndo('Moved')
      dragSnapshotRef.current = id
    }
    setNodes((prev) => {
      const moved = prev.find((n) => n.id === id)
      if (!moved) return prev
      const dx = x - moved.x
      const dy = y - moved.y

      // Build the set of node ids that should translate with this
      // gesture. Always includes the dragged node. Expands to:
      //   • Every currently-selected node if the dragged node is in
      //     a multi-selection (size ≥ 2). Group-drag is suppressed
      //     when only one node is selected (or none) so dragging an
      //     unrelated node never disturbs a separate selection.
      //   • The locked-pair partner of every member of the moving
      //     set — closure pass so chains of locked links resolve.
      const movingIds = new Set<string>([id])
      if (selectedNodeIds.size >= 2 && selectedNodeIds.has(id)) {
        for (const sid of selectedNodeIds) movingIds.add(sid)
      }
      // Closure: any locked-pair half whose partner is already in
      // movingIds must also move. One pass suffices since pairs
      // aren't chained, but the loop is harmless and future-proofs
      // chained locks.
      let grew = true
      while (grew) {
        grew = false
        for (const pair of lockedPairs) {
          if (movingIds.has(pair.hostId) && !movingIds.has(pair.partnerId)) {
            movingIds.add(pair.partnerId)
            grew = true
          }
          if (movingIds.has(pair.partnerId) && !movingIds.has(pair.hostId)) {
            movingIds.add(pair.hostId)
            grew = true
          }
        }
      }

      if (movingIds.size === 1) {
        // Fast path — single, unanchored node move.
        return prev.map((n) => (n.id === id ? { ...n, x, y } : n))
      }

      return prev.map((n) => {
        if (n.id === id) return { ...n, x, y }
        if (movingIds.has(n.id)) return { ...n, x: n.x + dx, y: n.y + dy }
        return n
      })
    })
  }

  /** Expand a set of node ids to include the partner of any locked
   *  half that's already in the set. Used by multi-select actions
   *  (delete, duplicate, tidy) so a locked pair never gets torn in
   *  half by an action that operates on the user's literal selection. */
  const expandWithLockedPartners = (ids: Set<string>): Set<string> => {
    const next = new Set(ids)
    for (const id of ids) {
      const pair = lockedPairs.find(
        (p) => p.hostId === id || p.partnerId === id,
      )
      if (!pair) continue
      next.add(pair.hostId)
      next.add(pair.partnerId)
    }
    return next
  }

  /** Open the Decision Diamond editor for a node. Seeds a config on first
   *  open by deriving rule groups from the diamond's current outgoing
   *  edges (one group per target, in creation order). */
  const openDecisionEditor = (nodeId: string) => {
    const diamond = nodes.find((n) => n.id === nodeId)
    if (!diamond || diamond.type !== 'decision') return
    setDecisionConfigs((prev) => {
      if (prev[nodeId]) return prev
      const targets = edges.filter((e) => e.from === nodeId)
      // Decision diamonds only exist when there are 2+ outgoing edges
      // (enforced by the auto-insert/dissolve effect), so we always render
      // exactly one "Rules for" card per outgoing target. No stub padding.
      // All groups open empty — CTA + info banner. Blocks are created on
      // demand when the user clicks "Add a rule".
      const groups: DDGroup[] = targets.map((e) => {
        const target = nodes.find((n) => n.id === e.to)
        return makeBlankGroup(e.to, target?.title ?? 'Sequence')
      })
      return {
        ...prev,
        [nodeId]: {
          groups,
          defaultRouting: groups[groups.length - 1]?.targetName ?? "Don't put them in a sequence",
        },
      }
    })
    setDecisionEditorId(nodeId)
    setMenuAnchor(null)
  }

  /** Called from the DD modal's Save click. Reconciles the canvas with
   *  the saved rules. Strategy depends on the upstream context:
   *
   *  - `product-is-purchased` (and default fallback) → single aggregated
   *    diamond. Title reflects rule count; the per-edge chips render
   *    each rule's summary on the diamond's outgoing connectors.
   *
   *  - `appointments` → fork-split when N ≥ 2. The original diamond is
   *    replaced by N new diamonds fanning out from the same upstream
   *    node. Each carries one rule, is titled `Rule N: <summary>`, and
   *    keeps one outgoing target. The dissolve pass skips diamonds with
   *    `presetRules` so each forked diamond stays put.
   */
  const reconcileDiamondAfterSave = (diamondId: string) => {
    const cfg = decisionConfigs[diamondId]
    const rules = cfg?.presetRules ?? []
    const diamond = nodes.find((n) => n.id === diamondId)
    if (!diamond) return
    pushUndo('Saved decision rules')

    // Pull the upstream-aware primary preset; per-rule resolution
    // happens inside titleFor (Option C — each rule may carry its own
    // entityKey).
    const upstreamCtx = upstreamPresetCtxFor(diamondId, nodes, edges)
    const slug = upstreamCtx?.slug ?? null
    const preset = derivePresetFor(
      slug,
      upstreamCtx?.nodeId ?? null,
      purchaseConfigs,
      appointmentConfigs,
      pipelineConfigs,
    )
    // Per-rule title (used by forked siblings). Entity name comes from
    // the rule's own preset (primary or contact, per Option C).
    const titleFor = (rule: DDPresetRuleSet, idx: number): string => {
      const rulePreset = presetForRule(rule, preset)
      const summary = rulePreset ? branchSummaryFor(rule, rulePreset) : null
      const ruleLabel = summary
        ? `Rule ${idx + 1}: ${summary}`
        : `Rule ${idx + 1}`
      return rulePreset ? `${rulePreset.entity} · ${ruleLabel}` : ruleLabel
    }

    // Split strategy is upstream-specific. Appointments and Pipeline-stage
    // moves fan out into N siblings; everything else aggregates into a
    // single diamond.
    const shouldFork =
      (slug === 'appointments' || slug === 'pipeline-stage-is-moved') &&
      rules.length >= 2

    if (shouldFork) {
      // Two paths to land here:
      //   (a) original is a single aggregated diamond → split it into N
      //       fresh sibling diamonds.
      //   (b) original is already a forked sibling → reconcile the whole
      //       fork group: add/remove siblings to match rules.length, update
      //       all surviving siblings' titles + presetRules + forkRuleIndex.
      const existingGroupId = cfg?.forkGroupId
      const groupId =
        existingGroupId ?? `fg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`

      // Existing siblings in this fork group, sorted by current y for a
      // stable mapping rule[i] → sibling[i].
      const existingSiblings = existingGroupId
        ? Object.entries(decisionConfigs)
            .filter(([, c]) => c.forkGroupId === existingGroupId)
            .map(([id]) => id)
            .map((id) => nodes.find((n) => n.id === id))
            .filter((n): n is BuilderNode => Boolean(n))
            .sort((a, b) => a.y - b.y)
        : []

      const stride = 140
      // First-split lays the column out centered around the original
      // diamond. On subsequent reconciles we don't reposition existing
      // siblings — preserving any manual moves the user made — and only
      // place freshly-added diamonds at the bottom of the existing column.
      const half = (rules.length - 1) / 2
      const baseColumnX = existingSiblings[0]?.x ?? diamond.x
      const lastExistingY =
        existingSiblings.length > 0
          ? Math.max(...existingSiblings.map((s) => s.y))
          : diamond.y

      const targetSiblings: BuilderNode[] = []
      const newNodes: BuilderNode[] = []
      const removedIds = new Set<string>()
      let appendedNewCount = 0
      for (let i = 0; i < rules.length; i++) {
        const existing = existingSiblings[i]
        if (existing) {
          // Reuse the user's manual position. Only the title may change
          // to reflect the new rule contents.
          targetSiblings.push({
            ...existing,
            title: titleFor(rules[i], i),
          })
          continue
        }
        // Fresh diamond — pick a position based on whether this is a
        // first-split or an additive reconcile.
        let nx: number
        let ny: number
        if (!existingGroupId) {
          // Whole column is new; center around the original diamond.y.
          nx = diamond.x
          ny = diamond.y + (i - half) * stride
        } else {
          // Append below the existing column.
          appendedNewCount += 1
          nx = baseColumnX
          ny = lastExistingY + appendedNewCount * stride
        }
        const fresh: BuilderNode = {
          id: `d-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 4)}`,
          type: 'decision' as const,
          title: titleFor(rules[i], i),
          x: nx,
          y: ny,
        }
        targetSiblings.push(fresh)
        newNodes.push(fresh)
      }
      // Existing siblings past rules.length are removed.
      for (let i = rules.length; i < existingSiblings.length; i++) {
        removedIds.add(existingSiblings[i].id)
      }
      // The diamond we just saved from collapses into the fork group too
      // when this is the first split — remove its standalone identity.
      if (!existingGroupId) {
        removedIds.add(diamondId)
      }

      // ----- Edge reconciliation -----
      // Keep all edges that don't touch a removed node or the diamond we
      // saved from (when first-splitting from an aggregated diamond).
      const survived = edges.filter(
        (e) =>
          !removedIds.has(e.from) &&
          !removedIds.has(e.to) &&
          (existingGroupId || (e.from !== diamondId && e.to !== diamondId)),
      )
      const migrated: BuilderEdge[] = []
      if (!existingGroupId) {
        // First-split: replicate the original diamond's incoming edges to
        // every target sibling so the upstream fans out.
        const incoming = edges.filter((e) => e.to === diamondId)
        const outgoing = edges.filter((e) => e.from === diamondId)
        incoming.forEach((e, i) => {
          targetSiblings.forEach((nd, j) => {
            migrated.push({
              id: `e-recon-in-${Date.now()}-${i}-${j}`,
              from: e.from,
              to: nd.id,
            })
          })
        })
        outgoing.forEach((e, i) => {
          if (i >= targetSiblings.length) return
          migrated.push({
            id: `e-recon-out-${Date.now()}-${i}`,
            from: targetSiblings[i].id,
            to: e.to,
          })
        })
      } else {
        // Subsequent reconcile: for any newly-added sibling, replicate
        // the existing fork's upstream incoming edges. The original
        // upstream is the same one already feeding existing siblings.
        if (newNodes.length > 0 && existingSiblings.length > 0) {
          const sampleIncoming = edges.filter(
            (e) => e.to === existingSiblings[0].id,
          )
          newNodes.forEach((nd, j) => {
            sampleIncoming.forEach((e, i) => {
              migrated.push({
                id: `e-recon-in-${Date.now()}-add-${i}-${j}`,
                from: e.from,
                to: nd.id,
              })
            })
          })
        }
      }

      // ----- Apply -----
      setNodes((prev) => {
        const kept = prev.filter((n) => !removedIds.has(n.id))
        const updatedExisting = kept.map((n) => {
          const repl = targetSiblings.find((t) => t.id === n.id)
          return repl ?? n
        })
        const idsAlreadyIn = new Set(updatedExisting.map((n) => n.id))
        const additions = newNodes.filter((n) => !idsAlreadyIn.has(n.id))
        return [...updatedExisting, ...additions]
      })
      setEdges([...survived, ...migrated])
      setDecisionConfigs((prev) => {
        const next: Record<string, DecisionDiamondConfig> = {}
        for (const [id, c] of Object.entries(prev)) {
          if (!removedIds.has(id) && c.forkGroupId !== existingGroupId) {
            // Keep configs that aren't being removed and aren't part of
            // this fork group (other diamonds with different groupIds).
            next[id] = c
          }
        }
        // Write each target sibling's config: full rule list + own index.
        targetSiblings.forEach((nd, idx) => {
          next[nd.id] = {
            groups: [],
            defaultRouting: '',
            presetRules: rules,
            forkGroupId: groupId,
            forkRuleIndex: idx,
          }
        })
        return next
      })
      announce(
        existingGroupId
          ? `Updated fork group to ${rules.length} rule${rules.length === 1 ? '' : 's'}`
          : `Forked into ${rules.length} decision diamonds`,
      )
      return
    }

    // ----- Aggregated path (default + product-is-purchased) -----
    // Title format: "<Entity> · <rule context>" when a preset is in
    // play. Single-rule uses that rule's own entity (Option C — may be
    // contact); multi-rule uses the primary upstream entity since the
    // canvas can't show every per-rule entity in one line.
    let newTitle = preset ? `${preset.entity} · Decision Diamond` : 'Decision Diamond'
    if (rules.length === 1) {
      const rulePreset = presetForRule(rules[0], preset)
      const summary = rulePreset ? branchSummaryFor(rules[0], rulePreset) : null
      const prefix = rulePreset ? `${rulePreset.entity} · ` : ''
      newTitle = summary
        ? `${prefix}Rule 1: ${summary}`
        : rulePreset
          ? `${rulePreset.entity} · Decision Diamond`
          : 'Decision Diamond'
    } else if (rules.length >= 2) {
      const entityPrefix = preset ? `${preset.entity} · ` : ''
      newTitle = `${entityPrefix}${rules.length} rules`
    }
    setNodes((prev) =>
      prev.map((n) => (n.id === diamondId ? { ...n, title: newTitle } : n)),
    )
    announce(`Saved ${rules.length} rule${rules.length === 1 ? '' : 's'}`)
  }

  /** Capture the current canvas state as a `CanvasSnapshot`. Pure
   *  read — does not mutate anything. */
  const snapshotCurrentState = (): CanvasSnapshot => ({
    nodes,
    edges,
    decisionConfigs,
    lockedPairs: [...lockedPairs],
    selectedNodeIds: new Set(selectedNodeIds),
    primarySelectedId,
  })

  /** Restore the canvas to a previously-captured snapshot. */
  const applySnapshot = (s: CanvasSnapshot) => {
    setNodes(s.nodes)
    setEdges(s.edges)
    setDecisionConfigs(s.decisionConfigs)
    setLockedPairs(s.lockedPairs)
    setSelectedNodeIds(s.selectedNodeIds)
    setPrimarySelectedId(s.primarySelectedId)
  }

  /** Push the current state onto the undo stack under `label`, and
   *  clear the redo stack. Call BEFORE any mutating action so the
   *  inverse is captured. Trims to `MAX_UNDO_HISTORY` from the
   *  front to bound memory. */
  const pushUndo = (label: string) => {
    const before = snapshotCurrentState()
    setUndoStack((stack) => {
      const next = [...stack, { label, snapshot: before }]
      return next.length > MAX_UNDO_HISTORY
        ? next.slice(-MAX_UNDO_HISTORY)
        : next
    })
    setRedoStack([])
  }

  /** Pop the top of the undo stack, apply that snapshot, and push
   *  the just-replaced state onto the redo stack so the user can
   *  step forward again. No-op when the undo stack is empty. */
  const undo = () => {
    if (undoStack.length === 0) return
    const head = undoStack[undoStack.length - 1]
    const current = snapshotCurrentState()
    applySnapshot(head.snapshot)
    setUndoStack((s) => s.slice(0, -1))
    setRedoStack((s) => [...s, { label: head.label, snapshot: current }])
    setToast(null)
    announce(`Undone: ${head.label.toLowerCase()}`)
  }

  /** Inverse of `undo` — pop the redo stack, apply, and push the
   *  replaced state back onto the undo stack. */
  const redo = () => {
    if (redoStack.length === 0) return
    const head = redoStack[redoStack.length - 1]
    const current = snapshotCurrentState()
    applySnapshot(head.snapshot)
    setRedoStack((s) => s.slice(0, -1))
    setUndoStack((s) => [...s, { label: head.label, snapshot: current }])
    setToast(null)
    announce(`Redone: ${head.label.toLowerCase()}`)
  }

  /** Bounding-box top-left of the current selection in canvas-space.
   *  Used as the saved anchor for a toast — particularly Delete,
   *  where the selection becomes empty post-action and the toolbar
   *  needs a frozen point of reference. */
  const computeSelectionAnchor = (): { x: number; y: number } => {
    const sel = nodes.filter((n) => selectedNodeIds.has(n.id))
    const left = sel.length > 0 ? Math.min(...sel.map((n) => n.x - NODE_W / 2)) : 0
    const top = sel.length > 0 ? Math.min(...sel.map((n) => n.y - NODE_H / 2)) : 0
    return { x: left, y: top }
  }

  /** Legacy helper retained for callers that still build a
   *  pre-action snapshot bundle. Pushes to the undo stack AND
   *  returns the snapshot + selection-bbox anchor for callers that
   *  use the anchor (e.g. positioning the post-action toast). */
  const snapshotForUndo = (
    label: string,
  ): {
    label: string
    snapshot: CanvasSnapshot
    anchor: { x: number; y: number }
  } => {
    pushUndo(label)
    return {
      label,
      snapshot: snapshotCurrentState(),
      anchor: computeSelectionAnchor(),
    }
  }

  /** Tidy-up: lay out the selection respecting sequence topology.
   *    - Each connected sub-graph occupies its own contiguous rows.
   *    - A LINEAR chain stays on one row, no matter how many nodes
   *      it has — never wrap into a second row just because the
   *      count exceeds a default column count.
   *    - A BRANCHING sub-graph (a node with 2+ outgoing edges in the
   *      selection, e.g. a decision diamond) fans its branches into
   *      separate rows — the first child shares the parent's row;
   *      every additional child claims a fresh row below.
   *    - Disconnected components are stacked vertically in their
   *      original avg-y order so the user can still spot each
   *      sequence in its same relative position.
   *    - Isolated nodes (no connections inside the selection)
   *      collapse into one trailing row.
   *    - The inline-add placeholder lives at the right of its host
   *      and the host is always at the end of its branch (leaf), so
   *      the placeholder naturally lands past the chain's end —
   *      no neighbour collision. */
  const tidyUpSelection = () => {
    if (selectedNodeIds.size < 2) return
    // Lift any locked partner into the working set so a half-selected
    // pair gets tidied as a unit (otherwise the partner stays put and
    // the lock badge ends up on a stretched edge).
    const workingIds = expandWithLockedPartners(selectedNodeIds)
    const sel = nodes.filter((n) => workingIds.has(n.id))
    if (sel.length < 2) return
    const undoState = snapshotForUndo('Tidied up')

    const centroidX = sel.reduce((s, n) => s + n.x, 0) / sel.length
    const centroidY = sel.reduce((s, n) => s + n.y, 0) / sel.length

    const selIds = new Set(sel.map((n) => n.id))
    const subEdges = edges.filter(
      (e) => selIds.has(e.from) && selIds.has(e.to),
    )

    // Connected components (undirected walk over selection edges).
    const adj = new Map<string, Set<string>>()
    for (const n of sel) adj.set(n.id, new Set())
    for (const e of subEdges) {
      adj.get(e.from)!.add(e.to)
      adj.get(e.to)!.add(e.from)
    }
    const seenComp = new Set<string>()
    const components: BuilderNode[][] = []
    for (const n of sel) {
      if (seenComp.has(n.id)) continue
      const comp: BuilderNode[] = []
      const stack = [n.id]
      while (stack.length > 0) {
        const id = stack.pop()!
        if (seenComp.has(id)) continue
        seenComp.add(id)
        const node = sel.find((x) => x.id === id)
        if (node) comp.push(node)
        for (const nb of adj.get(id) ?? []) {
          if (!seenComp.has(nb)) stack.push(nb)
        }
      }
      components.push(comp)
    }

    const byPos = (a: BuilderNode, b: BuilderNode) =>
      a.y - b.y || a.x - b.x

    // ----- Sequence "tails" -----
    // Some sequences have phantom extensions that occupy real space
    // on the canvas but aren't nodes — e.g. the inline-add
    // placeholder docks one cell to the right of the latest open
    // leaf. Treat any such extension as part of the host's
    // sequence: when laying out side-by-side, reserve one extra
    // column for the tail so the next sequence's first node lands
    // 120 px past the tail's right edge, not past the host's.
    //
    // This is also how we'll absorb any other "locked tail" types
    // the prototype gains later (e.g. confirm-email side-effect
    // glyphs) — register the host id here and the layout reserves
    // the column automatically.
    const workingIdSet = new Set(sel.map((n) => n.id))
    const placeholderHostId =
      latestIsOpenLeaf && latestNode && workingIdSet.has(latestNode.id)
        ? latestNode.id
        : null
    const tailColsByHostId = new Map<string, number>()
    if (placeholderHostId) tailColsByHostId.set(placeholderHostId, 1)
    // Locked pairs also reserve a tail column on the host whenever the
    // host is being tidied without its partner in the working set —
    // covers the (unusual) case where the user marquee-selected one
    // half but expansion couldn't find the partner. With expansion
    // working both halves are normally present, so this is belt-and-
    // suspenders for future locked-tail variants.
    for (const pair of lockedPairs) {
      const hostIn = workingIdSet.has(pair.hostId)
      const partnerIn = workingIdSet.has(pair.partnerId)
      if (hostIn && !partnerIn) {
        tailColsByHostId.set(
          pair.hostId,
          (tailColsByHostId.get(pair.hostId) ?? 0) + 1,
        )
      }
    }

    // Disconnected sequences are arranged LEFT-TO-RIGHT in their
    // pre-tidy x order — each component keeps its own contiguous
    // column range and components don't share columns. Within a
    // sequence, connection order is preserved (linear → one row,
    // branching → tree-aware rows).
    const sortedComponents = [...components].sort((a, b) => {
      const ax = a.reduce((s, n) => s + n.x, 0) / a.length
      const bx = b.reduce((s, n) => s + n.x, 0) / b.length
      return ax - bx || a[0].y - b[0].y
    })

    // ----- External-anchor detection -----
    // When a component in the selection has an EXTERNAL upstream
    // edge (an edge where the source is NOT in the selection but
    // the target IS), the user is tidying a sub-branch whose
    // natural alignment is with its upstream parent — even though
    // that parent isn't part of the working set.
    //
    // Example (the user's screenshot): selecting just
    //   {Deal · Decision Diamond, Notify sales rep}
    // when both descend from `Create a deal` should rearrange them
    // onto `Create a deal`'s row, not collapse them onto the
    // selection's own centroid line.
    //
    // Strategy: per component, find the leftmost external upstream
    // node. Snap the component's ENTRY node (the target of that
    // external edge) to `(anchor.x + titleAwareStride, anchor.y)`,
    // then translate every other node in the component by the same
    // delta so the chain's internal layout (locked pairs, branch
    // shape, relative spacing) is preserved.
    //
    // Activation rule: only fire when EVERY component in the
    // selection has at least one external anchor. Mixed cases
    // (some anchored, some not) fall through to grid-snap or
    // topology so the algorithm doesn't ship partial layouts.
    const findExternalAnchor = (comp: BuilderNode[]) => {
      const compIds = new Set(comp.map((n) => n.id))
      // Preference 1 — UPSTREAM external. The leftmost external
      // source becomes the anchor so the chain extends to the
      // right in reading order. The chain's entry node lands one
      // stride past the anchor on the anchor's row.
      const externalIncoming = edges.filter(
        (e) => compIds.has(e.to) && !workingIds.has(e.from),
      )
      if (externalIncoming.length > 0) {
        let bestEdge = externalIncoming[0]
        let bestAnchor = nodes.find((n) => n.id === bestEdge.from) ?? null
        for (const e of externalIncoming) {
          const a = nodes.find((n) => n.id === e.from)
          if (a && (!bestAnchor || a.x < bestAnchor.x)) {
            bestAnchor = a
            bestEdge = e
          }
        }
        if (bestAnchor) {
          const entry = comp.find((n) => n.id === bestEdge.to)
          if (entry) return { anchor: bestAnchor, entry }
        }
      }
      // Preference 2 — DOWNSTREAM external. Triggered when the
      // selection has no upstream parent (e.g. `{trigger, DD}` —
      // the trigger is the root, the DD has no parent in the
      // selection). The chain still has external context via its
      // children. We synthesise a virtual upstream anchor whose
      // ROW = MEDIAN of all downstream children's rows (so the
      // chain lands where its branches fan out symmetrically),
      // and whose X = the leftmost downstream's x - one stride
      // (so the chain extends left from its first downstream).
      //
      // The entry of the component (in upstream-mode terms) is the
      // ROOT of the chain — the node with no in-degree among the
      // sub-edges. That's the node whose row we ultimately align
      // with the virtual anchor's row.
      const externalOutgoing = edges.filter(
        (e) => compIds.has(e.from) && !workingIds.has(e.to),
      )
      if (externalOutgoing.length > 0) {
        const downstreamNodes = externalOutgoing
          .map((e) => nodes.find((n) => n.id === e.to))
          .filter((n): n is BuilderNode => Boolean(n))
        if (downstreamNodes.length === 0) return null
        // Median Y across all downstream — minimises total
        // vertical fork distance, putting the chain in the row
        // where its branches fan out symmetrically up + down.
        const sortedYs = downstreamNodes.map((n) => n.y).sort((a, b) => a - b)
        const medianY =
          sortedYs.length % 2 === 0
            ? (sortedYs[sortedYs.length / 2 - 1] +
                sortedYs[sortedYs.length / 2]) /
              2
            : sortedYs[(sortedYs.length - 1) / 2]
        // Leftmost downstream's x — the chain ends one stride to
        // its left, regardless of which downstream lands on the
        // median row.
        const leftmostDownstream = [...downstreamNodes].sort(
          (a, b) => a.x - b.x,
        )[0]
        // Find the chain's root (in-degree 0 across compEdges).
        const compEdgesIn = new Map<string, number>()
        for (const n of comp) compEdgesIn.set(n.id, 0)
        for (const e of subEdges) {
          if (compIds.has(e.from) && compIds.has(e.to)) {
            compEdgesIn.set(e.to, (compEdgesIn.get(e.to) ?? 0) + 1)
          }
        }
        const root =
          comp.find((n) => (compEdgesIn.get(n.id) ?? 0) === 0) ?? comp[0]
        // Virtual upstream anchor: placed such that the chain's
        // EXIT lands one stride left of the leftmost downstream,
        // and the chain sits on the median row. For a simple
        // 2-node chain like {n1, d1}, root === entry and the
        // chain places root → ... → exit. Approximation: place
        // root at (leftmost.x - chainLength*stride, medianY).
        // We model this as a virtual anchor at:
        //   x: root.x (lets entry land at anchor.x + stride;
        //              but we override below)
        //   y: medianY
        // The actual placement loop computes
        //   entryX = anchor.x + titleAwareStride(anchor.title, entry.title, PH_GAP)
        // so to land entry at leftmost.x - chainSpan, we need
        // anchor.x = (target entry x) - titleAwareStride(...).
        // For simplicity, use leftmostDownstream as a stand-in
        // anchor that sits one stride to the right of where root
        // should be — then the forward walk naturally fans
        // children further right. We negate that by placing the
        // virtual anchor LEFT of where we want root:
        const virtualAnchor: BuilderNode = {
          ...leftmostDownstream,
          // The forward walk uses the same forward-stride logic
          // as upstream mode. We want ROOT to land somewhere
          // sensible. Place the virtual anchor far enough to the
          // left that root + chain still fits before leftmost
          // downstream. Use 2× the typical chain stride per
          // component-node as a generous estimate.
          x:
            leftmostDownstream.x -
            (comp.length + 1) * (NODE_W + PH_GAP),
          y: medianY,
          // Empty title so titleAwareStride uses NODE_W/2 as the
          // anchor half-width (the virtual anchor isn't a real
          // node, just a positional reference).
          title: '',
        }
        return { anchor: virtualAnchor, entry: root }
      }
      return null
    }
    const anchorsForAll = sortedComponents.map((comp) => findExternalAnchor(comp))
    const allComponentsHaveAnchor =
      anchorsForAll.length > 0 && anchorsForAll.every((a) => a !== null)

    // ----- Grid-snap detection (per-node) -----
    // If the user's selected nodes are already laid out in an M×N
    // grid (multiple distinct row bands AND multiple distinct col
    // bands), tidy should PRESERVE that arrangement and just nudge
    // each node to its detected cell — instead of collapsing
    // everything into one row via the column-packing topology
    // path below.
    //
    // Per-NODE clustering (not per-component) so the detection still
    // fires when the selection happens to form one big connected
    // component — e.g. multiple branches sharing an upstream
    // Decision Diamond, where the component centroid would land at
    // an arbitrary middle position and miss the grid signal. By
    // clustering raw node coordinates, every visible row and column
    // shows up regardless of edge topology.
    //
    // Heuristic:
    //   1. Cluster Y positions of selected nodes into row bands
    //      (tolerance = (NODE_H + PH_GAP)/2 = 105 px).
    //   2. Cluster X positions into col bands (same tolerance).
    //   3. If ≥ 2 row bands AND ≥ 2 col bands, the user already has
    //      a grid — snap each node to its (rowBand.center,
    //      colBand.center). Single-row / single-col layouts fall
    //      through to topology.
    //
    // Locked-pair width is preserved automatically: the host
    // (x=720) and partner (x=720+LOCKED_PAIR_GAP+NODE_W=1050) sit
    // 330 px apart — well past the 105 px tolerance — so they
    // cluster into separate col bands and stay separated after
    // the snap.
    const clusterPositions = (positions: number[], tol: number) => {
      const sorted = [...positions].sort((a, b) => a - b)
      const bands: Array<{ center: number; members: number[] }> = []
      for (const v of sorted) {
        const band = bands.find((b) => Math.abs(v - b.center) <= tol)
        if (band) {
          band.members.push(v)
          band.center =
            band.members.reduce((s, x) => s + x, 0) / band.members.length
        } else {
          bands.push({ center: v, members: [v] })
        }
      }
      return bands.sort((a, b) => a.center - b.center)
    }
    const rowBands = clusterPositions(
      sel.map((n) => n.y),
      (NODE_H + PH_GAP) / 2,
    )
    const colBands = clusterPositions(
      sel.map((n) => n.x),
      (NODE_W + PH_GAP) / 2,
    )
    const findBand = (
      bands: Array<{ center: number; members: number[] }>,
      v: number,
    ) => {
      // Closest band (handles the case where the original value sat
      // just outside the tolerance of any band, e.g. a wonky drag).
      let best = bands[0]
      let bestDist = Math.abs(v - best.center)
      for (let i = 1; i < bands.length; i++) {
        const d = Math.abs(v - bands[i].center)
        if (d < bestDist) {
          bestDist = d
          best = bands[i]
        }
      }
      return best
    }
    // Spine-aware tidy-up is gated to the isolated tidy-up demo build
    // (VITE_FORCED_AUTOMATION_ID=adv2) so the combined site and the
    // manual-demo build keep the existing behaviour. When ON, tidy-up
    // pulls the trunk + branch point + main-lane subtree onto one Y
    // and splays other branches symmetrically around that spine.
    const SPINE_AWARE = FORCED_ID === 'adv2'

    // A "branching tree" component has at least one node with ≥2
    // outgoing edges INSIDE the selection. Grid-snap snaps each node
    // to its existing row band, which strands the trunk on its own
    // row instead of aligning with the branch point's spine. When
    // SPINE_AWARE and the selection contains a branching tree, skip
    // grid-snap and let the topology path lay out the spine.
    const selectionHasBranchingTree = (() => {
      if (!SPINE_AWARE) return false
      const outDegInSel = new Map<string, number>()
      for (const n of sel) outDegInSel.set(n.id, 0)
      for (const e of subEdges) {
        outDegInSel.set(e.from, (outDegInSel.get(e.from) ?? 0) + 1)
      }
      return Array.from(outDegInSel.values()).some((d) => d >= 2)
    })()

    const isGridLike =
      sel.length >= 2 &&
      rowBands.length >= 2 &&
      colBands.length >= 2 &&
      !selectionHasBranchingTree

    let moved: Map<string, { x: number; y: number }>
    let totalRows: number

    if (allComponentsHaveAnchor) {
      // External-anchor path. Each anchored component is laid out
      // fresh starting at the anchor's row — a forward tree-walk
      // from the entry node, placing each child at (parent.x +
      // titleAwareStride, parent.y) so the chain STRAIGHTENS onto
      // the anchor's row instead of preserving whatever wonky
      // internal Y-offsets the user's drag left behind.
      //
      // Components that share an anchor are treated as SIBLING
      // branches of that anchor: the first sibling on the anchor's
      // own row, each subsequent sibling parked on a fresh row
      // below the previous sibling's deepest row — same tree-walk
      // rule the topology path uses for forks inside a single
      // component.
      //
      // **Whole-canvas occupancy check:** before committing each
      // sibling's row, we verify that the target cell isn't
      // already occupied by an UNSELECTED node. If it is, the
      // sibling falls through a priority list of candidate rows —
      // neighbour rows first (rows where any external upstream /
      // downstream of the component lives), then the rest of the
      // existing row bands sorted by distance, then a fresh row
      // below the bottom. This is what the user described as
      // "lay grids/cells over it to seek the best ideal
      // positions" — every placement is checked against the rest
      // of the canvas so a sibling never lands on top of an
      // existing sequence.
      //
      // Locked-pair edges use LOCKED_PAIR_GAP for the wider
      // host → partner spacing; everything else uses PH_GAP.
      moved = new Map<string, { x: number; y: number }>()
      const rowsTouched = new Set<number>()

      // Build the global cell-occupancy map from UNSELECTED nodes.
      // Cells are keyed by their (col-band-center, row-band-center)
      // so two close-enough positions in either axis collapse onto
      // the same cell — matching how the user perceives "the same
      // row / the same column".
      const allRowBandsAll = clusterPositions(
        nodes.map((n) => n.y),
        (NODE_H + PH_GAP) / 2,
      )
      const allColBandsAll = clusterPositions(
        nodes.map((n) => n.x),
        (NODE_W + PH_GAP) / 2,
      )
      const bandCenterFor = (
        bands: Array<{ center: number; members: number[] }>,
        v: number,
      ) => findBand(bands, v).center
      const cellKey = (x: number, y: number) =>
        `${bandCenterFor(allColBandsAll, x)}|${bandCenterFor(allRowBandsAll, y)}`
      const occupiedByUnselected = new Set<string>()
      for (const n of nodes) {
        if (workingIds.has(n.id)) continue
        occupiedByUnselected.add(cellKey(n.x, n.y))
      }
      const isCellFree = (x: number, y: number) =>
        !occupiedByUnselected.has(cellKey(x, y))

      // Group sortedComponents by their anchor's id. Use a map
      // keyed by anchor.id → array of { componentIdx, entry }.
      const groupsByAnchorId = new Map<
        string,
        { anchor: BuilderNode; siblings: Array<{ comp: BuilderNode[]; entry: BuilderNode }> }
      >()
      sortedComponents.forEach((comp, idx) => {
        const a = anchorsForAll[idx]
        if (!a) return
        const existing = groupsByAnchorId.get(a.anchor.id)
        if (existing) {
          existing.siblings.push({ comp, entry: a.entry })
        } else {
          groupsByAnchorId.set(a.anchor.id, {
            anchor: a.anchor,
            siblings: [{ comp, entry: a.entry }],
          })
        }
      })

      for (const { anchor, siblings } of groupsByAnchorId.values()) {
        // Sort siblings deterministically — by original Y of entry
        // (top-first), then by original X. This puts whatever was
        // visually highest on the anchor's row, and pushes the rest
        // down in their existing relative order.
        siblings.sort(
          (a, b) => a.entry.y - b.entry.y || a.entry.x - b.entry.x,
        )

        // Compute a SHARED `entryX` for every sibling in this group
        // so they stack in a single vertical column. Without this,
        // each sibling would compute its own `entryX` from its own
        // title — and any width difference (e.g. "Notify sales rep"
        // vs "Apply a note") would offset the siblings by a few
        // pixels, breaking the visual column. We use the maximum
        // stride across all siblings so the widest-titled entry
        // still has room past the anchor's title.
        const sharedEntryX =
          anchor.x +
          Math.max(
            ...siblings.map(({ entry }) =>
              titleAwareStride(anchor.title, entry.title, PH_GAP),
            ),
          )

        // Track the deepest row used so far across all siblings of
        // this anchor group. Each new sibling starts at
        // `maxYUsed + NODE_H + PH_GAP` (the first sibling shares
        // the anchor's row).
        let maxYUsed = anchor.y

        siblings.forEach(({ comp, entry }, siblingIdx) => {
          const compIds = new Set(comp.map((n) => n.id))
          const compEdges = edges.filter(
            (e) => compIds.has(e.from) && compIds.has(e.to),
          )
          const childrenOf = (id: string): BuilderNode[] =>
            compEdges
              .filter((e) => e.from === id)
              .map((e) => comp.find((x) => x.id === e.to))
              .filter((x): x is BuilderNode => Boolean(x))
          const isLockedTransition = (
            parent: BuilderNode,
            kid: BuilderNode,
          ) =>
            lockedPairs.some(
              (p) =>
                (p.hostId === parent.id && p.partnerId === kid.id) ||
                (p.hostId === kid.id && p.partnerId === parent.id),
            )

          // Compute candidate Y values for this sibling's entry,
          // in priority order:
          //   1. The "natural" preferred row (anchor's row for
          //      sibling 0, sibling-fan row below for the rest).
          //   2. Rows where the component's EXTERNAL neighbours
          //      live (any unselected node connected to a node in
          //      the component via an edge in either direction).
          //      These rows make the chain visually straight from
          //      neighbour → component → neighbour.
          //   3. Every other existing row band, sorted by distance
          //      to the natural preferred row.
          //   4. Fresh rows below the bottom-most existing band,
          //      stepped by NODE_H + PH_GAP, as the final fallback.
          // The first candidate whose `(entryX, y)` cell is free
          // (no UNSELECTED node already there) wins.
          //
          // All siblings of this anchor group share `entryX` so
          // their tiles stack in one clean vertical column even
          // when their titles have different widths.
          const entryX = sharedEntryX
          const preferredY =
            siblingIdx === 0 ? anchor.y : maxYUsed + NODE_H + PH_GAP
          // Neighbour rows for the candidate-Y priority list come
          // ONLY from edges adjacent to the entry node — its direct
          // upstream (always the anchor, by definition) plus any
          // direct downstream that hops straight from the entry to
          // an unselected node.
          //
          // Edges deep inside the component (e.g. `d2 → n9` when
          // d2 is in the selection but n9 isn't) used to register
          // n9's y as a "neighbour row," which then leapfrogged
          // the actual existing-row-band candidates and pulled the
          // chain onto n9's row. Restricting to entry-adjacent
          // neighbours means only the rows that ENTRY itself sits
          // between (its upstream parent's row, and any direct
          // downstream's row) get the priority bump.
          const externalNeighbours = edges
            .filter(
              (e) =>
                (e.from === entry.id && !workingIds.has(e.to)) ||
                (e.to === entry.id && !workingIds.has(e.from)),
            )
            .map((e) => {
              const otherId = e.from === entry.id ? e.to : e.from
              return nodes.find((n) => n.id === otherId)
            })
            .filter((n): n is BuilderNode => Boolean(n))
          const neighbourYs = Array.from(
            new Set(externalNeighbours.map((n) => n.y)),
          )
          const otherBandYs = allRowBandsAll
            .map((b) => b.center)
            .filter(
              (y) => y !== preferredY && !neighbourYs.includes(y),
            )
            .sort(
              (a, b) =>
                Math.abs(a - preferredY) - Math.abs(b - preferredY),
            )
          const bottomY =
            allRowBandsAll.length > 0
              ? allRowBandsAll[allRowBandsAll.length - 1].center
              : preferredY
          const fallbackYs: number[] = []
          for (let k = 1; k <= 5; k++) {
            fallbackYs.push(bottomY + k * (NODE_H + PH_GAP))
          }
          const candidates: number[] = []
          const pushUnique = (y: number) => {
            if (!candidates.includes(y)) candidates.push(y)
          }
          pushUnique(preferredY)
          for (const y of neighbourYs) pushUnique(y)
          for (const y of otherBandYs) pushUnique(y)
          for (const y of fallbackYs) pushUnique(y)

          let entryY = preferredY
          for (const y of candidates) {
            if (isCellFree(entryX, y)) {
              entryY = y
              break
            }
          }

          moved.set(entry.id, { x: entryX, y: entryY })
          // Mark this cell occupied so subsequent siblings don't
          // pick the same row.
          occupiedByUnselected.add(cellKey(entryX, entryY))
          rowsTouched.add(Math.round(entryY))
          if (entryY > maxYUsed) maxYUsed = entryY

          // Forward DFS within this sibling component — first child
          // shares its parent's row, additional children get fresh
          // rows below the running maxYUsed. Every placed cell is
          // also marked occupied so the next sibling's row-finder
          // sees it and skips.
          const visit = (node: BuilderNode) => {
            const pos = moved.get(node.id)
            if (!pos) return
            const kids = childrenOf(node.id)
            kids.forEach((kid, i) => {
              if (moved.has(kid.id)) return // cycle / re-entrant
              const gap = isLockedTransition(node, kid)
                ? LOCKED_PAIR_GAP
                : PH_GAP
              const kidX =
                pos.x + titleAwareStride(node.title, kid.title, gap)
              const kidY =
                i === 0 ? pos.y : maxYUsed + NODE_H + PH_GAP
              moved.set(kid.id, { x: kidX, y: kidY })
              occupiedByUnselected.add(cellKey(kidX, kidY))
              rowsTouched.add(Math.round(kidY))
              if (kidY > maxYUsed) maxYUsed = kidY
              visit(kid)
            })
          }
          visit(entry)

          // Any nodes the forward walk didn't reach (cycles,
          // disconnected fragments inside the component) get parked
          // on a fresh row at the entry's x so they remain visible
          // and aligned-ish with the rest of the component.
          for (const n of comp) {
            if (!moved.has(n.id)) {
              maxYUsed += NODE_H + PH_GAP
              moved.set(n.id, { x: entryX, y: maxYUsed })
              rowsTouched.add(Math.round(maxYUsed))
            }
          }
        })
      }
      totalRows = rowsTouched.size
    } else if (isGridLike) {
      // Snap each node to its (rowBand, colBand) intersection. The
      // band centers (averages of the nodes in that band) become the
      // canonical row Y / col X — so wonky placements normalize to
      // the band's center while the overall grid stays where the
      // user put it. Locked-pair partners and chain neighbours
      // stay separated because their original spacing puts them
      // into different bands.
      moved = new Map<string, { x: number; y: number }>()
      for (const n of sel) {
        const rowBand = findBand(rowBands, n.y)
        const colBand = findBand(colBands, n.x)
        moved.set(n.id, { x: colBand.center, y: rowBand.center })
      }
      totalRows = rowBands.length
    } else {

    // (row, col) placement. `nextCol` is the first free column —
    // each component starts at this column, then nextCol jumps past
    // the component's columns + a 1-column gap. Rows share row 0 as
    // the top so all sequences have a common baseline; branching
    // components extend downward into row 1, 2, …
    const placement = new Map<string, { row: number; col: number }>()
    const placedIds = new Set<string>()
    let nextCol = 0

    /** Place a single connected component starting at `nextCol`.
     *    - Linear chain → one row of N cols, chain order.
     *    - Branching → tree-walk, first child reuses parent's row;
     *      additional children claim fresh rows below.
     *  Columns are stored absolute (relative offset + nextCol).
     *  After placement `nextCol` advances past this component's
     *  rightmost column + a 1-column gap. */
    const placeComponent = (comp: BuilderNode[]) => {
      if (comp.length === 0) return
      const compIds = new Set(comp.map((n) => n.id))
      const compEdges = subEdges.filter(
        (e) => compIds.has(e.from) && compIds.has(e.to),
      )
      const inDeg = new Map<string, number>()
      const outDeg = new Map<string, number>()
      for (const n of comp) {
        inDeg.set(n.id, 0)
        outDeg.set(n.id, 0)
      }
      for (const e of compEdges) {
        inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1)
        outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1)
      }
      const isLinear =
        Array.from(inDeg.values()).every((d) => d <= 1) &&
        Array.from(outDeg.values()).every((d) => d <= 1)
      const roots = comp
        .filter((n) => (inDeg.get(n.id) ?? 0) === 0)
        .sort(byPos)
      // Memoized longest-downstream-path length per node id. The
      // "spine" child of a branch point is the one with the longest
      // subtree — the layout extends that spine through the parent's
      // row, then splays other children symmetrically above/below.
      const subtreeLenCache = new Map<string, number>()
      const subtreeLen = (id: string, stack: Set<string>): number => {
        if (subtreeLenCache.has(id)) return subtreeLenCache.get(id)!
        if (stack.has(id)) return 0 // cycle safety
        stack.add(id)
        let best = 0
        for (const e of compEdges) {
          if (e.from !== id) continue
          const child = comp.find((x) => x.id === e.to)
          if (!child) continue
          const d = subtreeLen(child.id, stack)
          if (d > best) best = d
        }
        stack.delete(id)
        const result = 1 + best
        subtreeLenCache.set(id, result)
        return result
      }
      const childrenOf = (id: string): BuilderNode[] => {
        const kids = compEdges
          .filter((e) => e.from === id)
          .map((e) => comp.find((x) => x.id === e.to))
          .filter((x): x is BuilderNode => Boolean(x))
        if (SPINE_AWARE) {
          // Longest subtree first — that child stays on the parent's
          // row (the spine). Ties fall back to original visual order.
          return kids.sort((a, b) => {
            const la = subtreeLen(a.id, new Set())
            const lb = subtreeLen(b.id, new Set())
            if (lb !== la) return lb - la
            return byPos(a, b)
          })
        }
        return kids.sort(byPos)
      }

      let maxColRel = 0

      if (isLinear) {
        const ordered: BuilderNode[] = []
        const seen = new Set<string>()
        const visit = (n: BuilderNode) => {
          if (seen.has(n.id)) return
          seen.add(n.id)
          ordered.push(n)
          for (const c of childrenOf(n.id)) visit(c)
        }
        for (const r of roots) visit(r)
        for (const n of [...comp].sort(byPos))
          if (!seen.has(n.id)) ordered.push(n)
        ordered.forEach((n, i) => {
          placement.set(n.id, { row: 0, col: nextCol + i })
          placedIds.add(n.id)
        })
        maxColRel = ordered.length - 1
      } else {
        // Branching — tree walk.
        //
        // Non-SPINE_AWARE: first child shares parent's row, additional
        // children stack below (rows 1, 2, 3...). All branches end up
        // below the spine.
        //
        // SPINE_AWARE: the child with the longest subtree shares the
        // parent's row — that's the spine. Remaining children partition
        // by their ORIGINAL y relative to the parent's original y:
        // originally-above kids go above the spine, originally-below
        // kids go below. Closer-to-parent kids land in the inner row;
        // farther kids step outward. After all components place, a
        // global pass shifts negative rows so the minimum lands at 0.
        let maxRowUsed = 0
        let minRowUsed = 0
        const rowsTaken = new Set<number>()
        const claimRow = (preferred: number, direction: 1 | -1): number => {
          let row = preferred
          while (rowsTaken.has(row)) row += direction
          return row
        }
        const visit = (n: BuilderNode, row: number, colRel: number) => {
          if (placedIds.has(n.id)) return
          placedIds.add(n.id)
          placement.set(n.id, { row, col: nextCol + colRel })
          rowsTaken.add(row)
          if (row > maxRowUsed) maxRowUsed = row
          if (row < minRowUsed) minRowUsed = row
          if (colRel > maxColRel) maxColRel = colRel
          const kids = childrenOf(n.id)
          if (SPINE_AWARE && kids.length > 0) {
            // kids[0] is the longest-subtree child → spine.
            const spineKid = kids[0]
            const others = kids.slice(1)
            // Partition by original Y vs parent's original Y. Ties
            // (same original y as parent, rare) default to "below"
            // so the spine continues straight and unusual siblings
            // park out of the way.
            const aboveOriginal = others
              .filter((k) => k.y < n.y)
              .sort((a, b) => b.y - a.y) // closest to parent first
            const belowOriginal = others
              .filter((k) => k.y >= n.y)
              .sort((a, b) => a.y - b.y)
            visit(spineKid, row, colRel + 1)
            aboveOriginal.forEach((k, i) => {
              const preferred = row - (i + 1)
              const childRow = claimRow(preferred, -1)
              visit(k, childRow, colRel + 1)
            })
            belowOriginal.forEach((k, i) => {
              const preferred = row + (i + 1)
              const childRow = claimRow(preferred, 1)
              visit(k, childRow, colRel + 1)
            })
            return
          }
          for (let i = 0; i < kids.length; i++) {
            const c = kids[i]
            const childRow = i === 0 ? row : maxRowUsed + 1
            visit(c, childRow, colRel + 1)
          }
        }
        let rootIdx = 0
        for (const r of roots) {
          if (placedIds.has(r.id)) continue
          const startRow = rootIdx === 0 ? 0 : maxRowUsed + 1
          visit(r, startRow, 0)
          rootIdx += 1
        }
        // Cycle remnants — one per fresh row at col 0.
        for (const n of [...comp].sort(byPos)) {
          if (placedIds.has(n.id)) continue
          placement.set(n.id, { row: maxRowUsed + 1, col: nextCol })
          placedIds.add(n.id)
          maxRowUsed += 1
        }
      }
      // Compute any tail extension this component carries (sum of
      // `tailColsByHostId` entries for nodes inside the component).
      // Each entry adds N extra columns to the right of the host so
      // tails (placeholder, locked side-effects) don't bleed into
      // the next sequence's column range.
      let tailCols = 0
      for (const n of comp) {
        const t = tailColsByHostId.get(n.id)
        if (t) tailCols += t
      }
      // Advance nextCol past this component + its tail by exactly
      // ONE stride past the rightmost occupied cell, so the
      // edge-to-edge gap to the next sequence matches the within-
      // sequence spacing (PH_GAP = 120). center-to-center =
      // strideX = NODE_W + PH_GAP = 210; edge-to-edge = 120.
      nextCol += maxColRel + tailCols + 1
    }

    // Place every component (multi-node AND isolated) side-by-side
    // in original-x order. Isolated nodes are size-1 components, so
    // they slot in naturally between or alongside chains based on
    // their original x position.
    for (const comp of sortedComponents) placeComponent(comp)

    // Row normalization — SPINE_AWARE branching may produce negative
    // rows (siblings parked above the spine). Shift everything by
    // -minRow so the topmost row lands at 0, otherwise downstream
    // sizing math (`maxRow`, `rows = maxRow + 1`, blockH) underestimates
    // the block height and the layout drifts off-canvas.
    if (SPINE_AWARE) {
      let globalMinRow = 0
      for (const p of placement.values()) {
        if (p.row < globalMinRow) globalMinRow = p.row
      }
      if (globalMinRow < 0) {
        for (const [id, p] of placement) {
          placement.set(id, { row: p.row - globalMinRow, col: p.col })
        }
      }
    }

    // Per-column max-width packing — instead of a fixed stride, each
    // column reserves the widest visual footprint of any node in it
    // (the title is much wider than NODE_W for long names like
    // "Email Confirmation Request", so a fixed stride lets adjacent
    // sequences' titles overlap). Columns are spaced edge-to-edge
    // with PH_GAP whitespace, OR with LOCKED_PAIR_GAP when the
    // transition crosses a locked-pair boundary (host → partner).
    //
    // Vertical packing still uses the simple strideY since titles
    // are clamped vertically (max 5 lines) and rows are rare in
    // practice. If row collisions become a real problem this is the
    // hook to extend with per-row height measurement.
    const strideY = NODE_H + PH_GAP
    const placeholderVirtualCol =
      placeholderHostId && placement.get(placeholderHostId)
        ? placement.get(placeholderHostId)!.col + 1
        : -1
    const maxCol = Math.max(
      0,
      placeholderVirtualCol,
      ...Array.from(placement.values()).map((p) => p.col),
    )
    const maxRow = Math.max(
      0,
      ...Array.from(placement.values()).map((p) => p.row),
    )
    const rows = maxRow + 1

    // ----- Column widths -----
    // For each column, find the widest visual footprint among the
    // nodes parked in it. Nodes that aren't being tidied (not in
    // `sel`) don't enter placement so they don't contribute.
    const colWidth: number[] = new Array(maxCol + 1).fill(NODE_W)
    const colHasNodeIds: Array<Set<string>> = new Array(maxCol + 1)
      .fill(null)
      .map(() => new Set<string>())
    for (const [id, p] of placement) {
      const node = nodes.find((n) => n.id === id)
      if (!node) continue
      const w = measureTitleVisualWidth(node.title)
      if (w > colWidth[p.col]) colWidth[p.col] = w
      colHasNodeIds[p.col].add(id)
    }
    // The inline-add placeholder's virtual column also reserves a
    // tile-sized slot so the next sequence's first column doesn't
    // crowd into the placeholder's drop zone.
    if (placeholderVirtualCol >= 0 && placeholderVirtualCol <= maxCol) {
      colWidth[placeholderVirtualCol] = Math.max(
        colWidth[placeholderVirtualCol],
        PH_W,
      )
    }

    // ----- Column centers -----
    // First column is centered at colWidth[0]/2 from the block's
    // top-left. Each subsequent column adds half the previous
    // column's width + gap + half the current column's width.
    // Gap defaults to PH_GAP, but uses LOCKED_PAIR_GAP whenever the
    // transition from col c-1 → c crosses a locked pair (host on
    // c-1 and partner on c, or vice versa).
    const colsContainLockedPairTransition = (cPrev: number, cNow: number) => {
      for (const pair of lockedPairs) {
        const idsPrev = colHasNodeIds[cPrev] ?? new Set<string>()
        const idsNow = colHasNodeIds[cNow] ?? new Set<string>()
        const hostOnPrev = idsPrev.has(pair.hostId)
        const partnerOnNow = idsNow.has(pair.partnerId)
        const partnerOnPrev = idsPrev.has(pair.partnerId)
        const hostOnNow = idsNow.has(pair.hostId)
        if ((hostOnPrev && partnerOnNow) || (partnerOnPrev && hostOnNow)) {
          return true
        }
      }
      return false
    }

    const colCenterRelX: number[] = []
    colCenterRelX[0] = colWidth[0] / 2
    for (let c = 1; c <= maxCol; c++) {
      const gap = colsContainLockedPairTransition(c - 1, c)
        ? LOCKED_PAIR_GAP
        : PH_GAP
      colCenterRelX[c] =
        colCenterRelX[c - 1] + colWidth[c - 1] / 2 + gap + colWidth[c] / 2
    }
    const blockW = colCenterRelX[maxCol] + colWidth[maxCol] / 2
    const blockH = (rows - 1) * strideY
    const topLeftX = centroidX - blockW / 2
    const topLeftY = centroidY - blockH / 2

      moved = new Map<string, { x: number; y: number }>()
      for (const [id, p] of placement) {
        moved.set(id, {
          x: topLeftX + colCenterRelX[p.col],
          y: topLeftY + p.row * strideY,
        })
      }
      totalRows = rows
    }

    // ----- Global grid snap -----
    // Whichever placement path ran (external-anchor / grid-snap /
    // topology), the final block is coherent internally but its
    // top-left corner may sit at an arbitrary offset — most obviously
    // when the user drags a fresh sequence in from the sidebar and
    // drops it at some off-grid pixel. Shift the WHOLE moved-set by
    // (dx, dy) so its top-leftmost tile snaps to the nearest multiple
    // of the canonical grid pitch (NODE_W + PH_GAP = 210). This
    // preserves every internal offset (column widths, locked-pair
    // gaps, spine alignment) while making the block globally
    // grid-aligned with everything else on the canvas.
    if (moved.size > 0) {
      const GRID_X = NODE_W + PH_GAP
      const GRID_Y = NODE_H + PH_GAP
      let minX = Infinity
      let minY = Infinity
      for (const p of moved.values()) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
      }
      const dx = Math.round(minX / GRID_X) * GRID_X - minX
      const dy = Math.round(minY / GRID_Y) * GRID_Y - minY
      if (dx !== 0 || dy !== 0) {
        for (const [id, p] of moved) {
          moved.set(id, { x: p.x + dx, y: p.y + dy })
        }
      }
    }

    // ----- Global overlap avoidance pass -----
    // Every preceding path (anchor / grid-snap / topology) places
    // selected nodes based on its own logic. A wide title or a
    // title-aware stride upgrade can still leave a moved node's
    // VISUAL bbox (tile + extended label) overlapping the bbox of
    // an UNSELECTED node on the same row.
    //
    // Strategy (two-stage):
    //   1. Compute the minimum horizontal shift (left or right)
    //      that clears every collision. If a clean dx exists, use it.
    //   2. If no horizontal-only shift clears everything (e.g. the
    //      row is fully occupied by wide unselected chains), drop
    //      the moved block onto a FRESH ROW below the bottom of
    //      the canvas. Disruptive but guarantees zero overlap, and
    //      keeps the user's chain intact.
    //
    // "Same row" uses a STRIDE-based test (half a row stride
    // tolerance) rather than the full vertical title extent — titles
    // routinely bleed into adjacent rows in the canonical layout,
    // and treating that bleed as a collision would force every
    // tidy into a fresh row.
    const COLLISION_GAP = 12
    const SAME_ROW_TOL = (NODE_H + PH_GAP) / 2 // = 105
    const halfWVisual = (n: BuilderNode) =>
      Math.max(NODE_W / 2, measureTitleVisualWidth(n.title) / 2)
    const unselectedRects = nodes
      .filter((n) => !workingIds.has(n.id))
      .map((n) => ({
        x: n.x,
        y: n.y,
        halfW: halfWVisual(n),
      }))
    const movedRects = Array.from(moved.entries())
      .map(([id, p]) => {
        const n = nodes.find((x) => x.id === id)
        if (!n) return null
        return { id, x: p.x, y: p.y, halfW: halfWVisual(n) }
      })
      .filter(
        (r): r is { id: string; x: number; y: number; halfW: number } =>
          r !== null,
      )

    // Returns true if applying (dx, dy) to every moved rect results
    // in any collision with an unselected rect on the same row.
    const wouldCollide = (dx: number, dy: number) => {
      for (const m of movedRects) {
        const mY = m.y + dy
        const mX = m.x + dx
        for (const u of unselectedRects) {
          if (Math.abs(mY - u.y) >= SAME_ROW_TOL) continue
          if (Math.abs(mX - u.x) < m.halfW + u.halfW + COLLISION_GAP) {
            return true
          }
        }
      }
      return false
    }

    if (wouldCollide(0, 0)) {
      // Stage 1 — find minimum horizontal shift that clears all
      // same-row collisions. Compute per-pair pushLeft and
      // pushRight values; the global clear is `max(pushRight)` or
      // `min(pushLeft)` across all colliding pairs.
      let needLeftShift = 0
      let needRightShift = 0
      for (const m of movedRects) {
        for (const u of unselectedRects) {
          if (Math.abs(m.y - u.y) >= SAME_ROW_TOL) continue
          if (Math.abs(m.x - u.x) >= m.halfW + u.halfW + COLLISION_GAP) continue
          const pushLeft = u.x - u.halfW - m.halfW - COLLISION_GAP - m.x
          const pushRight = u.x + u.halfW + m.halfW + COLLISION_GAP - m.x
          if (pushLeft < needLeftShift) needLeftShift = pushLeft
          if (pushRight > needRightShift) needRightShift = pushRight
        }
      }

      let appliedDx = 0
      let appliedDy = 0
      // Try left-shift first if it's smaller in magnitude.
      const tryOrder =
        Math.abs(needLeftShift) <= Math.abs(needRightShift)
          ? [needLeftShift, needRightShift]
          : [needRightShift, needLeftShift]
      for (const cand of tryOrder) {
        if (cand === 0) continue
        if (!wouldCollide(cand, 0)) {
          appliedDx = cand
          break
        }
      }

      // Stage 2 — horizontal couldn't clear; drop onto a fresh
      // row BELOW the bottom of every unselected node. Keep the
      // moved block's internal layout; no horizontal shift.
      if (appliedDx === 0 && wouldCollide(0, 0)) {
        const maxUnselectedY =
          unselectedRects.length > 0
            ? Math.max(...unselectedRects.map((u) => u.y))
            : 0
        const minMovedY = Math.min(...movedRects.map((m) => m.y))
        const targetMinY = maxUnselectedY + (NODE_H + PH_GAP)
        const candDy = targetMinY - minMovedY
        if (candDy > 0 && !wouldCollide(0, candDy)) {
          appliedDy = candDy
        }
      }

      if (appliedDx !== 0 || appliedDy !== 0) {
        for (const [id, p] of moved) {
          moved.set(id, { x: p.x + appliedDx, y: p.y + appliedDy })
        }
      }
    }

    setNodes((prev) =>
      prev.map((n) => {
        const m = moved.get(n.id)
        return m ? { ...n, x: m.x, y: m.y } : n
      }),
    )

    // ----- Auto-focus to capture the cleaned-up layout -----
    // Goal: do the MINIMUM camera adjustment needed to keep every
    // tidied sequence inside the viewport. No forced centering — if
    // the bbox is already fully visible we don't touch pan or zoom;
    // if part of it is off-screen we nudge pan just enough to bring
    // it back in; only when the bbox can't fit at the current zoom
    // do we zoom out (and even then we anchor the zoom around the
    // bbox center so the view doesn't jump).
    //
    // The bbox is built in canvas-space and INCLUDES the title's
    // visible extents — titles can run ~141 px past the tile
    // horizontally and ~233 px below it vertically, so naïve
    // tile-only bboxes would let labels hang off the viewport edge.
    const wrapperRect = canvasWrapperRef.current?.getBoundingClientRect()
    if (wrapperRect && moved.size > 0) {
      const FOCUS_PADDING = 48
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const [id, m] of moved) {
        const node = nodes.find((n) => n.id === id)
        const titleW = node ? measureTitleVisualWidth(node.title) : NODE_W
        const halfW = Math.max(NODE_W / 2, titleW / 2)
        const labelBottomExtent =
          NODE_H / 2 - NODE_H + LABEL_TOP_OFFSET + LABEL_FONT * 1.2 * 5
        const topExtent = NODE_H / 2
        const bottomExtent = Math.max(NODE_H / 2, labelBottomExtent)
        if (m.x - halfW < minX) minX = m.x - halfW
        if (m.x + halfW > maxX) maxX = m.x + halfW
        if (m.y - topExtent < minY) minY = m.y - topExtent
        if (m.y + bottomExtent > maxY) maxY = m.y + bottomExtent
      }
      // Inline-add placeholder tail past the latest open leaf.
      if (placeholderHostId) {
        const m = moved.get(placeholderHostId)
        if (m) {
          const tailRightX = m.x + NODE_W / 2 + PH_GAP + PH_W
          if (tailRightX > maxX) maxX = tailRightX
        }
      }

      const bboxW = Math.max(1, maxX - minX)
      const bboxH = Math.max(1, maxY - minY)
      const viewW = wrapperRect.width
      const viewH = wrapperRect.height
      const availW = Math.max(1, viewW - FOCUS_PADDING * 2)
      const availH = Math.max(1, viewH - FOCUS_PADDING * 2)

      // Step 1 — zoom only if bbox can't fit at the current zoom.
      // Otherwise keep zoom intact (no surprise rescale).
      let newZoom = zoom
      if (zoom * bboxW > availW || zoom * bboxH > availH) {
        const fit = Math.min(availW / bboxW, availH / bboxH)
        newZoom = Math.max(0.25, Math.min(2, +fit.toFixed(2)))
      }

      // Step 2 — start from the current pan, adjusted to keep the
      // bbox CENTER pinned on screen if we changed zoom (prevents a
      // jarring jump). Then minimally nudge to bring any
      // out-of-view edges back inside the padded viewport.
      let newPanX = pan.x
      let newPanY = pan.y
      if (newZoom !== zoom) {
        const bboxCenterX = (minX + maxX) / 2
        const bboxCenterY = (minY + maxY) / 2
        const screenCenterX = pan.x + zoom * bboxCenterX
        const screenCenterY = pan.y + zoom * bboxCenterY
        newPanX = screenCenterX - newZoom * bboxCenterX
        newPanY = screenCenterY - newZoom * bboxCenterY
      }

      // Resolve screen-space bbox edges under (newZoom, candidate
      // pan). If any edge is past the padded viewport, shift pan by
      // exactly the overflow amount — never more — so the camera
      // moves the minimum distance needed.
      const screenLeft = newPanX + newZoom * minX
      const screenRight = newPanX + newZoom * maxX
      const screenTop = newPanY + newZoom * minY
      const screenBottom = newPanY + newZoom * maxY

      if (screenLeft < FOCUS_PADDING) {
        newPanX += FOCUS_PADDING - screenLeft
      } else if (screenRight > viewW - FOCUS_PADDING) {
        newPanX -= screenRight - (viewW - FOCUS_PADDING)
      }
      if (screenTop < FOCUS_PADDING) {
        newPanY += FOCUS_PADDING - screenTop
      } else if (screenBottom > viewH - FOCUS_PADDING) {
        newPanY -= screenBottom - (viewH - FOCUS_PADDING)
      }

      if (newZoom !== zoom) setZoom(newZoom)
      if (newPanX !== pan.x || newPanY !== pan.y) {
        setPan({ x: newPanX, y: newPanY })
      }
    }

    // Snapshot already pushed onto the undo stack by `snapshotForUndo`
    // (see top of this action). Just surface the toast.
    void undoState
    setToast({
      title: 'Tidy up was done successfully',
      body: `You just tidied up ${sel.length} elements.`,
    })
    announce(
      `Tidied ${sel.length} nodes into ${totalRows} ${
        totalRows === 1 ? 'row' : 'rows'
      }`,
    )
  }

  // Dev-only test backdoor — lets the preview harness exercise tidy-up
  // without driving the marquee through synthetic pointer events. Only
  // installs in dev (`import.meta.env.DEV`), guarded so a stale prod
  // bundle can never expose it.
  React.useEffect(() => {
    if (!(import.meta as any).env?.DEV) return
    ;(window as any).__tidyTest = {
      selectAll: () => setSelectedNodeIds(new Set(nodes.map((n) => n.id))),
      runTidy: () => tidyUpSelection(),
      readPositions: () =>
        nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, title: n.title })),
    }
    return () => {
      delete (window as any).__tidyTest
    }
  })

  /** Duplicate every selected node: clones land at +120/+40 offset so the
   *  duplicates don't sit on top of the originals. Edges between selected
   *  pairs are duplicated too, preserving the local sub-graph shape. */
  const duplicateSelection = () => {
    if (selectedNodeIds.size === 0) return
    const undoState = snapshotForUndo('Duplicated')
    // Locked pairs duplicate as pairs — duplicating just the host
    // would leave the clone without its mandatory Confirm Email half.
    const workingIds = expandWithLockedPartners(selectedNodeIds)
    const idMap = new Map<string, string>()
    const newNodes: BuilderNode[] = []
    for (const n of nodes) {
      if (!workingIds.has(n.id)) continue
      const newId = `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      idMap.set(n.id, newId)
      newNodes.push({
        ...n,
        id: newId,
        x: n.x + 120,
        y: n.y + 40,
      })
    }
    const newEdges: BuilderEdge[] = []
    const newLockedPairs: LockedPair[] = []
    for (const e of edges) {
      const fromNew = idMap.get(e.from)
      const toNew = idMap.get(e.to)
      if (!fromNew || !toNew) continue
      const newEdgeId = `e-${Date.now()}-${Math.random().toString(36).slice(2, 5)}-${newEdges.length}`
      newEdges.push({
        id: newEdgeId,
        from: fromNew,
        to: toNew,
      })
      // Mirror any locked-pair registration whose endpoints both moved
      // into the clone, so the duplicated pair retains its lock badge
      // + travel-together semantics.
      const sourcePair = lockedPairs.find(
        (p) => idMap.get(p.hostId) === fromNew && idMap.get(p.partnerId) === toNew,
      )
      if (sourcePair) {
        newLockedPairs.push({ hostId: fromNew, partnerId: toNew, edgeId: newEdgeId })
      }
    }
    setNodes((prev) => [...prev, ...newNodes])
    setEdges((prev) => [...prev, ...newEdges])
    if (newLockedPairs.length > 0) {
      setLockedPairs((prev) => [...prev, ...newLockedPairs])
    }
    setSelectedNodeIds(new Set(idMap.values()))
    setPrimarySelectedId(newNodes[newNodes.length - 1]?.id ?? null)
    // Re-anchor to the topmost-leftmost clone so the toolbar follows
    // the duplicated block instead of sitting on the now-deselected
    // originals.
    const topMostClone = [...newNodes].sort(
      (a, b) => a.y - b.y || a.x - b.x,
    )[0]
    if (topMostClone) setSelectionAnchorId(topMostClone.id)
    // Snapshot already pushed onto the undo stack by `snapshotForUndo`
    // (see top of this action). Just surface the toast.
    void undoState
    setToast({
      title: 'Duplicate was done successfully',
      body: `You just duplicated ${newNodes.length} element${newNodes.length === 1 ? '' : 's'}.`,
    })
    announce(`Duplicated ${newNodes.length} nodes`)
  }

  /** Delete every selected node + any edge touching them. Decision-diamond
   *  configs are torn down too so they don't sit orphaned in state. */
  const deleteSelection = () => {
    if (selectedNodeIds.size === 0) return
    const undoState = snapshotForUndo('Deleted')
    // Deleting either half of a locked pair always deletes both —
    // Confirm Email can't survive without Get email opt-in, and vice
    // versa. Expansion happens BEFORE removal so the locked-pair
    // registry can find the entry to retire.
    const removedIds = expandWithLockedPartners(selectedNodeIds)
    setNodes((prev) => prev.filter((n) => !removedIds.has(n.id)))
    setEdges((prev) =>
      prev.filter((e) => !removedIds.has(e.from) && !removedIds.has(e.to)),
    )
    setLockedPairs((prev) =>
      prev.filter(
        (p) => !removedIds.has(p.hostId) && !removedIds.has(p.partnerId),
      ),
    )
    setDecisionConfigs((prev) => {
      const next: Record<string, DecisionDiamondConfig> = {}
      for (const [id, c] of Object.entries(prev)) {
        if (!removedIds.has(id)) next[id] = c
      }
      return next
    })
    const count = removedIds.size
    setSelectedNodeIds(new Set())
    setPrimarySelectedId(null)
    setSelectionAnchorId(null)
    setMenuAnchor(null)
    // Snapshot already pushed onto the undo stack by `snapshotForUndo`
    // (see top of this action). Just surface the toast.
    void undoState
    setToast({
      title: 'Delete was done successfully',
      body: `You just deleted ${count} element${count === 1 ? '' : 's'}.`,
    })
    announce(`Deleted ${count} nodes`)
  }

  /** Back-compat alias retained for the toast's Undo button —
   *  delegates to the stack-based `undo()` so the most-recent action
   *  gets reverted. */
  const undoLastAction = undo

  /** Keep refs pointing at the latest `undo` / `redo` so the
   *  keyboard listener (mounted once) always invokes a fresh closure
   *  with up-to-date state — no need to re-attach the listener every
   *  render. */
  const undoFnRef = React.useRef<() => void>(undo)
  const redoFnRef = React.useRef<() => void>(redo)
  undoFnRef.current = undo
  redoFnRef.current = redo

  /** Cmd/Ctrl + Z = undo, Cmd/Ctrl + Shift + Z (or Ctrl + Y) = redo.
   *  Suppressed when focus is in a text input / textarea so the
   *  browser's native undo for typing isn't hijacked. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey
      if (!cmd) return
      const t = e.target as HTMLElement | null
      if (t) {
        const tag = t.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return
      }
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoFnRef.current()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redoFnRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleNodeAction = (
    action: 'view' | 'settings' | 'duplicate' | 'rename' | 'delete',
  ) => {
    const target = nodes.find((n) => n.id === primarySelectedId)
    if (!target) return
    switch (action) {
      case 'delete': {
        // Locked-pair semantics: deleting either half also removes the
        // partner + retires the lock registration. The locked edge is
        // dropped along with any other edges touching the removed set.
        const pair = lockedPairs.find(
          (p) => p.hostId === target.id || p.partnerId === target.id,
        )
        const removedIds = new Set<string>([target.id])
        if (pair) {
          removedIds.add(pair.hostId)
          removedIds.add(pair.partnerId)
        }
        pushUndo(pair ? 'Deleted locked pair' : `Deleted "${target.title}"`)
        setNodes((prev) => prev.filter((n) => !removedIds.has(n.id)))
        setEdges((prev) =>
          prev.filter(
            (e) => !removedIds.has(e.from) && !removedIds.has(e.to),
          ),
        )
        if (pair) {
          setLockedPairs((prev) =>
            prev.filter(
              (p) => !removedIds.has(p.hostId) && !removedIds.has(p.partnerId),
            ),
          )
        }
        selectOnly(null)
        setMenuAnchor(null)
        announce(
          pair
            ? `Deleted locked pair "${target.title}" + Confirm Email`
            : `Deleted "${target.title}"`,
        )
        break
      }
      case 'duplicate': {
        pushUndo(`Duplicated "${target.title}"`)
        const copy: BuilderNode = {
          ...target,
          id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          x: target.x + 120,
          y: target.y + 40,
        }
        setNodes((prev) => [...prev, copy])
        selectOnly(copy.id)
        announce(`Duplicated "${target.title}"`)
        break
      }
      case 'view': {
        // Whenever opening a config modal/editor, dismiss the node's
        // action-menu dropdown so it doesn't sit stranded behind the modal.
        setMenuAnchor(null)
        // Locked-pair partner (Confirm Email) is non-configurable —
        // see Keap's `St.configurable === '0'` + `disabledConfigMsgCode`.
        // Surface the locked-by-design message instead of an editor.
        const partnerPair = lockedPairs.find((p) => p.partnerId === target.id)
        if (partnerPair) {
          announce(
            'Confirm Email is automatically created and managed as part of the opt-in flow.',
          )
          break
        }
        if (target.type === 'decision') {
          openDecisionEditor(target.id)
        } else if (target.name === 'product-is-purchased') {
          // Re-open the trigger config modal for an existing purchase node.
          // Seed an empty config if none exists yet (e.g. node was created
          // before this feature shipped or via drag-drop, not the picker).
          setPurchaseConfigs((prev) =>
            prev[target.id] ? prev : { ...prev, [target.id]: blankPurchaseConfig() },
          )
          setPurchaseEditorId(target.id)
        } else if (target.name === 'appointments') {
          setAppointmentConfigs((prev) =>
            prev[target.id]
              ? prev
              : { ...prev, [target.id]: blankAppointmentGoalConfig() },
          )
          setAppointmentEditorId(target.id)
        } else if (target.name === 'pipeline-stage-is-moved') {
          setPipelineConfigs((prev) =>
            prev[target.id]
              ? prev
              : { ...prev, [target.id]: blankPipelineStageMoveConfig() },
          )
          setPipelineEditorId(target.id)
        } else {
          announce(`View & edit "${target.title}"`)
        }
        break
      }
      case 'settings':
        announce(`Settings for "${target.title}"`)
        break
      case 'rename':
        // Decision diamonds aren't in `allowedKeys` for rename, but guard
        // anyway so a stale call from a different code path is a no-op.
        if (target.type === 'decision') break
        setMenuAnchor(null)
        setRenamingNodeId(target.id)
        break
    }
  }

  /** Click / keyboard fallback — no drop coordinates, so place the new node
   *  to the right of the rightmost existing node. */
  const handleCellActivate = (cell: PaletteCell) => {
    pushUndo(`Added "${cell.defaultName}"`)
    const maxX = nodes.reduce((m, n) => Math.max(m, n.x), 0)
    const payload = {
      type: activeTab,
      name: cell.name,
      defaultName: cell.defaultName,
    } as const
    const node = buildNodeFromPayload(payload, maxX + NODE_W + 80, 200)
    setNodes((prev) => [...prev, node])
    selectOnly(node.id)
    announce(`Added "${cell.defaultName}"`)
  }

  const handleClose = () => navigate('/my-automations/list/advanced')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', overflow: 'hidden' }}>
      {/* Top bar */}
      <BuilderTopBar
        title={displayedAutomationName}
        owner={automation.category}
        onClose={handleClose}
        onRename={handleRenameAutomation}
      />

      {/* Main body — positioned container so the collapse toggle (sibling of
          sidebar + canvas, NOT inside the sidebar) can be absolutely placed.
          `--toggle-top` is overridden here to anchor the toggle relative to
          this body row, which sits below the 72px top bar. */}
      <div
        style={{
          flex: 1, minHeight: 0, display: 'flex', position: 'relative',
          // Toggle is 32px tall; the tab row is 40px. `(40 - 32) / 2 = 4px`
          // lands the toggle's visual center on the tab row's center.
          ['--toggle-top' as string]: '4px',
          ['--toggle-top-sequence' as string]: '4px',
        }}
      >
        <TriggerPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          search={search}
          onSearch={setSearch}
          collapsed={panelCollapsed}
          onCellActivate={handleCellActivate}
        />
        <SidebarCollapseToggle
          collapsed={panelCollapsed}
          onClick={() => setPanelCollapsed((v) => !v)}
          aria-controls="builder-sidebar"
        />

        {/* Canvas wrapper — also a drop target for palette cells and the
            pan gesture surface. Pan is handled here (not on the scaled
            inner surface) so the translation is applied in screen pixels. */}
        <div
          ref={canvasWrapperRef}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes('celltype')) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(e) => {
            if (!e.dataTransfer.types.includes('celltype')) return
            e.preventDefault()
            // Drop coords are converted to canvas-space inside the drop
            // handler; pass the panned/scaled local x/y here.
            const rect = e.currentTarget.getBoundingClientRect()
            handleDropCellOnCanvas({
              type: e.dataTransfer.getData('celltype') as 'when' | 'then',
              name: e.dataTransfer.getData('cellname'),
              defaultName: e.dataTransfer.getData('celldefaultname'),
              x: e.clientX - rect.left - pan.x,
              y: e.clientY - rect.top - pan.y,
            })
          }}
          onPointerDown={(e) => {
            // Only react to gestures that land on empty canvas — wrapper
            // itself or the inner zoomed surface (`data-canvas-bg`).
            const t = e.target as HTMLElement
            const isBg =
              t === e.currentTarget ||
              t.hasAttribute?.('data-canvas-bg') ||
              t.closest?.('[data-canvas-bg]') === t
            if (!isBg) return
            if (e.button !== 0) return
            e.currentTarget.setPointerCapture(e.pointerId)
            // Shift+Drag → marquee selection (works regardless of pan
            // mode). Otherwise we start a tracking gesture so a plain
            // click on empty canvas can still deselect; the gesture
            // only actually pans the view when pan mode is on.
            if (e.shiftKey) {
              // Prevent the browser from initiating a native text
              // selection — the cursor will travel over the header /
              // sidebar mid-drag and would otherwise highlight every
              // text node it passes.
              e.preventDefault()
              const rect = e.currentTarget.getBoundingClientRect()
              const cx = (e.clientX - rect.left - pan.x) / zoom
              const cy = (e.clientY - rect.top - pan.y) / zoom
              marqueeStartRef.current = {
                clientX: e.clientX,
                clientY: e.clientY,
                canvasX: cx,
                canvasY: cy,
                prevIds: new Set(selectedNodeIds),
              }
              setMarquee({ x1: cx, y1: cy, x2: cx, y2: cy })
              return
            }
            panGestureRef.current = {
              startClientX: e.clientX,
              startClientY: e.clientY,
              startPanX: pan.x,
              startPanY: pan.y,
              moved: false,
            }
            // Always enter "panning" on press so the cursor flips to
            // the closed-hand (grabbing) state. Pan translation runs
            // unconditionally on drag too — pressing the canvas is the
            // gesture, Tab just keeps the open-hand cursor visible
            // when idle.
            setIsPanning(true)
          }}
          onPointerMove={(e) => {
            // Marquee in flight — update rectangle + provisional selection.
            const m = marqueeStartRef.current
            if (m) {
              const rect = e.currentTarget.getBoundingClientRect()
              const cx = (e.clientX - rect.left - pan.x) / zoom
              const cy = (e.clientY - rect.top - pan.y) / zoom
              const x1 = Math.min(m.canvasX, cx)
              const y1 = Math.min(m.canvasY, cy)
              const x2 = Math.max(m.canvasX, cx)
              const y2 = Math.max(m.canvasY, cy)
              setMarquee({ x1, y1, x2, y2 })
              // Live-preview the selection set: previously-selected ids
              // are kept (additive); any node whose bbox intersects the
              // marquee gets folded in.
              const hits = new Set(m.prevIds)
              for (const n of nodes) {
                const nx1 = n.x - NODE_W / 2
                const nx2 = n.x + NODE_W / 2
                const ny1 = n.y - NODE_H / 2
                const ny2 = n.y + NODE_H / 2
                if (nx2 < x1 || nx1 > x2 || ny2 < y1 || ny1 > y2) continue
                hits.add(n.id)
              }
              setSelectedNodeIds(hits)
              // Marquee anchor for the toolbar = topmost-leftmost node
              // in the resulting selection (sort by y, then x).
              const sortedHits = nodes
                .filter((n) => hits.has(n.id))
                .sort((a, b) => a.y - b.y || a.x - b.x)
              setSelectionAnchorId(sortedHits[0]?.id ?? null)
              return
            }
            const g = panGestureRef.current
            if (!g) return
            const dx = e.clientX - g.startClientX
            const dy = e.clientY - g.startClientY
            if (!g.moved && Math.abs(dx) + Math.abs(dy) < 3) return
            g.moved = true
            setPan({ x: g.startPanX + dx, y: g.startPanY + dy })
          }}
          onPointerUp={(e) => {
            const m = marqueeStartRef.current
            if (m) {
              marqueeStartRef.current = null
              setMarquee(null)
              try {
                e.currentTarget.releasePointerCapture(e.pointerId)
              } catch {}
              // Sync primary selection: if the live set is non-empty
              // and there's no anchor yet, anchor at the newest pick.
              setSelectedNodeIds((curr) => {
                if (curr.size === 0) {
                  setPrimarySelectedId(null)
                  setSelectionAnchorId(null)
                }
                return curr
              })
              setSelectedEdgeId(null)
              setMenuAnchor(null)
              return
            }
            const g = panGestureRef.current
            if (!g) return
            panGestureRef.current = null
            setIsPanning(false)
            try {
              e.currentTarget.releasePointerCapture(e.pointerId)
            } catch {}
            if (!g.moved) {
              selectOnly(null)
              setSelectedEdgeId(null)
              setMenuAnchor(null)
              setPicker(null)
            }
          }}
          style={{
            flex: 1, minWidth: 0, position: 'relative',
            background: G.canvasBg, overflow: 'hidden',
            // Cursor logic:
            //   active press / drag → grabbing  (closed hand)
            //   Tab-toggled pan mode → grab      (open hand, idle ready)
            //   otherwise           → default   (regular arrow)
            // Pressing the canvas always flips to the closed hand, so
            // pan + visual stay in sync whether or not Tab is held.
            cursor: isPanning ? 'grabbing' : panMode ? 'grab' : 'default',
            // Disable native touch scrolling so trackpads route to onWheel.
            touchAction: 'none',
            // While actively panning OR drawing a marquee, suppress
            // text selection inside the canvas. Otherwise leave it on.
            userSelect: isPanning || marquee != null ? 'none' : 'auto',
          }}
        >
          {/* Zoomed + panned canvas surface. The transform order matters:
              translate happens in SCREEN pixels BEFORE the scale, so 1px
              of pan is always 1px on-screen regardless of zoom. */}
          <div
            // Marker: pointerdown on this element (or on its non-node
            // background) starts a pan gesture on the wrapper.
            data-canvas-bg
            style={{
              position: 'absolute', inset: 0,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top left',
              width: `${100 / zoom}%`, height: `${100 / zoom}%`,
              pointerEvents: 'auto',
            }}
          >
            {/* SVG edges */}
            <svg
              width="100%" height="100%"
              // SVGs clip to their viewport by default, which cuts connector
              // paths short whenever a node is dragged past the initial
              // surface bounds (negative y, or x > surface width). The
              // explicit overflow:visible keeps paths drawn in "outside"
              // coordinates visible without having to grow the surface.
              overflow="visible"
              // pointerEvents:none on the root SVG so the scaled surface still
              // receives background clicks; individual connector paths opt
              // back in so they remain selectable via a 15px hit stroke.
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
            >
              {edges.map((e) => {
                const from = nodes.find((n) => n.id === e.from)!
                const to = nodes.find((n) => n.id === e.to)!
                const a = nodeAnchorRight(from)
                const b = nodeAnchorLeft(to)
                const selected = selectedEdgeId === e.id
                const color = selected ? CONNECTOR_SELECTED : CONNECTOR_DEFAULT
                // Lock badge is mounted mid-line when the edge is the
                // join between a locked pair. Today only
                // get-email-opt-in → Confirm Email registers a locked
                // edge — see `insertGetEmailOptInLockedPair`.
                const lockedPair = lockedPairs.find((p) => p.edgeId === e.id)
                const midX = (a.x + b.x) / 2
                const midY = (a.y + b.y) / 2

                return (
                  <g key={e.id}>
                    {/* Invisible 15px-wide hit stroke for easy clicking.
                        Locked edges aren't user-detachable, so swallow
                        the click instead of selecting the edge. */}
                    <path
                      d={edgePath(a.x, a.y, b.x, b.y)}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={15}
                      style={{
                        cursor: lockedPair ? 'not-allowed' : 'pointer',
                        pointerEvents: 'stroke',
                      }}
                      onClick={(ev) => {
                        ev.stopPropagation()
                        if (lockedPair) return
                        setSelectedEdgeId(e.id)
                        selectOnly(null)
                        setMenuAnchor(null)
                      }}
                    />
                    {/* Visible line. */}
                    <path
                      d={edgePath(a.x, a.y, b.x, b.y)}
                      fill="none"
                      stroke={color}
                      strokeWidth={3}
                      style={{ pointerEvents: 'none' }}
                    />
                    {/* Chevron end-cap at the target anchor. The bezier
                        arrives horizontally (control2 shares y2) so the
                        chevron's wings extend straight back-left. */}
                    <polyline
                      points={`${b.x - CHEVRON_W},${b.y - CHEVRON_H} ${b.x},${b.y} ${b.x - CHEVRON_W},${b.y + CHEVRON_H}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ pointerEvents: 'none' }}
                    />
                    {/* Lock badge — circle + padlock glyph, centered on
                        the edge midpoint. Owns its own hover state so
                        it can surface the "automatically managed"
                        tooltip matching Keap's `showLockTooltip`. */}
                    {lockedPair && (
                      <LockedEdgeBadge cx={midX} cy={midY} color={color} />
                    )}
                  </g>
                )
              })}
              {/* Default-gray connector from each open leaf to its docked
                  InlineAddPlaceholder. Uses the same bezier shape + 37×32
                  arrowhead glyph as real edges so the placeholder feels
                  like "the next step, not yet filled in." */}
              {openLeaves.map((n) => {
                const a = nodeAnchorRight(n)
                const phCenterX = n.x + NODE_W / 2 + PH_GAP + PH_W / 2
                const b = { x: phCenterX - PH_W / 2, y: n.y }
                return (
                  <g key={`leaf-connector-${n.id}`} style={{ pointerEvents: 'none' }}>
                    <path
                      d={edgePath(a.x, a.y, b.x, b.y)}
                      fill="none"
                      stroke={CONNECTOR_DEFAULT}
                      strokeWidth={3}
                    />
                    <polyline
                      points={`${b.x - CHEVRON_W},${b.y - CHEVRON_H} ${b.x},${b.y} ${b.x - CHEVRON_W},${b.y + CHEVRON_H}`}
                      fill="none"
                      stroke={CONNECTOR_DEFAULT}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                )
              })}
              {/* Live preview connector for an in-flight drag-to-connect.
                  Starts at the captured button anchor and follows the
                  cursor until release. Highlights in the accent color
                  when hovering a valid drop target so the user knows the
                  release will commit. */}
              {connecting && (() => {
                const origin = nodes.find((n) => n.id === connecting.originId)
                if (!origin) return null
                const a = nodeAnchorRight(origin)
                const target = connecting.targetId
                  ? nodes.find((n) => n.id === connecting.targetId)
                  : null
                const b = target
                  ? nodeAnchorLeft(target)
                  : { x: connecting.currentX, y: connecting.currentY }
                // Always black — target lock is communicated by the node's
                // black focus ring + the arrowhead snapping into place, not
                // by a color shift on the line itself.
                const stroke = '#000000'
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <path
                      d={edgePath(a.x, a.y, b.x, b.y)}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={2.8}
                    />
                    {/* Chevron only once locked onto a target — during free
                        drag the tail is the cursor itself. */}
                    {target && (
                      <polyline
                        points={`${b.x - CHEVRON_W},${b.y - CHEVRON_H} ${b.x},${b.y} ${b.x - CHEVRON_W},${b.y + CHEVRON_H}`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={2.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </g>
                )
              })()}
            </svg>

            {/* Marquee selection rectangle (Shift+Drag). Sits above edges
                but below nodes so the nodes' interactive surface stays
                clickable. pointer-events:none so the rectangle never
                blocks the underlying canvas pointer gesture. */}
            {marquee && (
              <div
                style={{
                  position: 'absolute',
                  left: Math.min(marquee.x1, marquee.x2),
                  top: Math.min(marquee.y1, marquee.y2),
                  width: Math.abs(marquee.x2 - marquee.x1),
                  height: Math.abs(marquee.y2 - marquee.y1),
                  background: 'rgba(131, 88, 241, 0.08)',
                  border: '1.5px solid rgba(131, 88, 241, 0.7)',
                  borderRadius: 4,
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              />
            )}

            {/* Nodes */}
            {nodes.map((n) => (
              <CanvasNode
                key={n.id}
                node={n}
                selected={selectedNodeIds.has(n.id)}
                inMultiSelection={
                  selectedNodeIds.size >= 2 && selectedNodeIds.has(n.id)
                }
                onActivate={(shiftKey) => {
                  // Fires on pointerdown — shows the purple ring immediately,
                  // even when the gesture turns into a drag. Closes any open
                  // menu so it doesn't linger in the wrong place while the
                  // node moves.
                  //
                  // Selection contract:
                  //   • Shift+Click → toggle membership in the selection.
                  //   • Plain pointerdown on a node ALREADY in a multi-
                  //     selection → preserve everything. The subsequent
                  //     drag translates every selected node as a rigid
                  //     group (see `handleNodeMove`). A click-without-
                  //     drag collapses to just this node — handled in
                  //     `onOpenMenu`, mirroring how Figma / Sketch behave.
                  //   • Plain pointerdown on any other node → replace the
                  //     selection with just this node.
                  setMenuAnchor(null)
                  setSelectedEdgeId(null)
                  setPrimarySelectedId(n.id)
                  if (shiftKey) {
                    setSelectedNodeIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(n.id)) next.delete(n.id)
                      else next.add(n.id)
                      return next
                    })
                    // Anchor for the toolbar = the FIRST node clicked.
                    // If nothing was anchored yet (selection was empty),
                    // adopt this node. Otherwise leave the existing
                    // anchor in place so subsequent Shift+Clicks don't
                    // jump the toolbar.
                    setSelectionAnchorId((prev) => prev ?? n.id)
                  } else {
                    const inMulti =
                      selectedNodeIds.size >= 2 && selectedNodeIds.has(n.id)
                    if (inMulti) {
                      // Preserve the multi-selection (and toolbar
                      // anchor) so the gesture can translate every
                      // selected node together.
                      return
                    }
                    setSelectedNodeIds(new Set([n.id]))
                    setSelectionAnchorId(n.id)
                  }
                }}
                onOpenMenu={(clientX, clientY) => {
                  // Click-without-drag callback (CanvasNode invokes this
                  // only when pointerup happens with no movement past
                  // the 3 px threshold and no Shift).
                  //
                  // If pointerdown preserved a multi-selection (see
                  // `onActivate`), collapse it to just this node now —
                  // the user clicked, didn't drag, so the standard
                  // "click on member of multi-select picks just that
                  // node" pattern fires here.
                  if (selectedNodeIds.size > 1 && selectedNodeIds.has(n.id)) {
                    setSelectedNodeIds(new Set([n.id]))
                    setSelectionAnchorId(n.id)
                    return
                  }
                  if (selectedNodeIds.size > 1) return
                  setMenuAnchor(clientToCanvas(clientX, clientY))
                }}
                onOpenEditor={() => {
                  // Double-click → open detailed editor. Ensure the node is
                  // the sole selection and dismiss the action menu. Decision
                  // diamonds get the dedicated rule-routing modal; other
                  // node types still emit the placeholder announce() until
                  // their editors are built.
                  selectOnly(n.id)
                  setMenuAnchor(null)
                  // Locked-pair partners are non-configurable by spec
                  // (Keap's `St.configurable === '0'` for GOAL_EMAIL_CONFIRM).
                  // Surface the same locked-by-design message the funnel
                  // editor shows from `displayConfirmEmailMsg`.
                  const lp = lockedPairs.find((p) => p.partnerId === n.id)
                  if (lp) {
                    announce(
                      'Confirm Email is automatically created and managed as part of the opt-in flow.',
                    )
                    return
                  }
                  if (n.type === 'decision') {
                    openDecisionEditor(n.id)
                  } else {
                    announce(`Open editor: "${n.title}"`)
                  }
                }}
                onMove={handleNodeMove}
                zoom={zoom}
                connectTarget={connecting?.targetId === n.id}
                showHoverAdd={
                  // The latest open leaf already owns an inline-add
                  // placeholder, so suppress the hover "+" there to avoid
                  // two competing affordances.
                  !(latestIsOpenLeaf && latestNode != null && n.id === latestNode.id)
                }
                onConnectStart={(originId, clientX, clientY) => {
                  // Close anything that could fight the preview for focus.
                  setPicker(null)
                  setMenuAnchor(null)
                  beginConnect(originId, clientX, clientY)
                }}
                onHoverAdd={() => {
                  // Picker tab is driven by the clicked node's role:
                  //   • click "+" on a When (trigger) → open Then options
                  //   • click "+" on a Then (action/decision) → open When options
                  //
                  // Picker anchors to the hover "+" affordance's
                  // BOTTOM-LEFT corner with an 8 px gap — same
                  // contract as the inline-add placeholder. The
                  // hover "+" sits 8 px past the tile's right edge,
                  // vertically centered, sized HOVER_ADD_SIZE × HOVER_ADD_SIZE,
                  // so its bottom-left corner in canvas-space is:
                  //   x: n.x + NODE_W/2 + 8 (tile right + button gap)
                  //   y: n.y + HOVER_ADD_SIZE/2     (button bottom)
                  // Add another 8 px in y for the picker breathing room.
                  const PICKER_GAP = 8
                  const nextType: 'when' | 'then' =
                    n.type === 'trigger' ? 'then' : 'when'
                  setPicker({
                    originId: n.id,
                    type: nextType,
                    anchor: {
                      x: n.x + NODE_W / 2 + 8,
                      y: n.y + HOVER_ADD_SIZE / 2 + PICKER_GAP,
                    },
                  })
                  selectOnly(null)
                  setSelectedEdgeId(null)
                  setMenuAnchor(null)
                }}
                isRenaming={renamingNodeId === n.id}
                onRequestRename={() => {
                  // Click-on-title shortcut: same effect as picking
                  // Rename from the action menu. Close any open menu so
                  // it doesn't sit stranded behind the inline input.
                  setMenuAnchor(null)
                  setRenamingNodeId(n.id)
                }}
                onCommitTitle={(next) => {
                  // Only push undo when the title actually changed —
                  // dismissing rename with no edit shouldn't pollute
                  // the history stack.
                  if (n.title !== next) {
                    pushUndo(`Renamed "${n.title}"`)
                  }
                  setNodes((prev) =>
                    prev.map((x) =>
                      x.id === n.id ? { ...x, title: next } : x,
                    ),
                  )
                  setRenamingNodeId(null)
                  announce(`Renamed to "${next}"`)
                }}
                onCancelRename={() => setRenamingNodeId(null)}
              />
            ))}

            {/* Inline add-next placeholders — one per open leaf. Variant is
                'single' when the origin is a trigger (single "+ Then"),
                'double' when the origin is an action (stacked "+ When" over
                "+ Then"). */}
            {openLeaves.map((n) => {
              const phX = n.x + NODE_W / 2 + PH_GAP + PH_W / 2
              const variant = n.type === 'trigger' ? 'single' : 'double'
              // Picker anchors to the placeholder's bottom-left
              // corner with an 8px gap — same canvas-space position
              // regardless of which "+" the user clicked or where
              // the cursor was, so the popover lands consistently
              // and predictably below the inline-add affordance.
              const PICKER_GAP = 8
              const phHeight = variant === 'single' ? PH_SINGLE_H : PH_DOUBLE_H
              const pickerAnchor = {
                x: phX - PH_W / 2,
                y: n.y + phHeight / 2 + PICKER_GAP,
              }
              return (
                <InlineAddPlaceholder
                  key={`leaf-ph-${n.id}`}
                  x={phX}
                  y={n.y}
                  variant={variant}
                  onAddWhen={() => {
                    setPicker({ originId: n.id, type: 'when', anchor: pickerAnchor })
                    selectOnly(null)
                    setSelectedEdgeId(null)
                    setMenuAnchor(null)
                  }}
                  onAddThen={() => {
                    setPicker({ originId: n.id, type: 'then', anchor: pickerAnchor })
                    selectOnly(null)
                    setSelectedEdgeId(null)
                    setMenuAnchor(null)
                  }}
                />
              )
            })}

            {/* Picker popover — shown while user is selecting what to
                insert. Closed on Escape, outside-click, or after a pick. */}
            {picker && (
              <InlineAddPicker
                type={picker.type}
                anchor={picker.anchor}
                items={picker.type === 'when' ? TRIGGERS : ACTIONS}
                onPick={(item) => {
                  // Locked-pair pick: Then `get-email-opt-in` auto-spawns
                  // its When `Confirm Email` partner. The two are always
                  // linked because the opt-in flow can't function without
                  // the confirmation step — see `insertGetEmailOptInLockedPair`.
                  const isLockedPairPick =
                    picker.type === 'then' && item.slug === 'get-email-opt-in'
                  const newId = isLockedPairPick
                    ? insertGetEmailOptInLockedPair(picker.originId, {
                        type: picker.type,
                        name: item.slug,
                        defaultName: item.label,
                      })
                    : insertAfterOrigin(picker.originId, {
                        type: picker.type,
                        name: item.slug,
                        defaultName: item.label,
                      })
                  setPicker(null)
                  // Triggers with first-time configuration open their editor
                  // immediately, so the user lands in the config flow they
                  // need to fill in. Today this is just `product-is-purchased`;
                  // additional config-required slugs can be added here.
                  if (newId && item.slug === 'product-is-purchased') {
                    setPurchaseConfigs((prev) =>
                      prev[newId] ? prev : { ...prev, [newId]: blankPurchaseConfig() },
                    )
                    setPurchaseEditorId(newId)
                  } else if (newId && item.slug === 'appointments') {
                    setAppointmentConfigs((prev) =>
                      prev[newId]
                        ? prev
                        : { ...prev, [newId]: blankAppointmentGoalConfig() },
                    )
                    setAppointmentEditorId(newId)
                  } else if (newId && item.slug === 'pipeline-stage-is-moved') {
                    setPipelineConfigs((prev) =>
                      prev[newId]
                        ? prev
                        : { ...prev, [newId]: blankPipelineStageMoveConfig() },
                    )
                    setPipelineEditorId(newId)
                  }
                }}
                onPickDecisionDiamond={() => {
                  insertDecisionDiamondAfter(picker.originId)
                  setPicker(null)
                }}
                onClose={() => setPicker(null)}
              />
            )}

            {/* Selected-node action menu — rendered after nodes so it paints
                on top. Decision diamonds render a trimmed version of the
                same menu (NodeActionMenu filters items by node.type). */}
            {(() => {
              // Menu only renders when a single node is selected; Shift+Click
              // multi-selects bypass it entirely.
              if (selectedNodeIds.size !== 1) return null
              const sel = nodes.find((n) => n.id === primarySelectedId)
              if (!sel || !menuAnchor) return null
              return <NodeActionMenu node={sel} anchor={menuAnchor} onAction={handleNodeAction} />
            })()}
          </div>

          {/* Toast-ish feedback */}
          {droppedTrigger && (
            <div
              role="status"
              style={{
                position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                background: G.text, color: '#fff',
                padding: '6px 12px', borderRadius: 6, fontSize: 13,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              {droppedTrigger}
            </div>
          )}

          <BottomToolbar
            zoom={zoom}
            onZoomIn={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
            onZoomOut={() => setZoom((z) => Math.max(0.25, +(z - 0.1).toFixed(2)))}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onReopenIntro={
              automationId === 'adv2' ? () => setTidyIntroOpen(true) : undefined
            }
          />

          <KeyboardShortcutsPanel
            open={shortcutsOpen}
            onClose={() => setShortcutsOpen(false)}
          />

          <TidyUpIntroCard
            open={tidyIntroOpen}
            onClose={() => setTidyIntroOpen(false)}
          />

          {/* Multi-select floating toolbar — icon-only Duplicate / Tidy
              up / Delete. Visible only when 2+ nodes are selected.
              Each icon shows a black-pill hover tooltip. Undo is no
              longer on this toolbar; it moved to the toast notification
              that appears after each action.
              **Anchored to the FIRST selected sequence (the anchor
              node only — not its whole component)**, horizontally
              centered on that node with an 8 px gap above its top
              edge. Follows pan + zoom; rides along while dragging.
              When the toolbar would land off-screen, a side effect
              (see below) minimally pans the canvas to bring it in. */}
          {selectedNodeIds.size >= 2 && (() => {
            const sel = nodes.filter((n) => selectedNodeIds.has(n.id))
            if (sel.length === 0) return null

            // Anchor source depends on how the user built the
            // selection:
            //   - Shift+Click → first node clicked
            //   - Shift+Drag → topmost-leftmost in the marquee result
            // When the saved anchor isn't in the current selection
            // (e.g. user deleted it or shift-clicked it off), fall
            // back to the topmost-leftmost node still selected.
            const anchor =
              (selectionAnchorId && sel.find((n) => n.id === selectionAnchorId)) ||
              [...sel].sort((a, b) => a.y - b.y || a.x - b.x)[0]

            // Center horizontally on the ANCHOR NODE specifically.
            // 8 display-px gap between the toolbar's bottom edge and
            // the anchor's top edge — constant at any zoom level.
            const TOOLBAR_MARGIN = 8
            const canvasCenterX = anchor.x
            const minY = anchor.y - NODE_H / 2
            const screenCenterX = pan.x + canvasCenterX * zoom
            const screenTop = pan.y + minY * zoom - TOOLBAR_MARGIN
            return (
              <div
                style={{
                  position: 'absolute',
                  left: screenCenterX,
                  top: screenTop,
                  // translateY(-100%) lifts the toolbar onto its own
                  // bottom edge so the 4px gap is preserved between
                  // bottom-of-toolbar and top-of-sequence.
                  transform: 'translate(-50%, -100%)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  padding: 4,
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: 10,
                  boxShadow:
                    '0 10px 20px rgba(17,24,39,0.16), 0 2px 6px rgba(17,24,39,0.08)',
                  zIndex: 50,
                  fontFamily: HEADER_FONT,
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <SelectionToolbarButton
                  label="Duplicate"
                  onClick={duplicateSelection}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </SelectionToolbarButton>
                {/* "Messy flow_Manual" (adv1) is the manual-tidy demo —
                    the Tidy up tool is intentionally hidden there so
                    testers organize by drag-and-drop and can compare
                    against adv2 ("Messy flow_Tidy up tool") which
                    keeps the tool present. */}
                {automationId !== 'adv1' && (
                  <SelectionToolbarButton
                    label="Tidy up"
                    onClick={tidyUpSelection}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                    >
                      <circle cx="5" cy="5" r="1.6" />
                      <circle cx="12" cy="5" r="1.6" />
                      <circle cx="19" cy="5" r="1.6" />
                      <circle cx="5" cy="12" r="1.6" />
                      <circle cx="12" cy="12" r="1.6" />
                      <circle cx="19" cy="12" r="1.6" />
                      <circle cx="5" cy="19" r="1.6" />
                      <circle cx="12" cy="19" r="1.6" />
                      <circle cx="19" cy="19" r="1.6" />
                    </svg>
                  </SelectionToolbarButton>
                )}
                <SelectionToolbarButton
                  label="Delete"
                  onClick={deleteSelection}
                  danger
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                  </svg>
                </SelectionToolbarButton>
              </div>
            )
          })()}

          {/* Dex-style notification toast — bottom-right of the canvas
              wrapper. Auto-dismisses after 4s; Undo restores the
              snapshot captured before the action; × closes immediately
              without undoing. */}
          {toast && (
            <div
              role="status"
              aria-live="polite"
              style={{
                position: 'absolute',
                right: 24,
                bottom: 24,
                width: 320,
                padding: '14px 16px',
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                boxShadow:
                  '0 12px 24px rgba(17,24,39,0.18), 0 2px 6px rgba(17,24,39,0.08)',
                fontFamily: HEADER_FONT,
                zIndex: 60,
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 20,
                    height: 20,
                    flexShrink: 0,
                    marginTop: 1,
                    color: '#16A34A',
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="8 12.5 11 15.5 16 9.5" />
                  </svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#111827',
                      lineHeight: '20px',
                    }}
                  >
                    {toast.title}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 13,
                      color: 'rgba(0,0,0,0.6)',
                      lineHeight: '18px',
                    }}
                  >
                    {toast.body}
                  </div>
                  {undoStack.length > 0 && (
                    <button
                      type="button"
                      onClick={undoLastAction}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 8,
                        padding: 0,
                        background: 'transparent',
                        border: 'none',
                        color: '#006ceb',
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      {/* DEX-standard undo glyph — curved arrow that
                          bends back-left, matching lucide-react's
                          `Undo2`. Replaces the previous clockwise
                          circular arrow which read as a refresh /
                          retry icon, not as undo. */}
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M9 14 4 9l5-5" />
                        <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
                      </svg>
                      Undo
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setToast(null)}
                  style={{
                    width: 24,
                    height: 24,
                    padding: 0,
                    background: 'transparent',
                    border: 'none',
                    color: '#6B7280',
                    cursor: 'pointer',
                    borderRadius: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'inherit',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path
                      d="M18.707 6.707a1 1 0 0 0-1.414-1.414L12 10.586 6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 1 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12z"
                      fillRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Decision Diamond editor modal — portal-style overlay rendered at
          the top of the page tree so it floats above the sidebar + canvas
          without being clipped by any overflow containers. */}
      {decisionEditorId && decisionConfigs[decisionEditorId] && (() => {
        // Hard-filter (Level D): the Branch-by grid only shows entities that
        // appear in this diamond's *connected* workflow path. We BFS in both
        // directions starting from the diamond — visiting only nodes that
        // can reach (or be reached from) it — so disconnected workflows on
        // the same canvas don't bleed entities into this diamond's grid.
        // The diamond's currently-bound entity is always kept so a re-open
        // after graph edits never silently drops the user's selection.
        const adjOut = new Map<string, string[]>()
        const adjIn = new Map<string, string[]>()
        for (const e of edges) {
          if (!adjOut.has(e.from)) adjOut.set(e.from, [])
          adjOut.get(e.from)!.push(e.to)
          if (!adjIn.has(e.to)) adjIn.set(e.to, [])
          adjIn.get(e.to)!.push(e.from)
        }
        const visited = new Set<string>([decisionEditorId])
        const queue: string[] = [decisionEditorId]
        while (queue.length > 0) {
          const id = queue.shift()!
          for (const nbr of [
            ...(adjOut.get(id) ?? []),
            ...(adjIn.get(id) ?? []),
          ]) {
            if (!visited.has(nbr)) {
              visited.add(nbr)
              queue.push(nbr)
            }
          }
        }
        const relevantEntities = new Set<EntityId>()
        for (const n of nodes) {
          if (n.id === decisionEditorId) continue
          if (!visited.has(n.id)) continue
          for (const eid of entitiesForNodeName(n.name)) {
            relevantEntities.add(eid)
          }
        }
        const cfg = decisionConfigs[decisionEditorId]
        if (cfg.boundEntity) relevantEntities.add(cfg.boundEntity)
        // Locate the closest upstream trigger / action and derive the
        // rule preset specialized to that node's own saved configuration
        // (e.g. drop the Type field when an Appointments trigger has
        // already pinned a specific appointment type).
        const upstreamCtx = upstreamPresetCtxFor(decisionEditorId, nodes, edges)
        const derivedPreset = derivePresetFor(
          upstreamCtx?.slug ?? null,
          upstreamCtx?.nodeId ?? null,
          purchaseConfigs,
          appointmentConfigs,
          pipelineConfigs,
        )
        return (
          <DecisionDiamondEditor
            config={cfg}
            relevantEntities={relevantEntities}
            preset={derivedPreset}
            onChange={(next) =>
              setDecisionConfigs((prev) => {
                const groupId = prev[decisionEditorId]?.forkGroupId
                // For forked siblings, propagate the full rule list to
                // every diamond in the same group so opening any sibling
                // later reflects the latest edits. Each sibling keeps its
                // own forkRuleIndex.
                if (!groupId) {
                  return { ...prev, [decisionEditorId]: next }
                }
                const updated: Record<string, DecisionDiamondConfig> = {}
                for (const [id, c] of Object.entries(prev)) {
                  if (c.forkGroupId === groupId) {
                    updated[id] = {
                      ...c,
                      presetRules: next.presetRules,
                    }
                  } else {
                    updated[id] = c
                  }
                }
                updated[decisionEditorId] = {
                  ...next,
                  forkGroupId: groupId,
                  forkRuleIndex: prev[decisionEditorId]?.forkRuleIndex,
                }
                return updated
              })
            }
            onSave={() => reconcileDiamondAfterSave(decisionEditorId)}
            onClose={() => setDecisionEditorId(null)}
          />
        )
      })()}

      {/* "When a purchase is made" trigger editor — opens automatically when
          the user picks `product-is-purchased` from the "+" picker, and
          re-opens via the action menu's "View and edit". Save commits the
          editor's draft into purchaseConfigs; close-without-save discards. */}
      {purchaseEditorId && purchaseConfigs[purchaseEditorId] && (
        <PurchaseTriggerEditor
          config={purchaseConfigs[purchaseEditorId]}
          onSave={(next) =>
            setPurchaseConfigs((prev) => ({ ...prev, [purchaseEditorId]: next }))
          }
          onClose={() => setPurchaseEditorId(null)}
        />
      )}

      {/* "Appointment" goal editor — auto-opens when the user picks the
          `appointments` trigger from the "+" picker; re-opens via the
          action menu's "View and edit". */}
      {appointmentEditorId && appointmentConfigs[appointmentEditorId] && (
        <AppointmentGoalEditor
          config={appointmentConfigs[appointmentEditorId]}
          onSave={(next) =>
            setAppointmentConfigs((prev) => ({
              ...prev,
              [appointmentEditorId]: next,
            }))
          }
          onClose={() => setAppointmentEditorId(null)}
        />
      )}

      {/* "Pipeline stage move" trigger editor — auto-opens when the user
          picks `pipeline-stage-is-moved` from the "+" picker; re-opens
          via the action menu's "View and edit". */}
      {pipelineEditorId && pipelineConfigs[pipelineEditorId] && (
        <PipelineStageMoveEditor
          config={pipelineConfigs[pipelineEditorId]}
          onSave={(next) =>
            setPipelineConfigs((prev) => ({
              ...prev,
              [pipelineEditorId]: next,
            }))
          }
          onClose={() => setPipelineEditorId(null)}
        />
      )}
    </div>
  )
}
