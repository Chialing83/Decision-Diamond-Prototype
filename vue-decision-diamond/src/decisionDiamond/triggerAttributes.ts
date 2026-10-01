/**
 * Trigger-entity attribute schemas — verbatim mirror of §4 of
 * DECISION-DIAMOND-LOGIC.md (which itself mirrors the Confluence page
 * "Decision diamond 2.0 concepts — Complete Trigger Entity Attribute
 * Reference"). When the Confluence doc drifts, this file follows.
 *
 * Used by DecisionDiamondEditor to scope the field dropdown to only
 * the attributes that the upstream trigger actually exposes. A diamond
 * downstream of `Product is purchased` should never see Pipeline or
 * Appointment fields; a diamond downstream of `Appointment` should
 * never see Payment type; etc.
 *
 * Each entry uses the same `{ id, label, inputType, enum? }` shape the
 * editor already understands for deal fields, so the existing
 * dropdown / operator / value-input rendering paths work unchanged.
 */

/** Trigger slugs that the diamond knows how to scope against.
 *  Other triggers fall through to the legacy Deal field set. */
export type TriggerSlug =
  | 'product-is-purchased'
  | 'quote-status'
  | 'pipeline-stage-is-moved'
  | 'appointments';

export interface TriggerField {
  id: string;
  label: string;
  inputType: 'enum' | 'number' | 'date' | 'text';
  unit?: 'currency';
  enum?: string[];
  /** If set, this field only appears when another field of this same
   *  trigger has been set to the specified value. Mirrors the §4.5
   *  "conditional show/hide" logic from the Confluence doc. */
  conditionalOn?: { fieldId: string; equals: string };
}

/** Field set per trigger. Lookup keys match `BuilderNode.name`. */
export const TRIGGER_FIELDS: Record<TriggerSlug, TriggerField[]> = {
  // §4.1 — Product is purchased
  'product-is-purchased': [
    {
      id: 'product.purchaseType',
      label: 'Purchase type',
      inputType: 'enum',
      enum: ['Product', 'Any purchase'],
    },
    {
      id: 'product.products',
      label: 'Products',
      inputType: 'enum',
      enum: [
        '1 Hour Consult',
        '30 min consult',
        'Expensive Product',
        'Jialing consultation fee 30/60 mins',
      ],
      conditionalOn: { fieldId: 'product.purchaseType', equals: 'Product' },
    },
    {
      id: 'product.paymentType',
      label: 'Payment type',
      inputType: 'enum',
      enum: [
        'Credit Card (charge now)',
        'Credit Card (Manual)',
        'Check',
        'Cash',
        'Money Order',
        'Adjustment',
        'Include $0 invoices',
        'Any payment type',
      ],
    },
  ],

  // §4.2 — Quote status
  'quote-status': [
    {
      id: 'quote.status',
      label: 'Quote status',
      inputType: 'enum',
      enum: ['Sent', 'Viewed', 'Accepted'],
    },
  ],

  // §4.3 — Pipeline stage is moved
  'pipeline-stage-is-moved': [
    {
      id: 'pipeline.direction',
      label: 'Direction',
      inputType: 'enum',
      enum: ['Into', 'Out of'],
    },
    {
      id: 'pipeline.pipeline',
      label: 'Pipeline',
      inputType: 'enum',
      // Real list comes from tenant config; stubbed for the prototype.
      enum: [
        'My Pipeline',
        'Custom pipeline',
        'Sales pipeline',
        'delete stage 2 Custom pipeline',
      ],
    },
    {
      id: 'pipeline.stage',
      label: 'Stage',
      inputType: 'enum',
      // Per the Confluence doc this list is dependent on the selected
      // pipeline. In the prototype we surface the union of all stages
      // from the reference tenant — refinement to per-pipeline stage
      // filtering is a follow-up.
      enum: [
        'New leads',
        'Qualified leads',
        'Quote sent',
        'Negotiating',
        'Quote accepted',
        'Felipe Testing',
        'Felipe Pipeline Test',
        'Felipe Stage Test',
        'Felipe Cant Repro No More',
      ],
    },
  ],

  // §4.4 — Appointment
  appointments: [
    {
      id: 'appointment.event',
      label: 'Appointment event',
      inputType: 'enum',
      enum: ['Schedules', 'Reschedules', 'Cancels'],
    },
    {
      id: 'appointment.type',
      label: 'Appointment type',
      inputType: 'enum',
      // Real list comes from tenant config; stubbed.
      enum: [
        '60-Minute Coaching Call with Jialing Chen (60 minutes)',
        '15-Minute Initial Consultation with Jialing Chen (15 minutes)',
        'Appointment 2 with Marvin Abisrror (2 hours)',
        'Appointment 1 with Miguel Orantes',
      ],
    },
  ],
};

/** True when the given slug corresponds to a trigger we have an
 *  explicit schema for. Used to gate the entity-aware UI — anything
 *  else falls back to the legacy Deal field set. */
export function isKnownTriggerSlug(slug: string | undefined): slug is TriggerSlug {
  return !!slug && slug in TRIGGER_FIELDS;
}

/** Quick lookup — flat map across every trigger's fields, used by the
 *  editor to resolve `cond.field` ids that might come from any
 *  trigger schema (e.g. when the diamond is reopened after the
 *  upstream trigger has changed). */
const FIELD_BY_ID = new Map<string, TriggerField>();
for (const schema of Object.values(TRIGGER_FIELDS)) {
  for (const f of schema) FIELD_BY_ID.set(f.id, f);
}

export function getTriggerField(id: string): TriggerField | undefined {
  return FIELD_BY_ID.get(id);
}
