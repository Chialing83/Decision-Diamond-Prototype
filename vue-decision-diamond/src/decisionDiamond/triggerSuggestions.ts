/**
 * CRM-relevant decision-diamond suggestions per trigger entity.
 *
 * Each `TriggerSuggestion` is a starter template the AI assistant can
 * surface on the welcome screen when a known trigger is connected
 * upstream. The structure mirrors the editor's existing `Suggestion`
 * type so the apply-suggestion flow doesn't need a separate code path.
 *
 * Each `TriggerSmartPill` is a one-click condition the AI picker can
 * offer when the user clicks "+ Add another condition (AND)" — scoped
 * to the connected trigger's attributes so the pill is always
 * relevant to what the upstream automation actually carries.
 *
 * Source: the four trigger types in DECISION-DIAMOND-LOGIC.md §4
 * crossed with common SMB CRM patterns (HVAC, plumbing, dental, etc.
 * per the ICP work captured in §4 of the spec).
 */

import type { TriggerSlug } from './triggerAttributes';

// -------------------------------------------------------------------
// Types (kept structurally compatible with the editor's existing
// Suggestion shape so application logic is unchanged).
// -------------------------------------------------------------------

export interface TriggerSuggestionStep {
  title: string;
  decision: string;
  suggestedNext: string;
}

export interface TriggerSuggestionMessage {
  title: string;
  lead: string;
  whenTitle: string;
  whenBody: string;
  thenSteps: TriggerSuggestionStep[];
}

export interface TriggerSuggestionRule {
  sequenceIndex: number;
  field: string;
  operator: string;
  values: string[];
  /** Additional AND-conditions placed in the SAME block as the primary
   *  condition above. Used by pipeline / product templates that need
   *  e.g. `Direction equals Into AND Stage equals Quote accepted`. */
  additional?: Array<{ field: string; operator: string; values: string[] }>;
}

export interface TriggerSuggestion {
  id: string;
  title: string;
  category: string;
  description: string;
  message: TriggerSuggestionMessage;
  rules: TriggerSuggestionRule[];
}

export interface TriggerSmartPill {
  field: string;
  operator: string;
  values: string[];
  label: string;
}

// -------------------------------------------------------------------
// Product is purchased — purchase-type / payment-type branching
// -------------------------------------------------------------------

const PRODUCT_SUGGESTIONS: TriggerSuggestion[] = [
  {
    id: 'productCardChargeVsOther',
    title: 'Card-charged vs manual payment',
    category: 'Payment type',
    description:
      'Route credit-card-charged orders into the standard delivery flow and flag manual tenders for owner review.',
    message: {
      title: 'Card-charged vs manual payment',
      lead: 'Split incoming purchases by payment type so card-charged orders ship immediately while Check / Cash / Money Order purchases go to a human-review path.',
      whenTitle: 'When a product is purchased',
      whenBody:
        'This starts the automation any time a purchase is recorded, then evaluates how the customer paid.',
      thenSteps: [
        {
          title: 'Card-charged branch',
          decision:
            'If Payment type equals Credit Card (charge now) → Sequence 1.',
          suggestedNext:
            'Automated receipt + fulfillment hand-off + post-purchase onboarding.',
        },
        {
          title: 'Manual-payment branch',
          decision:
            'If Payment type equals Check → Sequence 2.',
          suggestedNext:
            'Notify the owner to confirm payment, then continue onboarding after confirmation.',
        },
      ],
    },
    rules: [
      {
        sequenceIndex: 0,
        field: 'product.paymentType',
        operator: 'equals',
        values: ['Credit Card (charge now)'],
      },
      {
        sequenceIndex: 1,
        field: 'product.paymentType',
        operator: 'equals',
        values: ['Check'],
      },
    ],
  },
  {
    id: 'productSignatureVsAny',
    title: 'Signature product vs any other purchase',
    category: 'Purchase type',
    description:
      'Branch a specific high-margin product (e.g. Expensive Product) into a premium track; everything else into the default flow.',
    message: {
      title: 'Signature product vs any other purchase',
      lead: 'Route purchases of a specific signature product into a premium onboarding while any other purchase rides the default path.',
      whenTitle: 'When a product is purchased',
      whenBody:
        'Fires on any purchase, then checks both the purchase type and which specific product was bought.',
      thenSteps: [
        {
          title: 'Signature product branch',
          decision:
            'If Purchase type equals Product AND Products equals Expensive Product → Sequence 1.',
          suggestedNext:
            'Personal welcome from a senior account manager + premium onboarding cadence.',
        },
        {
          title: 'Any other purchase',
          decision:
            'If Purchase type equals Any purchase → Sequence 2.',
          suggestedNext:
            'Standard receipt + nurture sequence with cross-sell at day 14.',
        },
      ],
    },
    rules: [
      {
        sequenceIndex: 0,
        field: 'product.purchaseType',
        operator: 'equals',
        values: ['Product'],
        additional: [
          {
            field: 'product.products',
            operator: 'equals',
            values: ['Expensive Product'],
          },
        ],
      },
      {
        sequenceIndex: 1,
        field: 'product.purchaseType',
        operator: 'equals',
        values: ['Any purchase'],
      },
    ],
  },
];

const PRODUCT_SMART_PILLS: TriggerSmartPill[] = [
  {
    field: 'product.purchaseType',
    operator: 'equals',
    values: ['Product'],
    label: 'Purchase type equals Product',
  },
  {
    field: 'product.paymentType',
    operator: 'equals',
    values: ['Credit Card (charge now)'],
    label: 'Payment type equals Credit Card (charge now)',
  },
  {
    field: 'product.paymentType',
    operator: 'equals',
    values: ['Adjustment'],
    label: 'Payment type equals Adjustment',
  },
];

// -------------------------------------------------------------------
// Quote status — quote lifecycle stages
// -------------------------------------------------------------------

const QUOTE_SUGGESTIONS: TriggerSuggestion[] = [
  {
    id: 'quoteLifecycle',
    title: 'Quote lifecycle nudges',
    category: 'Quote status',
    description:
      'Different follow-up cadences for sent vs. viewed vs. accepted quotes.',
    message: {
      title: 'Quote lifecycle nudges',
      lead: 'Branch on where the quote is in its lifecycle so prospects get the right nudge — gentle reminders for sent quotes, urgency for viewed-but-not-accepted, and immediate onboarding when accepted.',
      whenTitle: 'When the quote status changes',
      whenBody:
        'Each change to the quote\'s status (Sent, Viewed, Accepted) re-enters this diamond.',
      thenSteps: [
        {
          title: 'Sent branch',
          decision: 'If Quote status equals Sent → Sequence 1.',
          suggestedNext:
            'A 2-day and 5-day reminder email, then a phone task on day 7.',
        },
        {
          title: 'Viewed branch',
          decision: 'If Quote status equals Viewed → Sequence 2.',
          suggestedNext:
            'A same-day urgency email with social proof + a discount on day 3.',
        },
        {
          title: 'Accepted branch',
          decision: 'If Quote status equals Accepted → Sequence 3.',
          suggestedNext:
            'Immediate invoice + welcome sequence + scheduling link.',
        },
      ],
    },
    rules: [
      {
        sequenceIndex: 0,
        field: 'quote.status',
        operator: 'equals',
        values: ['Sent'],
      },
      {
        sequenceIndex: 1,
        field: 'quote.status',
        operator: 'equals',
        values: ['Viewed'],
      },
      {
        sequenceIndex: 2,
        field: 'quote.status',
        operator: 'equals',
        values: ['Accepted'],
      },
    ],
  },
  {
    id: 'quoteAcceptedVsLost',
    title: 'Accepted vs not accepted',
    category: 'Quote status',
    description:
      'Send accepted quotes straight to fulfillment; route everyone else into a recovery sequence.',
    message: {
      title: 'Accepted vs not accepted',
      lead: 'Cleanly separate the converted quotes from the ones that need more nurturing.',
      whenTitle: 'When the quote status changes',
      whenBody:
        'Triggers each time a quote moves between Sent / Viewed / Accepted.',
      thenSteps: [
        {
          title: 'Accepted branch',
          decision: 'If Quote status equals Accepted → Sequence 1.',
          suggestedNext: 'Invoice + welcome + scheduling.',
        },
        {
          title: 'Not-yet-accepted branch',
          decision: 'If Quote status equals Viewed → Sequence 2.',
          suggestedNext: 'Reminder cadence with an offer escalation at day 7.',
        },
      ],
    },
    rules: [
      {
        sequenceIndex: 0,
        field: 'quote.status',
        operator: 'equals',
        values: ['Accepted'],
      },
      {
        sequenceIndex: 1,
        field: 'quote.status',
        operator: 'equals',
        values: ['Viewed'],
      },
    ],
  },
];

const QUOTE_SMART_PILLS: TriggerSmartPill[] = [
  {
    field: 'quote.status',
    operator: 'equals',
    values: ['Accepted'],
    label: 'Quote status equals Accepted',
  },
  {
    field: 'quote.status',
    operator: 'equals',
    values: ['Viewed'],
    label: 'Quote status equals Viewed',
  },
  {
    field: 'quote.status',
    operator: 'equals',
    values: ['Sent'],
    label: 'Quote status equals Sent',
  },
];

// -------------------------------------------------------------------
// Pipeline stage is moved — won/lost/qualified routing
// -------------------------------------------------------------------

const PIPELINE_SUGGESTIONS: TriggerSuggestion[] = [
  {
    id: 'pipelineAcceptedVsNegotiating',
    title: 'Quote accepted vs still negotiating',
    category: 'Pipeline stage',
    description:
      'Celebrate deals that move INTO Quote accepted; nudge deals that stalled in Negotiating with a recovery cadence.',
    message: {
      title: 'Quote accepted vs still negotiating',
      lead: 'Fork on whether the deal landed in Quote accepted or got stuck in Negotiating, so each outcome triggers the right downstream actions.',
      whenTitle: 'When a deal moves between pipeline stages',
      whenBody:
        'Fires every time a deal advances to a new pipeline stage; the diamond inspects the direction of the move and the resulting stage.',
      thenSteps: [
        {
          title: 'Quote-accepted branch',
          decision: 'If Direction equals Into AND Stage equals Quote accepted → Sequence 1.',
          suggestedNext:
            'Send the success email, kick off fulfillment, request a review at day 7.',
        },
        {
          title: 'Still-negotiating branch',
          decision: 'If Direction equals Into AND Stage equals Negotiating → Sequence 2.',
          suggestedNext:
            'Trigger a recovery cadence + assign the deal owner a callback task.',
        },
      ],
    },
    rules: [
      {
        sequenceIndex: 0,
        field: 'pipeline.direction',
        operator: 'equals',
        values: ['Into'],
        additional: [
          {
            field: 'pipeline.stage',
            operator: 'equals',
            values: ['Quote accepted'],
          },
        ],
      },
      {
        sequenceIndex: 1,
        field: 'pipeline.direction',
        operator: 'equals',
        values: ['Into'],
        additional: [
          {
            field: 'pipeline.stage',
            operator: 'equals',
            values: ['Negotiating'],
          },
        ],
      },
    ],
  },
  {
    id: 'pipelineQualifiedRouting',
    title: 'Qualified vs new leads routing',
    category: 'Pipeline stage',
    description:
      'Send deals moving INTO Qualified leads to a discovery cadence; deals entering New leads start in nurture.',
    message: {
      title: 'Qualified vs new leads routing',
      lead: 'Pick the right cadence for newly qualified deals versus everyone still at the top of funnel — both branches require Direction equals Into so we react only to forward movement.',
      whenTitle: 'When a deal moves between pipeline stages',
      whenBody:
        'Fires whenever a deal\'s stage changes. The diamond checks the direction so we only react to forward progression.',
      thenSteps: [
        {
          title: 'Qualified branch',
          decision: 'If Direction equals Into AND Stage equals Qualified leads → Sequence 1.',
          suggestedNext:
            'Owner-assigned discovery call + tailored case study email.',
        },
        {
          title: 'New leads branch',
          decision: 'If Direction equals Into AND Stage equals New leads → Sequence 2.',
          suggestedNext: 'Educational nurture sequence + scoring updates.',
        },
      ],
    },
    rules: [
      {
        sequenceIndex: 0,
        field: 'pipeline.direction',
        operator: 'equals',
        values: ['Into'],
        additional: [
          {
            field: 'pipeline.stage',
            operator: 'equals',
            values: ['Qualified leads'],
          },
        ],
      },
      {
        sequenceIndex: 1,
        field: 'pipeline.direction',
        operator: 'equals',
        values: ['Into'],
        additional: [
          {
            field: 'pipeline.stage',
            operator: 'equals',
            values: ['New leads'],
          },
        ],
      },
    ],
  },
];

const PIPELINE_SMART_PILLS: TriggerSmartPill[] = [
  {
    field: 'pipeline.stage',
    operator: 'equals',
    values: ['Quote accepted'],
    label: 'Stage equals Quote accepted',
  },
  {
    field: 'pipeline.stage',
    operator: 'equals',
    values: ['Qualified leads'],
    label: 'Stage equals Qualified leads',
  },
  {
    field: 'pipeline.direction',
    operator: 'equals',
    values: ['Into'],
    label: 'Direction equals Into',
  },
];

// -------------------------------------------------------------------
// Appointment — schedule / reschedule / cancel handling
// -------------------------------------------------------------------

const APPOINTMENT_SUGGESTIONS: TriggerSuggestion[] = [
  {
    id: 'appointmentLifecycle',
    title: 'Appointment lifecycle handling',
    category: 'Appointment event',
    description:
      'Confirm new bookings, smooth reschedules, and recover cancellations — each gets its own cadence.',
    message: {
      title: 'Appointment lifecycle handling',
      lead: 'Different cadences for the three appointment events — Schedules, Reschedules, Cancels — so nobody gets a wrong-time reminder and cancellations get a recovery offer.',
      whenTitle: 'When a contact changes their appointment',
      whenBody:
        'Triggers on any Schedule / Reschedule / Cancel event and forks on which one happened.',
      thenSteps: [
        {
          title: 'Newly scheduled',
          decision: 'If Appointment event equals Schedules → Sequence 1.',
          suggestedNext:
            'Send confirmation, calendar invite, and a 24-hour reminder.',
        },
        {
          title: 'Rescheduled',
          decision: 'If Appointment event equals Reschedules → Sequence 2.',
          suggestedNext:
            'Send updated confirmation, cancel old reminders, schedule new ones.',
        },
        {
          title: 'Cancelled',
          decision: 'If Appointment event equals Cancels → Sequence 3.',
          suggestedNext:
            'Send a recovery email with a re-book link + feedback survey.',
        },
      ],
    },
    rules: [
      {
        sequenceIndex: 0,
        field: 'appointment.event',
        operator: 'equals',
        values: ['Schedules'],
      },
      {
        sequenceIndex: 1,
        field: 'appointment.event',
        operator: 'equals',
        values: ['Reschedules'],
      },
      {
        sequenceIndex: 2,
        field: 'appointment.event',
        operator: 'equals',
        values: ['Cancels'],
      },
    ],
  },
  {
    id: 'appointmentInitialConsultVsOther',
    title: 'Initial consult booked vs other appointment',
    category: 'Appointment type',
    description:
      'Treat newly-booked initial consultations differently from any other appointment booking.',
    message: {
      title: 'Initial consult booked vs other appointment',
      lead: 'Newly-booked initial consultations get a discovery-focused cadence; other appointment types ride the standard confirmation flow.',
      whenTitle: 'When a contact schedules an appointment',
      whenBody:
        'Triggers on every Schedules event and inspects which appointment type was booked.',
      thenSteps: [
        {
          title: 'Initial consult branch',
          decision:
            'If Appointment event equals Schedules AND Appointment type equals 15-Minute Initial Consultation with Jialing Chen (15 minutes) → Sequence 1.',
          suggestedNext:
            'Discovery questionnaire + prep email + 24-hour reminder + post-call follow-up task.',
        },
        {
          title: 'Other appointment branch',
          decision:
            'If Appointment event equals Schedules → Sequence 2.',
          suggestedNext: 'Standard confirmation + calendar invite + reminder.',
        },
      ],
    },
    rules: [
      {
        sequenceIndex: 0,
        field: 'appointment.event',
        operator: 'equals',
        values: ['Schedules'],
        additional: [
          {
            field: 'appointment.type',
            operator: 'equals',
            values: [
              '15-Minute Initial Consultation with Jialing Chen (15 minutes)',
            ],
          },
        ],
      },
      {
        sequenceIndex: 1,
        field: 'appointment.event',
        operator: 'equals',
        values: ['Schedules'],
      },
    ],
  },
];

const APPOINTMENT_SMART_PILLS: TriggerSmartPill[] = [
  {
    field: 'appointment.event',
    operator: 'equals',
    values: ['Schedules'],
    label: 'Appointment event equals Schedules',
  },
  {
    field: 'appointment.event',
    operator: 'equals',
    values: ['Cancels'],
    label: 'Appointment event equals Cancels',
  },
  {
    field: 'appointment.event',
    operator: 'equals',
    values: ['Reschedules'],
    label: 'Appointment event equals Reschedules',
  },
];

// -------------------------------------------------------------------
// Public maps
// -------------------------------------------------------------------

export const TRIGGER_SUGGESTIONS: Record<TriggerSlug, TriggerSuggestion[]> = {
  'product-is-purchased': PRODUCT_SUGGESTIONS,
  'quote-status': QUOTE_SUGGESTIONS,
  'pipeline-stage-is-moved': PIPELINE_SUGGESTIONS,
  appointments: APPOINTMENT_SUGGESTIONS,
};

export const TRIGGER_SMART_PILLS: Record<TriggerSlug, TriggerSmartPill[]> = {
  'product-is-purchased': PRODUCT_SMART_PILLS,
  'quote-status': QUOTE_SMART_PILLS,
  'pipeline-stage-is-moved': PIPELINE_SMART_PILLS,
  appointments: APPOINTMENT_SMART_PILLS,
};
