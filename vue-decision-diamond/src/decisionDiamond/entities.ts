// Mock object-model registry for the prototype.
// Ported verbatim from keap-prototype-x/src/entities/registry.ts.

export type FieldType =
  | 'text'
  | 'number'
  | 'currency'
  | 'enum'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'reference';

export type EntityField = {
  id: string;
  label: string;
  type: FieldType;
  enum?: string[];
  references?: EntityId;
};

export type EntityEvent = {
  id: string;
  label: string;
  description: string;
  verticals?: VerticalSlug[];
};

export type EntityAction = {
  id: string;
  label: string;
  description: string;
  verticals?: VerticalSlug[];
};

export type EntityId =
  | 'contact'
  | 'company'
  | 'deal'
  | 'job'
  | 'appointment'
  | 'invoice';

export type EntityDef = {
  id: EntityId;
  label: string;
  pluralLabel: string;
  glyph: string;
  accentColor: string;
  fields: EntityField[];
  events: EntityEvent[];
  actions: EntityAction[];
};

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
  | 'moving';

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
    {
      id: 'lifecycleStage',
      label: 'Lifecycle Stage',
      type: 'enum',
      enum: ['Lead', 'Customer', 'Lost'],
    },
    { id: 'totalOrders', label: 'Total Orders', type: 'number' },
    { id: 'lifetimeValue', label: 'Lifetime Value', type: 'currency' },
    { id: 'lastOrderDate', label: 'Last Order Date', type: 'date' },
    { id: 'daysSinceLastOrder', label: 'Days Since Last Order', type: 'number' },
  ],
  events: [],
  actions: [],
};

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
  events: [],
  actions: [],
};

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
      enum: [
        'New',
        'Qualified',
        'Estimate Sent',
        'Estimate Signed',
        'Scheduled',
        'Won',
        'Lost',
      ],
    },
    { id: 'amount', label: 'Amount', type: 'currency' },
    { id: 'pipeline', label: 'Pipeline', type: 'text' },
    { id: 'owner', label: 'Owner', type: 'text' },
    {
      id: 'responseStatus',
      label: 'Response Status',
      type: 'enum',
      enum: ['No response', 'Replied', 'Booked'],
    },
    { id: 'daysInStage', label: 'Days in Current Stage', type: 'number' },
    { id: 'stageEnteredAt', label: 'Stage Entered At', type: 'date' },
    {
      id: 'company',
      label: 'Company',
      type: 'reference',
      references: 'company',
    },
  ],
  events: [],
  actions: [],
};

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
    {
      id: 'serviceTier',
      label: 'Service Tier',
      type: 'enum',
      enum: ['Maintenance', 'Repair', 'Install'],
    },
    { id: 'tech', label: 'Assigned Tech', type: 'text' },
    { id: 'completedAt', label: 'Completed At', type: 'datetime' },
    { id: 'deal', label: 'Deal', type: 'reference', references: 'deal' },
  ],
  events: [],
  actions: [],
};

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
    { id: 'deal', label: 'Deal', type: 'reference', references: 'deal' },
    { id: 'job', label: 'Job', type: 'reference', references: 'job' },
  ],
  events: [],
  actions: [],
};

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
  events: [],
  actions: [],
};

export const ENTITIES: Record<EntityId, EntityDef> = {
  contact: CONTACT,
  company: COMPANY,
  deal: DEAL,
  job: JOB,
  appointment: APPOINTMENT,
  invoice: INVOICE,
};

/** Order entities are shown in pickers and recipe filters. */
export const ENTITY_ORDER: EntityId[] = [
  'deal',
  'appointment',
  'job',
  'invoice',
  'company',
  'contact',
];

/** Map of legacy automationIcons.json slugs → the entities each implies. */
export const SLUG_TO_ENTITIES: Record<string, EntityId[]> = {
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
};

export function entitiesForNodeName(
  name: string | undefined,
): EntityId[] {
  if (!name) return [];
  if (name.startsWith('entity:')) {
    const rest = name.slice(7);
    const entityId = rest.split('.')[0] as EntityId;
    return ENTITIES[entityId] ? [entityId] : [];
  }
  return SLUG_TO_ENTITIES[name] ?? [];
}
