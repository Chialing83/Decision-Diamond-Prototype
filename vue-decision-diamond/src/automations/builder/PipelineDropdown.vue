<template>
  <div class="pd-field">
    <label :for="id" class="pd-field__label">
      {{ label }}<span v-if="required" class="pd-field__req" aria-hidden="true">*</span>
    </label>

    <!-- Hidden native select mirrors the visible dropdown's selection.
         Same option `value` ids as the visible <li> nodes so a form
         scrape can read the underlying selected ids without parsing
         the custom dropdown. -->
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

    <!-- Visible custom dropdown -->
    <div
      ref="rootEl"
      class="dropdown"
      :class="{ 'dropdown--open': open, 'dropdown--disabled': disabled }"
    >
      <button
        ref="triggerEl"
        type="button"
        class="dropdown__trigger"
        :aria-haspopup="'listbox'"
        :aria-expanded="open"
        :aria-controls="`${id}-menu`"
        :disabled="disabled"
        @click="toggle"
        @keydown="onTriggerKeydown"
      >
        <span class="dropdown__value" :class="{ 'dropdown__value--placeholder': !selectedLabel }">
          {{ selectedLabel || placeholder }}
        </span>
        <span class="dropdown__caret" aria-hidden="true">▾</span>
      </button>

      <ul
        v-if="open"
        :id="`${id}-menu`"
        class="dropdown-menu-list"
        role="listbox"
        :aria-labelledby="id"
      >
        <li
          v-for="o in options"
          :id="o.value"
          :key="o.value"
          class="dropdown-menu-item"
          role="option"
          :aria-selected="o.value === value"
          :data-qa="o.label"
          @click="onPick(o.value)"
        >
          {{ o.label }}
        </li>
        <li v-if="options.length === 0" class="dropdown-menu-empty">
          No options
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

export type Option = { value: string; label: string };

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
.pd-field__label {
  font-weight: 600;
  color: var(--dex-fgColor-default, #272727);
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

.dropdown {
  position: relative;
}
.dropdown__trigger {
  height: 36px;
  width: 100%;
  padding: 0 10px;
  border: 1px solid var(--dex-borderColor-default, #d1d5db);
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  color: var(--dex-fgColor-default, #272727);
}
.dropdown__trigger:focus {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: -1px;
  border-color: transparent;
}
.dropdown--disabled .dropdown__trigger {
  background: var(--dex-color-gray-50, #f9fafb);
  color: var(--dex-fgColor-muted, #6b7280);
  cursor: not-allowed;
}
.dropdown__value {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dropdown__value--placeholder {
  color: var(--dex-fgColor-muted, #9ca3af);
}
.dropdown__caret {
  color: var(--dex-fgColor-muted, #6b7280);
  margin-left: 8px;
  font-size: 12px;
}

.dropdown-menu-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: #fff;
  border: 1px solid var(--dex-borderColor-default, #d1d5db);
  border-radius: 8px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
  z-index: 200;
  max-height: 240px;
  overflow-y: auto;
}
.dropdown-menu-item {
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: var(--dex-fgColor-default, #272727);
}
.dropdown-menu-item:hover,
.dropdown-menu-item[aria-selected='true'] {
  background: var(--dex-color-blue-50, #eff6ff);
  color: var(--dex-color-blue-800, #1e40af);
}
.dropdown-menu-empty {
  padding: 8px 10px;
  font-size: 13px;
  color: var(--dex-fgColor-muted, #6b7280);
}
</style>
