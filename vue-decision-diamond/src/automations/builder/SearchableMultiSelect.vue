<template>
  <div class="sms-field">
    <div
      ref="rootEl"
      class="multiselect searchable multiple"
      :class="{ active: open }"
    >
      <button
        ref="triggerEl"
        type="button"
        class="dropdown-reference sms-field__trigger"
        :aria-haspopup="'listbox'"
        :aria-expanded="open"
        :aria-controls="`${id}-menu`"
        :disabled="disabled"
        @click="toggle"
        @keydown="onTriggerKeydown"
      >
        <span class="sms-field__value-wrap">
          <span class="sms-field__label-row">
            <label class="required">{{ label }}</label>
          </span>
          <span v-if="selected.length === 0" class="sms-field__placeholder">
            {{ placeholder }}
          </span>
          <span v-else class="sms-field__chips">
            <span
              v-for="o in selected"
              :key="o.value"
              class="sms-field__chip"
            >
              {{ o.label }}
              <button
                type="button"
                class="sms-field__chip-x"
                :aria-label="`Remove ${o.label}`"
                @click.stop="onRemove(o.value)"
              >
                ×
              </button>
            </span>
          </span>
        </span>
        <span class="sms-field__caret" aria-hidden="true">▾</span>
      </button>

      <div v-if="open" class="dropdown-menu open">
        <div class="sms-field__search-row">
          <input
            ref="searchEl"
            v-model="query"
            type="text"
            class="sms-field__search"
            :placeholder="searchPlaceholder ?? 'Search'"
            @keydown.esc.stop="close"
          />
        </div>
        <ul
          :id="`${id}-menu`"
          class="dropdown-menu-list"
          role="listbox"
          aria-multiselectable="true"
        >
          <li
            v-for="o in visibleOptions"
            :key="o.value"
            class="menu-item-root"
            role="option"
            :aria-selected="isSelected(o.value)"
            :data-qa="o.label"
            @click="onToggle(o.value)"
          >
            <span class="sms-checkbox" aria-hidden="true">
              <span
                class="sms-checkbox__box"
                :class="{ 'sms-checkbox__box--on': isSelected(o.value) }"
              >
                <span
                  v-if="isSelected(o.value)"
                  class="sms-checkbox__tick"
                  aria-hidden="true"
                >✓</span>
              </span>
            </span>
            <span class="menu-item">
              <span class="ds-stack ds-stack--align-y-top">
                <span class="ds-text menu-item-root__name">{{ o.label }}</span>
                <span
                  v-if="o.subtitle"
                  class="ds-text ds-text--caption menu-item-root__sub"
                >
                  {{ o.subtitle }}
                </span>
              </span>
            </span>
          </li>
          <li
            v-if="visibleOptions.length === 0"
            class="menu-item-root menu-item-root--empty"
            role="presentation"
          >
            {{ emptyMessage }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

type Option = { value: string; label: string; subtitle?: string };

const props = defineProps<{
  id: string;
  label: string;
  options: Option[];
  value: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  /** Message in the empty-state row. When `requireQuery` is on this
   *  doubles as the prompt to start typing. */
  emptyMessage?: string;
  /** When true, the option list stays empty until the user types into
   *  the search input. Used for API-driven dropdowns (e.g. Products)
   *  where pre-loading the full catalogue is undesirable. The parent
   *  is responsible for populating `options` in response to `query`
   *  via the `update:query` event. */
  requireQuery?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:value': [value: string[]];
  'update:query': [query: string];
}>();

const open = ref(false);
const query = ref('');
const rootEl = ref<HTMLElement | null>(null);
const triggerEl = ref<HTMLButtonElement | null>(null);
const searchEl = ref<HTMLInputElement | null>(null);

const selected = computed(() =>
  props.value
    .map((v) => props.options.find((o) => o.value === v))
    .filter((o): o is Option => !!o),
);

const visibleOptions = computed(() => {
  const q = query.value.trim().toLowerCase();
  // requireQuery + no query → empty list. Lets API-backed dropdowns
  // show "Start typing to search" instead of dumping every record.
  if (props.requireQuery && !q) return [];
  if (!q) return props.options;
  return props.options.filter(
    (o) =>
      o.label.toLowerCase().includes(q) ||
      (o.subtitle ?? '').toLowerCase().includes(q),
  );
});

function isSelected(value: string) {
  return props.value.includes(value);
}

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) nextTick(() => searchEl.value?.focus());
}
function close() {
  open.value = false;
  query.value = '';
}
function onToggle(value: string) {
  const next = isSelected(value)
    ? props.value.filter((v) => v !== value)
    : [...props.value, value];
  emit('update:value', next);
  // Keep the picker open so the user can pick multiple in one trip.
  nextTick(() => searchEl.value?.focus());
}
function onRemove(value: string) {
  emit('update:value', props.value.filter((v) => v !== value));
}

watch(query, (q) => emit('update:query', q));

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
    if (!open.value) {
      open.value = true;
      nextTick(() => searchEl.value?.focus());
    }
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
.sms-field {
  position: relative;
}
.multiselect {
  position: relative;
}
.sms-field__trigger {
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
.sms-field__trigger:focus {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: -1px;
  border-color: transparent;
}
.multiselect.active .sms-field__trigger {
  border-color: var(--dex-color-blue-600, #2563eb);
  box-shadow: 0 0 0 3px var(--dex-color-blue-100, #dbeafe);
}
.sms-field__value-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}
.sms-field__label-row .required {
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.02em;
  color: var(--dex-fgColor-muted, #6b7280);
}
.sms-field__label-row .required::after {
  content: '*';
  color: var(--dex-color-red-600, #dc2626);
  margin-left: 2px;
}
.sms-field__placeholder {
  color: var(--dex-fgColor-muted, #9ca3af);
}
.sms-field__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.sms-field__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--dex-color-blue-50, #eff6ff);
  color: var(--dex-color-blue-800, #1e40af);
  border-radius: 999px;
  padding: 2px 4px 2px 10px;
  font-size: 12px;
  font-weight: 500;
}
.sms-field__chip-x {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 0;
  width: 16px;
  height: 16px;
  line-height: 14px;
  border-radius: 999px;
  color: var(--dex-color-blue-800, #1e40af);
  cursor: pointer;
}
.sms-field__chip-x:hover {
  background: var(--dex-color-blue-100, #dbeafe);
}
.sms-field__caret {
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
  max-height: 320px;
  display: flex;
  flex-direction: column;
}
.sms-field__search-row {
  padding: 8px;
  border-bottom: 1px solid var(--dex-borderColor-alpha-subtle, #f1f5f9);
}
.sms-field__search {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--dex-borderColor-default, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
}
.sms-field__search:focus {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: -1px;
  border-color: transparent;
}
.dropdown-menu-list {
  list-style: none;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  flex: 1;
}
.menu-item-root {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.menu-item-root:hover {
  background: var(--dex-color-gray-50, #f9fafb);
}
.menu-item-root[aria-selected='true'] {
  background: var(--dex-color-blue-50, #eff6ff);
}
.menu-item-root--empty {
  color: var(--dex-fgColor-muted, #6b7280);
  font-size: 13px;
  cursor: default;
}
.menu-item-root--empty:hover {
  background: transparent;
}

.sms-checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  margin-top: 1px;
}
.sms-checkbox__box {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1.5px solid var(--dex-borderColor-default, #d1d5db);
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.sms-checkbox__box--on {
  background: var(--dex-color-blue-600, #2563eb);
  border-color: var(--dex-color-blue-600, #2563eb);
}
.sms-checkbox__tick {
  font-size: 11px;
  color: #fff;
  line-height: 1;
}

.menu-item {
  display: flex;
  min-width: 0;
  flex: 1;
}
.ds-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.menu-item-root__name {
  font-weight: 500;
  color: var(--dex-fgColor-default, #272727);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.menu-item-root__sub {
  font-size: 12px;
  color: var(--dex-fgColor-muted, #6b7280);
}
</style>
