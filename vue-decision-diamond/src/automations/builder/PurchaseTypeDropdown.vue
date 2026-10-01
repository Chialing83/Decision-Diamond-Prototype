<template>
  <div class="ptd-field">
    <div
      ref="rootEl"
      class="multiselect"
      :class="{ active: open }"
    >
      <button
        ref="triggerEl"
        type="button"
        class="dropdown-reference ptd-field__trigger"
        :class="{ 'ptd-field__trigger--placeholder': !selected }"
        :aria-haspopup="'listbox'"
        :aria-expanded="open"
        :aria-controls="`${id}-menu`"
        :disabled="disabled"
        @click="toggle"
        @keydown="onTriggerKeydown"
      >
        <span class="ptd-field__value-wrap">
          <span class="ptd-field__label-row">
            <label class="required">{{ label }}</label>
          </span>
          <span v-if="selected" class="ptd-field__name">
            {{ selected.label }}
          </span>
          <span v-else class="ptd-field__placeholder">
            {{ placeholder }}
          </span>
        </span>
        <span class="ptd-field__caret" aria-hidden="true">▾</span>
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
            :class="{ highlight: o.value === value }"
            role="option"
            :aria-selected="o.value === value"
            :data-qa="o.label"
            @click="onPick(o.value)"
          >
            <div class="menu-item">
              <div class="ds-stack ds-stack--align-y-top">
                <span class="ds-text menu-item-root__name">{{ o.label }}</span>
                <span
                  v-if="o.subtitle"
                  class="ds-text ds-text--caption menu-item-root__sub"
                >
                  {{ o.subtitle }}
                </span>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <select
      :id="id"
      class="ptd-field__hidden-select"
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

type Option = { value: string; label: string; subtitle?: string };

const props = defineProps<{
  id: string;
  label: string;
  options: Option[];
  value: string | undefined;
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:value': [value: string] }>();

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);
const triggerEl = ref<HTMLButtonElement | null>(null);

const selected = computed(() =>
  props.value ? props.options.find((o) => o.value === props.value) : undefined,
);

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
.ptd-field {
  position: relative;
}
.ptd-field__hidden-select {
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
.multiselect {
  position: relative;
}
.ptd-field__trigger {
  min-height: 60px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--dex-borderColor-default, #d1d5db);
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  color: var(--dex-fgColor-default, #272727);
}
.ptd-field__trigger:focus {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: -1px;
  border-color: transparent;
}
.multiselect.active .ptd-field__trigger {
  border-color: var(--dex-color-blue-600, #2563eb);
  box-shadow: 0 0 0 3px var(--dex-color-blue-100, #dbeafe);
}
.ptd-field__value-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.ptd-field__label-row .required {
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.02em;
  color: var(--dex-fgColor-muted, #6b7280);
}
.ptd-field__label-row .required::after {
  content: '*';
  color: var(--dex-color-red-600, #dc2626);
  margin-left: 2px;
}
.ptd-field__name {
  font-weight: 500;
  color: var(--dex-fgColor-default, #272727);
}
.ptd-field__placeholder {
  color: var(--dex-fgColor-muted, #9ca3af);
}
.ptd-field__caret {
  color: var(--dex-fgColor-muted, #6b7280);
  font-size: 12px;
  flex: 0 0 auto;
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
}
.dropdown-menu-list {
  list-style: none;
  margin: 0;
  padding: 4px;
}
.menu-item-root {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.menu-item-root:hover {
  background: var(--dex-color-gray-50, #f9fafb);
}
.menu-item-root.highlight,
.menu-item-root[aria-selected='true'] {
  background: var(--dex-color-blue-50, #eff6ff);
}
.menu-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.ds-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.menu-item-root__name {
  font-size: 14px;
  font-weight: 500;
  color: var(--dex-fgColor-default, #272727);
}
.menu-item-root__sub {
  font-size: 12px;
  color: var(--dex-fgColor-muted, #6b7280);
}
</style>
