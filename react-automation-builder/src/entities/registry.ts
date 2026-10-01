// src/entities/registry.ts
//
// Mock object-model registry for the prototype.
// In production this will be served by the engine; here it's static so we
// can demo entity-aware Whens, Thens, and Decision Diamonds end-to-end.
//
// Scope is intentionally vertical-shaped (field-service / trades + light
// healthcare considerations). Add fields as templates demand them; this is
// not a generated schema.

export type FieldType =
  | 'text'
  | 'number'
  | 'currency'
  | 'enum'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'reference' // FK to another entity

export type EntityField = {
  /** Stable id, used as the predicate key. */
  id: string
  /** Human-readable label shown in the rule UI. */
  label: string
  type: FieldType
  /** For type=enum, the allowed values (label-only is fine for the prototype). */
  enum?: string[]
  /** For type=reference, the entity id this points to. */
  references?: EntityId
}

export type EntityEvent = {
  /** Stable id used as the trigger slug for engine routing. */
  id: string
  /** Card label shown in the When picker. */
  label: string
  /** One-line description shown beneath the label in the picker. */
  description: string
  /** Vertical hints — used by recipes and (later) by picker filtering.
   *  Empty array = relevant to all verticals. */
  verticals?: VerticalSlug[]
}

export type EntityAction = {
  id: string
  label: string
  description: string
  verticals?: VerticalSlug[]
}

export type EntityId =
  | 'contact'
  | 'company'
  | 'deal'
  | 'job'
  | 'appointment'
  | 'invoice'

export type EntityDef = {
  id: EntityId
  label: string
  /** Plural label for picker section headers. */
  pluralLabel: string
  /** Single-letter glyph used as an entity badge in the UI. */
  glyph: string
  /** Brand color for chips/badges representing this entity. */
  accentColor: string
  fields: EntityField[]
  /** Engine events emitted on this entity (When triggers). */
  events: EntityEvent[]
  /** Engine actions performed on this entity (Then actions). */
  actions: EntityAction[]
}

/* ---------------------------------------------------------------------------
 * VERTICALS — used to scope recipes / picker filtering. From the validated
 * vertical list (HVAC core + 11 trades + healthcare outlier).
 * ------------------------------------------------------------------------- */
export type VerticalSlug =
  | 'hvac'
  | 'roofing'
  | 'plumbing'
  | 'cleaning'
  | 'healthcare'
  | 'pest'
  | 'auto'
  | 'vet'
  | 'septic'
  | 'tree'
  | 'asphalt'
  | 'moving'

export const VERTICALS: { slug: VerticalSlug; label: string; note?: string }[] = [
  { slug: 'hvac', label: 'Home Services / HVAC', note: 'Core segment' },
  { slug: 'roofing', label: 'Roofers' },
  { slug: 'plumbing', label: 'Plumbers' },
  { slug: 'cleaning', label: 'Cleaners' },
  { slug: 'healthcare', label: 'Healthcare', note: 'HIPAA' },
  { slug: 'pest', label: 'Pest Control' },
  { slug: 'auto', label: 'Auto Repair' },
  { slug: 'vet', label: 'Veterinary' },
  { slug: 'septic', label: 'Septic Tank & Systems' },
  { slug: 'tree', label: 'Tree & Shrub Services' },
  { slug: 'asphalt', label: 'Asphalt & Paving' },
  { slug: 'moving', label: 'Moving & Storage' },
]

/* ---------------------------------------------------------------------------
 * ENTITY DEFINITIONS
 * ------------------------------------------------------------------------- */

const CONTACT: EntityDef = {
  id: 'contact',
  label: 'Contact',
  pluralLabel: 'Contacts',
  glyph: 'C',
  accentColor: '#0EA5E9',
  fields: [
    { id: 'firstName', label: 'First Name', type: 'text' },
    { id: 'lastName', label: 'Last Name', type: 'text' },
    { id: 'email', label: 'Email', type: 'text' },
    { id: 'marketingConsent', label: 'Marketing Consent', type: 'boolean' },
    { id: 'lifecycleStage', label: 'Lifecycle Stage', type: 'enum', enum: ['Lead', 'Customer', 'Lost'] },
    // Repeat-business fields — used by case 6 (repeat-business campaigns).
    { id: 'totalOrders', label: 'Total Orders', type: 'number' },
    { id: 'lifetimeValue', label: 'Lifetime Value', type: 'currency' },
    { id: 'lastOrderDate', label: 'Last Order Date', type: 'date' },
    { id: 'daysSinceLastOrder', label: 'Days Since Last Order', type: 'number' },
  ],
  // Most contact triggers live in the legacy "When" catalog. Listed here for
  // completeness once the engine unifies them.
  events: [],
  actions: [
    { id: 'addTag', label: 'Add tag', description: 'Add a tag to the contact' },
    { id: 'removeTag', label: 'Remove tag', description: 'Remove a tag from the contact' },
    { id: 'updateField', label: 'Update contact field', description: 'Set a value on the contact' },
    {
      id: 'startSequence',
      label: 'Start a sequence',
      description: 'Enroll the contact in another sequence (e.g. review request).',
    },
    {
      id: 'sendEmail',
      label: 'Send email',
      description: 'Send a one-off email — useful for follow-ups and confirmations.',
    },
    {
      id: 'sendSms',
      label: 'Send SMS',
      description: 'Send a one-off SMS message.',
    },
  ],
}

const COMPANY: EntityDef = {
  id: 'company',
  label: 'Company',
  pluralLabel: 'Companies',
  glyph: 'B',
  accentColor: '#7C3AED',
  fields: [
    { id: 'name', label: 'Name', type: 'text' },
    { id: 'industry', label: 'Industry', type: 'text' },
    { id: 'lostDealsLast6mo', label: 'Lost Deals (last 6mo)', type: 'number' },
    { id: 'totalRevenue', label: 'Total Revenue', type: 'currency' },
  ],
  events: [
    {
      id: 'company.created',
      label: 'Company is created',
      description: 'Fires once when a new company record is created.',
    },
    {
      id: 'company.lostDealsThreshold',
      label: 'Company hits lost-deal threshold',
      description: '3+ lost deals from the same company in a rolling window.',
    },
  ],
  actions: [
    { id: 'updateCompany', label: 'Update company field', description: 'Set a value on the company' },
    {
      id: 'notifyOwner',
      label: 'Notify account owner',
      description: 'Internal notification or task — used for review escalations.',
    },
    {
      id: 'createInternalReviewTask',
      label: 'Create internal review task',
      description: 'Open a task for the team (e.g. when 3+ deals lost in 6mo).',
    },
  ],
}

const DEAL: EntityDef = {
  id: 'deal',
  label: 'Deal',
  pluralLabel: 'Deals',
  glyph: 'D',
  accentColor: '#16A34A',
  fields: [
    {
      id: 'stage',
      label: 'Stage',
      type: 'enum',
      enum: ['New', 'Qualified', 'Estimate Sent', 'Estimate Signed', 'Scheduled', 'Won', 'Lost'],
    },
    { id: 'amount', label: 'Amount', type: 'currency' },
    { id: 'pipeline', label: 'Pipeline', type: 'text' },
    { id: 'owner', label: 'Owner', type: 'text' },
    { id: 'responseStatus', label: 'Response Status', type: 'enum', enum: ['No response', 'Replied', 'Booked'] },
    // Estimate / stage age — used by case 4 (estimate expiration follow-up)
    // and any "deal sat in stage X for N days" branching pattern.
    { id: 'daysInStage', label: 'Days in Current Stage', type: 'number' },
    { id: 'stageEnteredAt', label: 'Stage Entered At', type: 'date' },
    { id: 'company', label: 'Company', type: 'reference', references: 'company' },
  ],
  events: [
    {
      id: 'deal.stageChanged',
      label: 'Deal stage changes',
      description: 'Fires whenever a deal moves to a new stage. Branch on the new stage downstream.',
    },
    {
      id: 'deal.estimateSent',
      label: 'Estimate sent',
      description: 'Specific stage transition — convenience trigger for follow-up campaigns.',
      verticals: ['hvac', 'roofing', 'plumbing', 'septic', 'tree', 'asphalt', 'moving'],
    },
    {
      id: 'deal.estimateStale',
      label: 'Estimate sent, no response in N days',
      description: 'Time-anchored trigger for follow-up. Default N=3.',
      verticals: ['hvac', 'roofing', 'plumbing', 'septic', 'tree', 'asphalt', 'moving'],
    },
    {
      id: 'deal.won',
      label: 'Deal won',
      description: 'Stage moves to Won. Common entry point for onboarding sequences.',
    },
    {
      id: 'deal.lost',
      label: 'Deal lost',
      description: 'Stage moves to Lost. Hand-off point to win-back campaigns.',
    },
  ],
  actions: [
    { id: 'createDeal', label: 'Create a deal', description: 'Open a new deal in the chosen pipeline' },
    { id: 'updateDealStage', label: 'Move deal to stage', description: 'Set the deal’s stage' },
    { id: 'updateDealField', label: 'Update deal field', description: 'Set any field on the deal' },
  ],
}

const JOB: EntityDef = {
  id: 'job',
  label: 'Job',
  pluralLabel: 'Jobs',
  glyph: 'J',
  accentColor: '#EA580C',
  fields: [
    {
      id: 'status',
      label: 'Status',
      type: 'enum',
      enum: ['Scheduled', 'In progress', 'Completed', 'Cancelled'],
    },
    { id: 'serviceTier', label: 'Service Tier', type: 'enum', enum: ['Maintenance', 'Repair', 'Install'] },
    { id: 'tech', label: 'Assigned Tech', type: 'text' },
    { id: 'completedAt', label: 'Completed At', type: 'datetime' },
    { id: 'deal', label: 'Deal', type: 'reference', references: 'deal' },
  ],
  events: [
    {
      id: 'job.created',
      label: 'Job created',
      description: 'A new job is scheduled. Common kickoff for prep / dispatch campaigns.',
    },
    {
      id: 'job.completed',
      label: 'Job completed',
      description: 'Tech marks the job done. Typical entry point for review-request and re-engagement.',
    },
    {
      id: 'job.cancelled',
      label: 'Job cancelled',
      description: 'Branch downstream on cancellation reason if present.',
    },
  ],
  actions: [
    { id: 'updateJobStatus', label: 'Update job status', description: 'Change the job’s status' },
    { id: 'assignTech', label: 'Assign tech', description: 'Assign or reassign a technician' },
  ],
}

const APPOINTMENT: EntityDef = {
  id: 'appointment',
  label: 'Appointment',
  pluralLabel: 'Appointments',
  glyph: 'A',
  accentColor: '#DB2777',
  fields: [
    {
      id: 'status',
      label: 'Status',
      type: 'enum',
      enum: ['Scheduled', 'Completed', 'No-show', 'Cancelled', 'Rescheduled'],
    },
    {
      id: 'type',
      label: 'Type',
      type: 'enum',
      enum: ['Maintenance Tune-Up', 'Repair', 'Install', 'Estimate', 'Consultation'],
    },
    { id: 'date', label: 'Date', type: 'date' },
    { id: 'tech', label: 'Tech', type: 'text' },
    { id: 'duration', label: 'Duration (minutes)', type: 'number' },
    // Cross-entity references — let cards on an Appointment-bound diamond
    // also test the linked deal (case 3: stage='Scheduled' AND date=tomorrow).
    { id: 'deal', label: 'Deal', type: 'reference', references: 'deal' },
    { id: 'job', label: 'Job', type: 'reference', references: 'job' },
  ],
  events: [
    {
      id: 'appointment.scheduled',
      label: 'Appointment is scheduled',
      description: 'New appointment created. Trigger confirmations and prep reminders.',
    },
    {
      id: 'appointment.completed',
      label: 'Appointment is completed',
      description: 'Most-used trigger for trades — entry to review requests and follow-ups.',
    },
    {
      id: 'appointment.noShow',
      label: 'Appointment no-show',
      description: 'Customer didn’t show. Branch to re-engagement vs internal escalation.',
      verticals: ['auto', 'vet', 'healthcare', 'hvac', 'plumbing'],
    },
    {
      id: 'appointment.cancelled',
      label: 'Appointment cancelled',
      description: 'Cancellation event. Branch on reason if collected.',
    },
    {
      id: 'appointment.tomorrow',
      label: 'Appointment is tomorrow',
      description: 'Daily-eval trigger for next-day confirmations.',
    },
  ],
  actions: [
    { id: 'sendConfirmation', label: 'Send appointment confirmation', description: 'Email/SMS confirmation' },
    { id: 'rescheduleAppointment', label: 'Reschedule appointment', description: 'Move to a new date/time' },
  ],
}

const INVOICE: EntityDef = {
  id: 'invoice',
  label: 'Invoice',
  pluralLabel: 'Invoices',
  glyph: 'I',
  accentColor: '#CA8A04',
  fields: [
    {
      id: 'status',
      label: 'Status',
      type: 'enum',
      enum: ['Draft', 'Sent', 'Paid', 'Partial', 'Past due', 'Void'],
    },
    { id: 'total', label: 'Total', type: 'currency' },
    { id: 'balance', label: 'Balance', type: 'currency' },
    { id: 'dueDate', label: 'Due Date', type: 'date' },
    { id: 'job', label: 'Job', type: 'reference', references: 'job' },
  ],
  events: [
    {
      id: 'invoice.sent',
      label: 'Invoice is sent',
      description: 'Invoice issued to customer. Trigger payment-reminder cadences.',
    },
    {
      id: 'invoice.paid',
      label: 'Invoice is paid',
      description: 'Payment received. Common bridge to thank-you / review-request.',
    },
    {
      id: 'invoice.pastDue',
      label: 'Invoice is past due',
      description: 'Balance is non-zero past the due date. Branch on days-past-due downstream.',
    },
  ],
  actions: [
    { id: 'createInvoice', label: 'Create an invoice', description: 'Generate a new invoice for the contact / job' },
    { id: 'sendInvoiceReminder', label: 'Send invoice reminder', description: 'Push a payment reminder' },
  ],
}

export const ENTITIES: Record<EntityId, EntityDef> = {
  contact: CONTACT,
  company: COMPANY,
  deal: DEAL,
  job: JOB,
  appointment: APPOINTMENT,
  invoice: INVOICE,
}

/** Order entities are shown in pickers and recipe filters. */
export const ENTITY_ORDER: EntityId[] = [
  'deal',
  'appointment',
  'job',
  'invoice',
  'company',
  'contact',
]

/* ---------------------------------------------------------------------------
 * FLATTENED HELPERS
 * ------------------------------------------------------------------------- */

export type FlatEntityEvent = EntityEvent & {
  entityId: EntityId
  entityLabel: string
  entityGlyph: string
  entityColor: string
}

export type FlatEntityAction = EntityAction & {
  entityId: EntityId
  entityLabel: string
  entityGlyph: string
  entityColor: string
}

/** All entity events as a flat list, in registry order. Used by the When
 *  picker's "Entity events" tab. */
export function listEntityEvents(): FlatEntityEvent[] {
  return ENTITY_ORDER.flatMap((id) => {
    const e = ENTITIES[id]
    return e.events.map((ev) => ({
      ...ev,
      entityId: e.id,
      entityLabel: e.label,
      entityGlyph: e.glyph,
      entityColor: e.accentColor,
    }))
  })
}

/** All entity actions as a flat list. Used by the Then picker's
 *  "Entity actions" tab. */
export function listEntityActions(): FlatEntityAction[] {
  return ENTITY_ORDER.flatMap((id) => {
    const e = ENTITIES[id]
    return e.actions.map((ac) => ({
      ...ac,
      entityId: e.id,
      entityLabel: e.label,
      entityGlyph: e.glyph,
      entityColor: e.accentColor,
    }))
  })
}
