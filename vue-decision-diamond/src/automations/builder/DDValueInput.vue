<template>
  <div class="dd-value">
    <div v-if="effectiveType !== 'unary'" class="dd-value__chips">
      <span
        v-for="v in values"
        :key="v"
        class="dd-value__chip"
      >
        <span>{{ formatChip(v) }}</span>
        <button
          type="button"
          class="dd-value__chip-remove"
          aria-label="Remove value"
          @click="removeValue(v)"
        >
          ×
        </button>
      </span>
    </div>

    <template v-if="effectiveType === 'enum'">
      <select
        class="dd-value__control"
        :value="''"
        @change="onSelectChange"
      >
        <option value="" disabled>{{ placeholder }}</option>
        <option
          v-for="opt in availableEnumOptions"
          :key="opt"
          :value="opt"
        >
          {{ opt }}
        </option>
      </select>
    </template>

    <template v-else-if="effectiveType === 'boolean'">
      <select
        class="dd-value__control"
        :value="''"
        @change="onSelectChange"
      >
        <option value="" disabled>{{ placeholder }}</option>
        <option v-for="b in availableBooleanOptions" :key="b" :value="b">
          {{ b }}
        </option>
      </select>
    </template>

    <template v-else-if="effectiveType === 'number'">
      <input
        v-model="draft"
        type="number"
        inputmode="numeric"
        class="dd-value__control"
        :placeholder="placeholder"
        @keydown.enter="commitDraft"
        @blur="commitDraft"
      />
    </template>

    <template v-else-if="effectiveType === 'currency'">
      <span class="dd-value__currency">
        <span class="dd-value__currency-prefix">$</span>
        <input
          v-model="draft"
          type="number"
          step="0.01"
          inputmode="decimal"
          class="dd-value__control dd-value__control--currency"
          :placeholder="placeholder"
          @keydown.enter="commitDraft"
          @blur="commitDraft"
        />
      </span>
    </template>

    <template v-else-if="effectiveType === 'date'">
      <input
        v-model="draft"
        type="date"
        class="dd-value__control"
        @change="commitDraft"
      />
    </template>

    <template v-else-if="effectiveType === 'datetime'">
      <input
        v-model="draft"
        type="datetime-local"
        class="dd-value__control"
        @change="commitDraft"
      />
    </template>

    <template v-else-if="effectiveType === 'unary'">
      <!-- nothing -->
    </template>

    <template v-else>
      <input
        v-model="draft"
        type="text"
        class="dd-value__control"
        :placeholder="placeholder"
        @keydown.enter="commitDraft"
        @blur="commitDraft"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { OperatorValueShape } from '../../decisionDiamond/dropdowns';
import type { FieldType } from '../../decisionDiamond/entities';

const props = defineProps<{
  valueShape: OperatorValueShape;
  fieldType?: FieldType;
  enumOptions?: string[];
  values: string[];
}>();

const emit = defineEmits<{
  'update:values': [next: string[]];
}>();

const draft = ref('');

const effectiveType = computed<
  'unary' | 'enum' | 'number' | 'currency' | 'date' | 'datetime' | 'boolean' | 'text'
>(() => {
  if (props.valueShape === 'unary') return 'unary';
  if (props.valueShape === 'number') return 'number';
  if (props.enumOptions && props.enumOptions.length > 0) return 'enum';
  if (!props.fieldType) return 'text';
  switch (props.fieldType) {
    case 'currency':
      return 'currency';
    case 'number':
      return 'number';
    case 'date':
      return 'date';
    case 'datetime':
      return 'datetime';
    case 'boolean':
      return 'boolean';
    case 'enum':
      return 'enum';
    case 'text':
    case 'reference':
    default:
      return 'text';
  }
});

const placeholder = computed(() => {
  if (props.values.length > 0) return '+ or';
  switch (effectiveType.value) {
    case 'currency':
      return 'Enter amount';
    case 'number':
      return 'Enter a number';
    case 'date':
    case 'datetime':
      return '';
    case 'enum':
    case 'boolean':
      return 'Choose a value';
    default:
      return 'Enter a value';
  }
});

const availableEnumOptions = computed(() =>
  (props.enumOptions ?? []).filter((o) => !props.values.includes(o)),
);

const availableBooleanOptions = computed(() =>
  ['true', 'false'].filter((o) => !props.values.includes(o)),
);

watch(
  () => [props.valueShape, props.fieldType, props.enumOptions],
  () => {
    draft.value = '';
  },
);

function formatChip(v: string) {
  if (effectiveType.value === 'currency') {
    const n = Number(v);
    if (Number.isFinite(n)) return `$${n.toLocaleString()}`;
  }
  return v;
}

function commitDraft() {
  const v = draft.value.trim();
  if (!v) return;
  if (props.values.includes(v)) {
    draft.value = '';
    return;
  }
  emit('update:values', [...props.values, v]);
  draft.value = '';
}

function onSelectChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  const v = target.value;
  if (!v) return;
  if (props.values.includes(v)) return;
  emit('update:values', [...props.values, v]);
  target.value = '';
}

function removeValue(v: string) {
  emit(
    'update:values',
    props.values.filter((x) => x !== v),
  );
}
</script>

<style scoped>
.dd-value {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.dd-value__chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}
.dd-value__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 8px;
  background: var(--dex-color-blue-100, #dbeafe);
  color: var(--dex-color-blue-800, #1e40af);
  border-radius: 12px;
  font-size: 13px;
}
.dd-value__chip-remove {
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  color: inherit;
}
.dd-value__control {
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--dex-color-gray-300, #d1d5db);
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  min-width: 140px;
  box-sizing: border-box;
}
.dd-value__control:focus {
  outline: 2px solid var(--dex-color-blue-500, #3b82f6);
  outline-offset: -1px;
  border-color: transparent;
}
.dd-value__currency {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.dd-value__currency-prefix {
  position: absolute;
  left: 8px;
  font-size: 13px;
  color: var(--dex-color-gray-700, #6b7280);
  pointer-events: none;
}
.dd-value__control--currency {
  padding-left: 18px;
}
</style>
