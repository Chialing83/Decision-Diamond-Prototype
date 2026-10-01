<template>
  <div class="dd-test-overlay" role="dialog" aria-modal="true" aria-labelledby="dd-test-title">
    <div class="dd-test-modal" :class="{ 'dd-test-modal--xs': !rulesFound }">
      <!-- ===== Header ===== -->
      <header class="dd-test-modal__header">
        <DexText
          id="dd-test-title"
          as="h2"
          variant="display-2"
          class="dd-test-modal__title"
        >
          Test decision diamond
        </DexText>
        <button
          type="button"
          class="dd-test-modal__close"
          aria-label="Close test"
          @click="$emit('close')"
        >
          <DexIcon name="x" aria-hidden="true" />
        </button>
      </header>

      <!-- ===== No-rules empty state ===== -->
      <template v-if="!rulesFound">
        <div class="dd-test-modal__body">
          <DexInlineAlert variant="warning">
            <template #title>No rules to test yet</template>
            Configure at least one rule in this diamond, then come back to
            test how records will route.
          </DexInlineAlert>
        </div>
        <footer class="dd-test-modal__footer">
          <DexButton variant="solid" @click="$emit('close')">Got it</DexButton>
        </footer>
      </template>

      <!-- ===== Test form ===== -->
      <template v-else>
        <div class="dd-test-modal__body">
          <DexText variant="body-2" class="dd-test-modal__intro">
            Provide a sample value for each rule field. We'll run your saved
            logic and tell you which sequence the record would land in.
          </DexText>

          <div class="dd-test-modal__fields">
            <div
              v-for="field in uniqueFields"
              :key="field.id"
              class="dd-test-field"
            >
              <label class="dd-test-field__label">{{ field.label }}</label>

              <!-- Enum dropdown -->
              <DropdownSelect
                v-if="field.kind === 'enum'"
                :model-value="(inputValues[field.id] as string | undefined) ?? ''"
                :options="field.enumOptions ?? []"
                :aria-label="`Test value for ${field.label}`"
                @update:model-value="(v) => setValue(field.id, v)"
              />

              <!-- Number / currency -->
              <DexInput
                v-else-if="field.kind === 'number'"
                :model-value="(inputValues[field.id] as string | undefined) ?? ''"
                type="number"
                :label="`Test value for ${field.label}`"
                label-hidden
                :placeholder="field.placeholder ?? '0'"
                @update:model-value="(v: unknown) => setValue(field.id, String(v ?? ''))"
              />

              <!-- Date / between range -->
              <DexInput
                v-else-if="field.kind === 'date'"
                :model-value="(inputValues[field.id] as string | undefined) ?? ''"
                type="date"
                :label="`Test value for ${field.label}`"
                label-hidden
                @update:model-value="(v: unknown) => setValue(field.id, String(v ?? ''))"
              />

              <!-- Boolean (yes / no radio simulated as dropdown for parity) -->
              <DropdownSelect
                v-else-if="field.kind === 'boolean'"
                :model-value="(inputValues[field.id] as string | undefined) ?? ''"
                :options="[
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                ]"
                :aria-label="`Test value for ${field.label}`"
                @update:model-value="(v) => setValue(field.id, v)"
              />

              <!-- Tags — comma-separated, since Contact may have multiple
                   tags. The eval treats this as a list. -->
              <DexInput
                v-else-if="field.kind === 'tags'"
                :model-value="(inputValues[field.id] as string | undefined) ?? ''"
                type="text"
                :label="`Test value for ${field.label}`"
                label-hidden
                placeholder="Comma-separated tags (e.g. VIP, Referral)"
                @update:model-value="(v: unknown) => setValue(field.id, String(v ?? ''))"
              />

              <!-- Fallback text input -->
              <DexInput
                v-else
                :model-value="(inputValues[field.id] as string | undefined) ?? ''"
                type="text"
                :label="`Test value for ${field.label}`"
                label-hidden
                placeholder="Enter a value"
                @update:model-value="(v: unknown) => setValue(field.id, String(v ?? ''))"
              />

              <div v-if="field.helperText" class="dd-test-field__help">
                {{ field.helperText }}
              </div>
            </div>
          </div>

          <!-- Result panel -->
          <div
            v-if="evaluated"
            class="dd-test-result"
            :class="{
              'dd-test-result--match': matchedSequenceLabel,
              'dd-test-result--no-match': !matchedSequenceLabel,
            }"
            role="status"
            aria-live="polite"
          >
            <template v-if="matchedSequenceLabel">
              <DexIcon name="check-circle" aria-hidden="true" />
              <div>
                <div class="dd-test-result__title">Matched sequence</div>
                <div class="dd-test-result__detail">
                  This record would route to
                  <strong>{{ matchedSequenceLabel }}</strong>.
                </div>
              </div>
            </template>
            <template v-else>
              <DexIcon name="alert-circle" aria-hidden="true" />
              <div>
                <div class="dd-test-result__title">No sequence matched</div>
                <div class="dd-test-result__detail">
                  This record would route to
                  <strong>{{ defaultRoutingLabel }}</strong>.
                </div>
              </div>
            </template>
          </div>
        </div>

        <footer class="dd-test-modal__footer">
          <DexButton variant="ghost" @click="$emit('close')">Cancel</DexButton>
          <DexButton
            variant="solid"
            :disabled="loading"
            @click="evaluate"
          >
            {{ loading ? 'Evaluating…' : 'Evaluate' }}
          </DexButton>
        </footer>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Test modal for the decision diamond config screen.
 *
 * Replaces the (legacy DsModal-based) Test functionality from the
 * production app. The original posted form data to `/decisions/test`
 * and `/decisions/evaluation` server endpoints. This implementation
 * evaluates the saved rules LOCALLY against user-provided test inputs
 * — same UX, no backend dependency, works for every supported field
 * type across all 4 trigger entities + Deal defaults + Contact
 * attributes.
 *
 * The component:
 *  - Collects every unique field referenced by any condition in any
 *    block of any group (so the user is asked exactly the set of
 *    inputs the saved rules care about).
 *  - Renders the right widget per field type (enum dropdown / number
 *    / date / tags / boolean / text), matching the rendering the
 *    rules pane already uses for each.
 *  - On Evaluate, runs the standard first-match-wins decision
 *    routing (each group passes if any block passes; each block
 *    passes if all conditions pass; first passing group wins;
 *    otherwise default routing).
 */
import { computed, ref } from 'vue';
import {
  DexButton,
  DexIcon,
  DexInlineAlert,
  DexInput,
  DexText,
} from '@thryvlabs/dex-vue';
import DropdownSelect from './DropdownSelect.vue';
import type {
  DecisionDiamondConfig,
  DDCondition,
} from '../../decisionDiamond/types';
import { getTriggerField } from '../../decisionDiamond/triggerAttributes';
import { getContactAttribute } from '../../decisionDiamond/contactAttributes';

const props = defineProps<{
  config: DecisionDiamondConfig;
}>();

defineEmits<{
  close: [];
}>();

// -------------------------------------------------------------------
// Field discovery — what test inputs the user needs to provide.
// -------------------------------------------------------------------

interface TestField {
  id: string;
  label: string;
  kind: 'enum' | 'number' | 'date' | 'tags' | 'boolean' | 'text';
  /** Options when kind === 'enum'. */
  enumOptions?: { value: string; label: string }[];
  /** Helper text shown below the input. */
  helperText?: string;
  /** Placeholder for free-text inputs. */
  placeholder?: string;
}

// Deal field labels + types — mirrors SIMPLE_FIELDS in the editor.
const DEAL_FIELD_META: Record<
  string,
  { label: string; kind: TestField['kind']; enumOptions?: string[] }
> = {
  dealValue: { label: 'Deal value', kind: 'number' },
  dealStage: {
    label: 'Deal stage',
    kind: 'enum',
    enumOptions: ['New', 'Qualified', 'Estimate Sent', 'Scheduled', 'Won', 'Lost'],
  },
  dealCompletionTime: { label: 'Deal completion time', kind: 'date' },
  dealExpirationTime: { label: 'Deal expiration time', kind: 'date' },
};

/** Walk every condition in the diamond and collect the unique fields
 *  the test form needs to ask about. Stable order: first occurrence
 *  wins. Returns deduped entries with their TestField metadata. */
const uniqueFields = computed<TestField[]>(() => {
  const seen = new Set<string>();
  const fields: TestField[] = [];

  for (const group of props.config.groups) {
    for (const block of group.blocks) {
      for (const cond of block.conditions) {
        const id = testFieldKey(cond);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const field = describeFieldForTest(cond);
        if (field) fields.push(field);
      }
    }
  }
  return fields;
});

/** Stable key per condition's "field" axis — the user provides one
 *  test value per unique combination of (entity, category, field). */
function testFieldKey(c: DDCondition): string {
  if (c.entity === 'contact') {
    if (c.category === 'tags') return 'contact:tags';
    if (!c.field) return '';
    return `contact:${c.field}`;
  }
  if (!c.field) return '';
  return `deal:${c.field}`;
}

/** Convert a condition's field reference into a TestField definition
 *  for the form. Resolves across deal defaults, trigger schemas
 *  (Product / Quote / Pipeline / Appointment), and Contact attributes. */
function describeFieldForTest(c: DDCondition): TestField | null {
  // Contact path
  if (c.entity === 'contact') {
    if (c.category === 'tags') {
      return {
        id: 'contact:tags',
        label: "Contact's Tags",
        kind: 'tags',
        helperText:
          'Tags currently on the test contact. The rule passes if your input includes the rule\'s tag.',
      };
    }
    if (!c.field) return null;
    const attr = getContactAttribute(c.field);
    if (!attr) return null;
    return {
      id: `contact:${c.field}`,
      label: `Contact's ${attr.label}`,
      kind: contactKindToTestKind(attr.type),
      enumOptions:
        attr.type === 'enum' && attr.enumValues
          ? attr.enumValues.map((v) => ({ value: v, label: v }))
          : undefined,
    };
  }

  // Deal / trigger path
  if (!c.field) return null;
  if (c.field in DEAL_FIELD_META) {
    const meta = DEAL_FIELD_META[c.field];
    return {
      id: `deal:${c.field}`,
      label: meta.label,
      kind: meta.kind,
      enumOptions:
        meta.kind === 'enum' && meta.enumOptions
          ? meta.enumOptions.map((v) => ({ value: v, label: v }))
          : undefined,
    };
  }
  const tf = getTriggerField(c.field);
  if (tf) {
    return {
      id: `deal:${c.field}`,
      label: tf.label,
      kind: tf.inputType === 'enum' ? 'enum' : (tf.inputType as TestField['kind']),
      enumOptions: tf.enum?.map((v) => ({ value: v, label: v })),
    };
  }
  return null;
}

function contactKindToTestKind(t: string): TestField['kind'] {
  switch (t) {
    case 'tags':
      return 'tags';
    case 'date':
      return 'date';
    case 'numeric':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'enum':
      return 'enum';
    default:
      return 'text';
  }
}

const rulesFound = computed(() => uniqueFields.value.length > 0);

// -------------------------------------------------------------------
// Form state
// -------------------------------------------------------------------

const inputValues = ref<Record<string, string>>({});

function setValue(fieldId: string, v: string) {
  inputValues.value[fieldId] = v;
  evaluated.value = false;
  matchedSequenceLabel.value = null;
}

// -------------------------------------------------------------------
// Evaluation
// -------------------------------------------------------------------

const evaluated = ref(false);
const loading = ref(false);
const matchedSequenceLabel = ref<string | null>(null);

const defaultRoutingLabel = computed(() => {
  const def = props.config.defaultRouting;
  if (!def || def === '__drop__') return "Don't put them in a sequence";
  const seqIdx = props.config.groups.findIndex(
    (g) =>
      g.targetFlowId === def ||
      `__seq-${props.config.groups.indexOf(g)}__` === def,
  );
  if (seqIdx >= 0) {
    return sequenceLabel(seqIdx);
  }
  return 'a fallback sequence';
});

function sequenceLabel(idx: number): string {
  const g = props.config.groups[idx];
  if (!g) return `Sequence ${idx + 1}`;
  return g.targetName?.trim() ? `Sequence ${idx + 1} (${g.targetName})` : `Sequence ${idx + 1}`;
}

async function evaluate() {
  loading.value = true;
  // Small artificial delay so the user gets a hint of "evaluating" —
  // matches the perceived weight of the original server round-trip.
  await new Promise((r) => setTimeout(r, 180));

  let matched: number | null = null;
  for (let i = 0; i < props.config.groups.length; i++) {
    if (evaluateGroup(props.config.groups[i])) {
      matched = i;
      break;
    }
  }
  matchedSequenceLabel.value = matched !== null ? sequenceLabel(matched) : null;
  evaluated.value = true;
  loading.value = false;
}

function evaluateGroup(g: DecisionDiamondConfig['groups'][number]): boolean {
  if (g.blocks.length === 0) return true; // empty = pass-through
  return g.blocks.some((block) =>
    block.conditions.every((cond) => evaluateCondition(cond)),
  );
}

function evaluateCondition(c: DDCondition): boolean {
  // An unconfigured condition (no field yet) passes — same semantics
  // as the editor's "empty rule row" placeholder.
  if (!c.field && c.category !== 'tags') return true;

  const id = testFieldKey(c);
  const testRaw = inputValues.value[id];
  if (testRaw === undefined) return false; // user didn't fill it in

  const op = c.operator;
  const ruleVals = c.values ?? [];

  switch (op) {
    case 'equals':
      return ruleVals.some((v) => testRaw === v);
    case 'doesNotEqual':
      return !ruleVals.some((v) => testRaw === v);
    case 'exceeds':
      return parseFloat(testRaw) > parseFloat(ruleVals[0] ?? '0');
    case 'lessThan':
      return parseFloat(testRaw) < parseFloat(ruleVals[0] ?? '0');
    case 'between': {
      const n = parseFloat(testRaw);
      const lo = parseFloat(ruleVals[0] ?? '0');
      const hi = parseFloat(ruleVals[1] ?? '0');
      // Dates compare lexicographically (ISO strings sort correctly)
      if (!Number.isFinite(n) || !Number.isFinite(lo) || !Number.isFinite(hi)) {
        return (
          testRaw >= (ruleVals[0] ?? '') && testRaw <= (ruleVals[1] ?? '')
        );
      }
      return n >= lo && n <= hi;
    }
    case 'before':
      return testRaw < (ruleVals[0] ?? '');
    case 'after':
      return testRaw > (ruleVals[0] ?? '');
    case 'contains': {
      // For tags: tag list (comma-separated) contains the rule's tag
      if (c.category === 'tags') {
        const userTags = testRaw
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        return ruleVals.some((v) => userTags.includes(v.toLowerCase()));
      }
      return testRaw.toLowerCase().includes((ruleVals[0] ?? '').toLowerCase());
    }
    case 'doesNotContain': {
      if (c.category === 'tags') {
        const userTags = testRaw
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        return !ruleVals.some((v) => userTags.includes(v.toLowerCase()));
      }
      return !testRaw
        .toLowerCase()
        .includes((ruleVals[0] ?? '').toLowerCase());
    }
    case 'beginsWith':
      return testRaw
        .toLowerCase()
        .startsWith((ruleVals[0] ?? '').toLowerCase());
    case 'endsWith':
      return testRaw
        .toLowerCase()
        .endsWith((ruleVals[0] ?? '').toLowerCase());
    case 'isEmpty':
      return testRaw.trim() === '';
    case 'isNotEmpty':
      return testRaw.trim() !== '';
    case 'isTrue':
      return testRaw === 'true';
    case 'isFalse':
      return testRaw === 'false';
    default:
      // Unknown operator → treat as equality fallback
      return ruleVals.some((v) => testRaw === v);
  }
}
</script>

<style scoped>
.dd-test-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  /* Above the editor (z-index: 120) AND above any trigger-config modal
   * that may have been opened from the canvas before the diamond was
   * configured. */
  z-index: 9999;
  padding: 24px;
  overflow: auto;
}

.dd-test-modal {
  background: var(--dex-color-white, #fff);
  width: 100%;
  max-width: 560px;
  border-radius: 12px;
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 48px);
  overflow: hidden;
  font-family: var(--dex-fontFamily-sans, 'Inter', system-ui, sans-serif);
}
.dd-test-modal--xs {
  max-width: 420px;
}

.dd-test-modal__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
}
.dd-test-modal__title {
  margin: 0;
  flex: 1;
}
.dd-test-modal__close {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  display: inline-flex;
  --dex-icon-size: 20px;
  color: var(--dex-fgColor-muted, #6b7280);
}
.dd-test-modal__close:hover {
  background: var(--dex-color-gray-100, #f3f4f6);
}

.dd-test-modal__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}
.dd-test-modal__intro {
  color: var(--dex-fgColor-muted, #6b7280);
  margin-bottom: 16px;
}

.dd-test-modal__fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dd-test-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dd-test-field__label {
  font-size: 13px;
  font-weight: 600;
  color: #272727;
}
.dd-test-field__help {
  font-size: 12px;
  color: var(--dex-fgColor-muted, #6b7280);
}

.dd-test-result {
  margin-top: 20px;
  padding: 14px 16px;
  border-radius: 10px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  --dex-icon-size: 20px;
}
.dd-test-result--match {
  background: rgba(34, 197, 94, 0.08);
  color: var(--dex-color-green-700, #15803d);
}
.dd-test-result--no-match {
  background: rgba(245, 158, 11, 0.08);
  color: var(--dex-color-yellow-800, #92400e);
}
.dd-test-result__title {
  font-weight: 600;
  margin-bottom: 2px;
}
.dd-test-result__detail {
  font-size: 14px;
  color: #272727;
}

.dd-test-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
  background: var(--dex-color-gray-50, #fafafa);
}
</style>
