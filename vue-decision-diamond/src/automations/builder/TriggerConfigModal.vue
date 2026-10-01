<template>
  <div
    class="tc-overlay"
    role="presentation"
    @mousedown.self="$emit('close')"
    @keydown.esc="$emit('close')"
  >
    <div
      ref="rootEl"
      class="tc-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tc-title"
      tabindex="-1"
    >
      <header class="tc-modal__header">
        <DexIconButton
          name="x"
          label="Close"
          @click="$emit('close')"
        />
        <DexText id="tc-title" variant="heading-3" as="h2">
          {{ title }}
        </DexText>
      </header>

      <div class="tc-modal__body">
        <!-- ===========================================================
             Pipeline stage move — custom layout per the trigger spec.
             Three dependent dropdowns ("When moving" → "Pipeline" →
             "Stage"), a blue info notice, and value/id-keyed option
             rendering so analytics can target items by stable id.
             =========================================================== -->
        <template v-if="slug === 'pipeline-stage-is-moved'">
          <p class="tc-modal__lead">
            Trigger automation when a deal is moved into or out of a particular
            stage within a pipeline.
          </p>

          <div class="tc-modal__form">
            <PipelineDropdown
              id="psm-direction"
              label="When moving"
              :options="DIRECTION_OPTIONS"
              :value="draft.direction"
              placeholder="Select"
              required
              @update:value="onChange('direction', $event)"
            />

            <PipelineDropdown
              id="psm-pipeline"
              label="Pipeline"
              :options="PIPELINE_OPTIONS"
              :value="draft.pipeline"
              placeholder="Select"
              required
              @update:value="onPipelineChange"
            />

            <PipelineDropdown
              id="psm-stage"
              label="Stage"
              :options="stageOptions"
              :value="draft.stage"
              :disabled="!draft.pipeline"
              :placeholder="draft.pipeline ? 'Select' : 'Select a pipeline first'"
              required
              @update:value="onChange('stage', $event)"
            />
          </div>

          <!-- Info notice sits AFTER the form fields per the trigger
               spec — it's contextual reading once the user has the
               dropdowns in view, not a blocker above them. -->
          <div class="tc-info" role="note">
            <DexIcon name="info" class="tc-info__icon" aria-hidden="true" />
            <div class="tc-info__body">
              <p class="tc-info__text">
                Automations will not be triggered when a deal is created in
                this stage. To trigger based on a deal's starting stage, select
                "Deal enters stage" in Easy Automations.
              </p>
              <a
                class="tc-info__link"
                href="https://learn.thryv.com/hc/en-us/articles/40570771502605-Pipeline-Stage-Moved-Automation"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn more
              </a>
            </div>
          </div>
        </template>

        <!-- ===========================================================
             Product is purchased — "When a purchase is made". Three
             fields with a v-if dependency: Field 2 (Select products)
             only renders when Field 1 == 'Product'. No info notice.
             =========================================================== -->
        <template v-else-if="slug === 'product-is-purchased'">
          <span class="tc-section-caption">Summary</span>
          <p class="tc-modal__lead">
            Add or remove a contact from a sequence based on a purchase
            they've made.
          </p>

          <div class="tc-modal__form">
            <PurchaseTypeDropdown
              id="prod-purchaseType"
              label="Select purchase type"
              :options="PURCHASE_TYPE_OPTIONS"
              :value="draft.purchaseType"
              placeholder="Select"
              @update:value="onPurchaseTypeChange"
            />

            <!-- v-if (not v-show): the field is removed from the DOM
                 when "Any purchase" is selected, per spec. -->
            <SearchableMultiSelect
              v-if="draft.purchaseType === 'Product'"
              id="prod-products"
              label="Select products"
              :options="productsSearchResults"
              :value="productsSelected"
              placeholder="Select"
              search-placeholder="Search products"
              empty-message="Start typing to search products"
              require-query
              @update:value="onProductsChange"
              @update:query="(q) => (productsQuery = q)"
            />

            <span class="tc-static-text">
              and only run on selected payment types
            </span>

            <SearchableMultiSelect
              id="prod-paymentType"
              label="Payment type"
              :options="PAYMENT_TYPE_OPTIONS"
              :value="paymentTypesSelected"
              placeholder="Select"
              search-placeholder="Search payment types"
              empty-message="No matching payment types"
              @update:value="onPaymentTypesChange"
            />
          </div>
        </template>

        <!-- ===========================================================
             Appointment — sentence-style layout: "When a contact
             [Schedules/Reschedules/Cancels] a [appointment type]".
             Multi-select toggle button group + appointment-type
             dropdown with calendar icons and two-line items.
             =========================================================== -->
        <template v-else-if="slug === 'appointments'">
          <span class="tc-section-caption">Summary</span>
          <p class="tc-modal__lead">
            Add or remove a contact from a sequence when an appointment is
            scheduled, rescheduled, or canceled.
          </p>

          <span class="tc-section-heading">When a contact</span>

          <div
            class="tc-toggle-group"
            role="group"
            aria-label="Appointment event"
          >
            <DexButtonGroup size="default" align-x="left">
              <DexButton
                v-for="evt in APPOINTMENT_EVENTS"
                :key="evt.value"
                variant="outline"
                color="neutral"
                :selected="appointmentEvent === evt.value"
                :aria-pressed="appointmentEvent === evt.value"
                :value="evt.value"
                @click="selectAppointmentEvent(evt.value)"
              >
                {{ evt.label }}
              </DexButton>
            </DexButtonGroup>
          </div>

          <span class="tc-section-heading tc-section-heading--inline">a</span>

          <div class="tc-modal__form">
            <AppointmentTypeDropdown
              id="appt-type"
              :options="APPOINTMENT_TYPES"
              :value="draft.appointmentType"
              placeholder="Select an appointment type"
              required
              @update:value="onChange('appointmentType', $event)"
            />
          </div>

          <div class="tc-info" role="note">
            <DexIcon name="info" class="tc-info__icon" aria-hidden="true" />
            <div class="tc-info__body">
              <p class="tc-info__text">
                You can use this goal to both start and stop an automation.
              </p>
              <a
                class="tc-info__link"
                href="https://learn.thryv.com/hc/en-us/articles/37146000596493-Goals-Appointments"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn more
              </a>
            </div>
          </div>
        </template>

        <!-- ===========================================================
             Quote status — single dropdown + info notice. The dropdown
             uses a distinct DOM shape per the trigger spec
             (.multiselect.quote-status container with li.menu-item-root
             items, no numeric ids — data-qa carries the label).
             =========================================================== -->
        <template v-else-if="slug === 'quote-status'">
          <p class="tc-modal__lead">
            Add or remove a contact from a sequence based on quote status.
          </p>

          <div class="tc-modal__form">
            <QuoteStatusDropdown
              id="qs-status"
              label="Trigger when quote is"
              :options="QUOTE_STATUS_OPTIONS"
              :value="draft.status"
              placeholder="Select"
              required
              @update:value="onChange('status', $event)"
            />
          </div>

          <div class="tc-info" role="note">
            <DexIcon name="info" class="tc-info__icon" aria-hidden="true" />
            <div class="tc-info__body">
              <p class="tc-info__text">
                If a product in a quote matches a product in an existing
                "Product is purchased" Then, the contact will be added to both
                automations.
              </p>
              <a
                class="tc-info__link"
                href="https://learn.thryv.com/hc/en-us/articles/37139908022157-Goals-Quote-Status"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn more
              </a>
            </div>
          </div>
        </template>

        <!-- ===========================================================
             Fallback: generic schema-driven layout used by every other
             trigger (Appointments, Product is purchased, …) until each
             gets a hand-tuned design.
             =========================================================== -->
        <template v-else>
          <p class="tc-modal__lead">{{ subtitle }}</p>

          <div class="tc-modal__form">
            <label
              v-for="f in schema.fields"
              :key="f.id"
              class="tc-field"
            >
              <span class="tc-field__label">{{ f.label }}</span>
              <select
                v-if="f.kind === 'select'"
                class="tc-field__control"
                :value="draft[f.id] ?? ''"
                @change="onChange(f.id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="" disabled>Choose…</option>
                <option v-for="opt in f.options" :key="opt" :value="opt">
                  {{ opt }}
                </option>
              </select>
              <input
                v-else-if="f.kind === 'number'"
                type="number"
                class="tc-field__control"
                :value="draft[f.id] ?? ''"
                @input="onChange(f.id, ($event.target as HTMLInputElement).value)"
              />
              <input
                v-else
                type="text"
                class="tc-field__control"
                :value="draft[f.id] ?? ''"
                @input="onChange(f.id, ($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>
        </template>
      </div>

      <footer class="tc-modal__footer">
        <DexButton variant="solid" :disabled="!canSave" @click="onSave">
          Save
        </DexButton>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  DexButton,
  DexButtonGroup,
  DexIcon,
  DexIconButton,
  DexText,
} from '@thryvlabs/dex-vue';
import PipelineDropdown from './PipelineDropdown.vue';
import QuoteStatusDropdown from './QuoteStatusDropdown.vue';
import AppointmentTypeDropdown from './AppointmentTypeDropdown.vue';
import PurchaseTypeDropdown from './PurchaseTypeDropdown.vue';
import SearchableMultiSelect from './SearchableMultiSelect.vue';

type FieldKind = 'select' | 'text' | 'number';
type Field = {
  id: string;
  label: string;
  kind: FieldKind;
  options?: string[];
};
type Schema = { title: string; subtitle: string; fields: Field[] };

const props = defineProps<{
  slug: string;
  initialConfig: Record<string, string>;
}>();

const emit = defineEmits<{
  'update:config': [next: Record<string, string>];
  close: [];
}>();

const SCHEMAS: Record<string, Schema> = {
  // Product is purchased — custom layout. Title is the user-facing
  // "When a purchase is made" (not the slug-ish "Product is purchased").
  'product-is-purchased': {
    title: 'When a purchase is made',
    subtitle:
      "Add or remove a contact from a sequence based on a purchase they've made.",
    fields: [],
  },
  // Appointment uses a custom sentence-style layout
  // ("When a contact [Schedules/Reschedules/Cancels] a [appointment
  // type]") so its schema fields are empty — the markup lives inline
  // in the template branch.
  appointments: {
    title: 'Appointment',
    subtitle:
      'Add or remove a contact from a sequence when an appointment is scheduled, rescheduled, or canceled.',
    fields: [],
  },
  // Pipeline stage moved has a custom layout (info box + dependent
  // dropdowns) — the generic schema below only feeds the modal's title
  // / subtitle; the form markup lives inline in the template above.
  'pipeline-stage-is-moved': {
    title: 'Pipeline stage move',
    subtitle:
      'Trigger automation when a deal is moved into or out of a particular stage within a pipeline.',
    fields: [],
  },
  // Quote status — custom layout (single dropdown + info notice).
  'quote-status': {
    title: 'Quote status',
    subtitle:
      'Add or remove a contact from a sequence based on quote status.',
    fields: [],
  },
};

/** Quote status options. Spec calls for no numeric ids — the value IS
 *  the label so `data-qa` carries the human string verbatim. */
const QUOTE_STATUS_OPTIONS = [
  { value: 'Sent', label: 'Sent' },
  { value: 'Viewed', label: 'Viewed' },
  {
    value: 'Accepted (Payment options unavailable)',
    label: 'Accepted (Payment options unavailable)',
  },
];

/** Appointment event toggle group. The underlying API values
 *  (CREATED/UPDATED/DELETED) are what the trigger config persists; the
 *  labels are what the user sees. */
const APPOINTMENT_EVENTS = [
  { value: 'CREATED', label: 'Schedules' },
  { value: 'UPDATED', label: 'Reschedules' },
  { value: 'DELETED', label: 'Cancels' },
];

/** Purchase type — single-select with subtitles per the spec. The
 *  "Product" branch shows the conditional `Select products` field;
 *  the "Any purchase" branch hides it via v-if (DOM removed). */
const PURCHASE_TYPE_OPTIONS = [
  {
    value: 'Product',
    label: 'Product',
    subtitle: 'When a specific product is purchased',
  },
  {
    value: 'Any purchase',
    label: 'Any purchase',
    subtitle: 'When any purchase is made',
  },
];

/** Payment types — 8 hardcoded options per spec. Order matters. */
const PAYMENT_TYPE_OPTIONS = [
  {
    value: 'Credit Card (charge now)',
    label: 'Credit Card (charge now)',
    subtitle: 'Run when payment type is made by credit card (charge now)',
  },
  {
    value: 'Credit Card (Manual)',
    label: 'Credit Card (Manual)',
    subtitle: 'Run when payment type is made by credit card (manual)',
  },
  {
    value: 'Check',
    label: 'Check',
    subtitle: 'Run when payment type is made by check',
  },
  {
    value: 'Cash',
    label: 'Cash',
    subtitle: 'Run when payment type is made by cash',
  },
  {
    value: 'Money Order',
    label: 'Money Order',
    subtitle: 'Run when payment type is made by money order',
  },
  {
    value: 'Adjustment',
    label: 'Adjustment',
    subtitle: 'Run when payment type is made by adjustment',
  },
  {
    value: 'Include $0 invoices',
    label: 'Include $0 invoices',
    subtitle: 'Run when invoice is $0',
  },
  {
    value: 'Any payment type',
    label: 'Any payment type',
    subtitle:
      'Run on any payment type (Including any future payment types created)',
  },
];

/** Products catalogue — in production this would be a live API search
 *  (no pre-loaded list). The prototype stubs a small catalogue and
 *  reuses the SearchableMultiSelect's `requireQuery` mode so the list
 *  stays empty until the user types — mirroring real behaviour. */
const PRODUCTS_CATALOGUE = [
  { value: '1 Hour Consult', label: '1 Hour Consult' },
  { value: '30 min consult', label: '30 min consult' },
  { value: 'Expensive Product', label: 'Expensive Product' },
  {
    value: 'Jialing consultation fee 30/60 mins',
    label: 'Jialing consultation fee 30/60 mins',
  },
  { value: 'Annual subscription', label: 'Annual subscription' },
  { value: 'Coaching package', label: 'Coaching package' },
  { value: 'Starter kit', label: 'Starter kit' },
  { value: 'Premium add-on', label: 'Premium add-on' },
];

const productsQuery = ref('');
/** Search-filtered subset of the catalogue. Matches how the real API
 *  would respond — empty until query is non-empty. */
const productsSearchResults = computed(() => {
  const q = productsQuery.value.trim().toLowerCase();
  if (!q) return [];
  return PRODUCTS_CATALOGUE.filter((p) =>
    p.label.toLowerCase().includes(q),
  );
});

/** Appointment types — in production this would come from the tenant's
 *  appointment-types API. Stubbed with the live-example fixtures so
 *  QA can target rows by data-qa exactly as in the spec. */
const APPOINTMENT_TYPES = [
  {
    value: 'teste34345 with Selenium Automation',
    label: 'teste34345 with Selenium Automation',
    subtitle: '15 minutes',
  },
  {
    value: 'test4645 with Selenium Automation',
    label: 'test4645 with Selenium Automation',
    subtitle: '30 minutes',
  },
  {
    value: 'test3534523 with Selenium Automation',
    label: 'test3534523 with Selenium Automation',
    subtitle: '15 minutes',
  },
  {
    value: 'test353343 with Selenium Automation',
    label: 'test353343 with Selenium Automation',
    subtitle: '15 minutes',
  },
];

const schema = computed<Schema>(
  () =>
    SCHEMAS[props.slug] ?? {
      title: props.slug,
      subtitle: 'Configure this trigger.',
      fields: [],
    },
);

const title = computed(() => schema.value.title);
const subtitle = computed(() => schema.value.subtitle);

// ===================================================================
// Pipeline stage move — data dictionaries
// ===================================================================

/** "When moving" direction options. Value = stable id stored in the
 *  trigger config; label = what the user sees. */
const DIRECTION_OPTIONS = [
  { value: 'IN', label: 'Into' },
  { value: 'OUT', label: 'Out of' },
];

/** Pipelines available to this tenant. In production this would come
 *  from the pipelines API; here we stub the live-example id so QA can
 *  match the spec verbatim. */
const PIPELINE_OPTIONS = [
  {
    value: '10000000000072932',
    label: 'KLG - SLP - Graphic Design Test Pipeline',
  },
  { value: '10000000000072933', label: 'Sales pipeline' },
  { value: '10000000000072934', label: 'Service pipeline' },
  { value: '10000000000072935', label: 'Renewals' },
];

/** Stage list per pipeline id. Stage IDs are also stable values so the
 *  trigger config persists a Pipeline → Stage tuple, not a label tuple. */
const STAGES_BY_PIPELINE: Record<string, { value: string; label: string }[]> = {
  '10000000000072932': [
    { value: '10000000000325450', label: 'Not started' },
    { value: '10000000000325452', label: 'Planning' },
    { value: '10000000000325454', label: 'In progress' },
    { value: '10000000000325456', label: 'In review' },
    { value: '10000000000325458', label: 'Complete' },
  ],
  '10000000000072933': [
    { value: '10000000000325460', label: 'New leads' },
    { value: '10000000000325462', label: 'Qualified leads' },
    { value: '10000000000325464', label: 'Quote sent' },
    { value: '10000000000325466', label: 'Negotiating' },
    { value: '10000000000325468', label: 'Quote accepted' },
  ],
  '10000000000072934': [
    { value: '10000000000325470', label: 'Ticket open' },
    { value: '10000000000325472', label: 'In service' },
    { value: '10000000000325474', label: 'Resolved' },
  ],
  '10000000000072935': [
    { value: '10000000000325480', label: 'Up for renewal' },
    { value: '10000000000325482', label: 'Renewed' },
    { value: '10000000000325484', label: 'Lapsed' },
  ],
};

const stageOptions = computed(() => {
  const pid = draft.pipeline;
  return pid && STAGES_BY_PIPELINE[pid] ? STAGES_BY_PIPELINE[pid] : [];
});

// Draft-based edit (per HANDOFF §13): mutate a draft until Save commits.
const draft = reactive<Record<string, string>>({ ...props.initialConfig });
const rootEl = ref<HTMLElement | null>(null);

// -------------------------------------------------------------------
// Product is purchased — local state. Both multi-select fields are
// persisted to `draft.products` / `draft.paymentTypes` as comma-joined
// strings so they fit the Record<string,string> contract; the Set/Array
// views below are the editing-time projection.
// -------------------------------------------------------------------

function csvToArr(s: string | undefined): string[] {
  if (!s) return [];
  return s.split(',').map((p) => p.trim()).filter(Boolean);
}

const productsSelected = ref<string[]>(csvToArr(props.initialConfig.products));
const paymentTypesSelected = ref<string[]>(
  csvToArr(props.initialConfig.paymentTypes),
);

function onPurchaseTypeChange(next: string) {
  draft.purchaseType = next;
  // "Any purchase" hides the products field per spec — clear any
  // previously-selected products so they don't silently persist out of
  // view. If the user flips back to "Product", they start fresh.
  if (next === 'Any purchase') {
    productsSelected.value = [];
    draft.products = '';
    productsQuery.value = '';
  }
}
function onProductsChange(next: string[]) {
  productsSelected.value = next;
  draft.products = next.join(',');
}
function onPaymentTypesChange(next: string[]) {
  paymentTypesSelected.value = next;
  draft.paymentTypes = next.join(',');
}

/** Appointment event — single-select. Clicking an unselected button
 *  replaces the current selection; clicking the already-selected
 *  button is a no-op (one event is always selected). Persisted to
 *  `draft.event` as a single CREATED/UPDATED/DELETED token. */
const appointmentEvent = ref<string>(
  props.initialConfig.event || 'CREATED',
);

function selectAppointmentEvent(value: string) {
  if (appointmentEvent.value === value) return;
  appointmentEvent.value = value;
  draft.event = value;
}

watch(
  () => props.initialConfig,
  (next) => {
    for (const k of Object.keys(draft)) delete draft[k];
    Object.assign(draft, next);
  },
);

onMounted(() => {
  rootEl.value?.focus();
});

function onChange(id: string, value: string) {
  draft[id] = value;
}

/** When the pipeline changes, the previously-selected stage is no longer
 *  valid (each pipeline has its own stage list), so clear it. */
function onPipelineChange(nextPipelineId: string) {
  draft.pipeline = nextPipelineId;
  draft.stage = '';
}

/** All three required fields filled — Save is gated on this for the
 *  pipeline trigger; other triggers stay always-enabled until each
 *  gets its own validation. */
const canSave = computed(() => {
  if (props.slug === 'pipeline-stage-is-moved') {
    return !!draft.direction && !!draft.pipeline && !!draft.stage;
  }
  if (props.slug === 'quote-status') {
    return !!draft.status;
  }
  if (props.slug === 'appointments') {
    return !!appointmentEvent.value && !!draft.appointmentType;
  }
  if (props.slug === 'product-is-purchased') {
    if (!draft.purchaseType) return false;
    if (paymentTypesSelected.value.length === 0) return false;
    // Product branch additionally requires at least one product picked.
    if (
      draft.purchaseType === 'Product' &&
      productsSelected.value.length === 0
    ) {
      return false;
    }
    return true;
  }
  return true;
});

// Seed draft.event so the Save gate reflects the visible default
// (Schedules) on first open.
if (props.slug === 'appointments' && !draft.event) {
  draft.event = appointmentEvent.value;
}

function onSave() {
  if (!canSave.value) return;
  emit('update:config', { ...draft });
  emit('close');
}
</script>

<style scoped>
.tc-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 36, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 24px;
}
.tc-modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
  outline: none;
}
.tc-modal__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
}
.tc-modal__body {
  padding: 18px;
}
.tc-modal__lead {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--dex-fgColor-muted, #6b7280);
}
.tc-info {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: var(--dex-color-blue-50, #eff6ff);
  border: 1px solid var(--dex-color-blue-200, #bfdbfe);
  border-radius: 8px;
  padding: 12px 14px;
  /* Sit below the last form field with a clear breathing margin so it
   * reads as a separate contextual note, not a fourth field. Matches
   * the gap shown in the production Appointment screen. */
  margin: 24px 0 0;
}
.tc-info__icon {
  color: var(--dex-color-blue-700, #1d4ed8);
  flex: 0 0 auto;
  margin-top: 1px;
}
.tc-info__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tc-info__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--dex-color-blue-900, #1e3a8a);
}
.tc-info__link {
  font-size: 13px;
  font-weight: 600;
  color: var(--dex-color-blue-700, #1d4ed8);
  text-decoration: none;
}
.tc-info__link:hover {
  text-decoration: underline;
}
.tc-modal__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tc-section-caption {
  display: block;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dex-fgColor-muted, #6b7280);
  margin-bottom: 4px;
}
.tc-section-heading {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: var(--dex-fgColor-default, #272727);
  margin: 18px 0 8px;
}
.tc-section-heading--inline {
  /* The lowercase "a" connector between the toggle group and the
   * appointment-type dropdown — same heading style as "When a contact"
   * but with a smaller top gap so the sentence reads tightly. */
  margin: 12px 0 8px;
}
.tc-static-text {
  /* Sentence-style connector between fields (e.g. "and only run on
   * selected payment types" between the Products and Payment type
   * fields). Sits in the form's vertical gap so it reads as inline
   * copy, not a label. */
  font-size: 14px;
  color: var(--dex-fgColor-muted, #6b7280);
}
.tc-toggle-group {
  /* DexButtonGroup handles inline layout of its children; this wrapper
   * exists for the role=group / aria-label hook and any future spacing
   * tweaks. */
  display: block;
}
.tc-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
}
.tc-field__label {
  font-weight: 600;
  color: var(--dex-fgColor-default, #272727);
}
.tc-field__control {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--dex-borderColor-default, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
}
.tc-field__control:focus {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: -1px;
  border-color: transparent;
}
.tc-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px;
  border-top: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
}
</style>
