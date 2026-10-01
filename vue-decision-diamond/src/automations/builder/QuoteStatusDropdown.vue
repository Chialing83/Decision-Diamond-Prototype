<template>
  <div class="pd-field">
    <!-- The wrapper class names mirror the Thryv production markup so
         downstream QA selectors keep working:
         `.multiselect.quote-status` (active when open), with a
         `.dropdown-reference` trigger and `.dropdown-menu.open` panel.
         Items use `.menu-item-root[data-qa="..."]` — no numeric ids;
         the label IS the identifier. -->
    <div
      ref="rootEl"
      class="multiselect quote-status"
      :class="{ active: open }"
    >
      <button
        ref="triggerEl"
        type="button"
        class="dropdown-reference pd-field__trigger"
        :aria-haspopup="'listbox'"
        :aria-expanded="open"
        :aria-controls="`${id}-menu`"
        :disabled="disabled"
        @click="toggle"
        @keydown="onTriggerKeydown"
      >
        <span class="pd-field__trigger-label">
          {{ label }}<span v-if="required" class="pd-field__req" aria-hidden="true">*</span>
        </span>
        <span
          class="pd-field__value"
          :class="{ 'pd-field__value--placeholder': !selectedLabel }"
        >
          {{ selectedLabel || placeholder }}
        </span>
        <span class="pd-field__caret" aria-hidden="true">▾</span>
      </button>

      <div v-if="open" class="dropdown-menu open">
        <ul
          :id="`${id}-menu`"
          class="dropdown-menu-list"
          role="listbox"
          :aria-labelledby="id"
        >
          <li
            v-for="o in options"
            :key="o.value"
            class="menu-item-root"
            role="option"
            :aria-selected="o.value === value"
            :data-qa="o.label"
            @click="onPick(o.value)"
          >
            <span class="menu-item-root__label">{{ o.label }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Hidden native select mirrors the visible selection so a form
         scrape can read the chosen status without parsing the custom
         dropdown. Default placeholder uses value="selected". -->
    <select
      :id="id"
      class="pd-field__hidden-select"
      :value="value || 'selected'"
      :aria-hidden="true"
      tabindex="-1"
      @change="(e) => emit('update:value', (e.target as HTMLSelectElement).value)"
    >
      <option value="selected" disabled>{{ placeholder }}</option>
      <option v-for="o in options" :key="o.value" :value="o.value">
        {{ o.label }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

type Option = { value: string; label: string };

const props = defineProps<{
  id: string;
  label: string;
  options: Option[];
  value: string | undefined;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:value': [value: string];
}>();

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);
const triggerEl = ref<HTMLButtonElement | null>(null);

const selectedLabel = computed(() => {
  if (!props.value) return '';
  return props.options.find((o) => o.value === props.value)?.label ?? '';
});

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
}
function close() {
  open.value = false;
}
function onPick(value: string) {
  emit('update:value', value);
  open.value = false;
  triggerEl.value?.focus();
}

function onDocPointerDown(e: PointerEvent) {
  if (!open.value) return;
  const t = e.target as Node;
  if (rootEl.value && !rootEl.value.contains(t)) close();
}
function onTriggerKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    close();
  } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (!open.value) open.value = true;
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown);
});
</script>

<style scoped>
.pd-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
}
.pd-field__req {
  color: var(--dex-color-red-600, #dc2626);
  margin-left: 2px;
}
.pd-field__hidden-select {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
  padding: 0;
  margin: -1px;
}

.multiselect.quote-status {
  position: relative;
}
.pd-field__trigger {
  min-height: 60px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--dex-borderColor-default, #d1d5db);
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  grid-template-areas:
    'label caret'
    'value caret';
  align-items: center;
  text-align: left;
  cursor: pointer;
}
.pd-field__trigger:focus {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: -1px;
  border-color: transparent;
}
.pd-field__trigger-label {
  grid-area: label;
  font-weight: 600;
  font-size: 12px;
  color: var(--dex-fgColor-muted, #6b7280);
  letter-spacing: 0.02em;
}
.pd-field__value {
  grid-area: value;
  color: var(--dex-fgColor-default, #272727);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pd-field__value--placeholder {
  color: var(--dex-fgColor-muted, #9ca3af);
}
.pd-field__caret {
  grid-area: caret;
  color: var(--dex-fgColor-muted, #6b7280);
  font-size: 12px;
}

.multiselect.quote-status.active .pd-field__trigger {
  border-color: var(--dex-color-blue-600, #2563eb);
  box-shadow: 0 0 0 3px var(--dex-color-blue-100, #dbeafe);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid var(--dex-borderColor-default, #d1d5db);
  border-radius: 8px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
  z-index: 200;
  max-height: 260px;
  overflow-y: auto;
}
.dropdown-menu-list {
  list-style: none;
  margin: 0;
  padding: 4px;
}
.menu-item-root {
  padding: 10px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: var(--dex-fgColor-default, #272727);
}
.menu-item-root:hover,
.menu-item-root[aria-selected='true'] {
  background: var(--dex-color-blue-50, #eff6ff);
  color: var(--dex-color-blue-800, #1e40af);
}
.menu-item-root__label {
  display: block;
}
</style>
