<template>
  <div class="atd-field">
    <!-- Same .multiselect family as QuoteStatusDropdown but without
         the `.quote-status` modifier — each trigger gets its own
         scope class so QA selectors stay disambiguated. Items keep
         the .menu-item-root + data-qa shape and add a calendar icon
         plus a two-line label (name + duration). -->
    <div
      ref="rootEl"
      class="multiselect"
      :class="{ active: open }"
    >
      <button
        ref="triggerEl"
        type="button"
        class="dropdown-reference atd-field__trigger"
        :class="{ 'atd-field__trigger--placeholder': !selected }"
        :aria-haspopup="'listbox'"
        :aria-expanded="open"
        :aria-controls="`${id}-menu`"
        :disabled="disabled"
        @click="toggle"
        @keydown="onTriggerKeydown"
      >
        <span class="atd-field__value-wrap">
          <template v-if="selected">
            <span class="atd-field__name">{{ selected.label }}</span>
            <span v-if="selected.subtitle" class="atd-field__sub">
              {{ selected.subtitle }}
            </span>
          </template>
          <span v-else class="atd-field__placeholder">
            <label class="required">{{ placeholder }}</label>
          </span>
        </span>
        <span class="atd-field__caret" aria-hidden="true">▾</span>
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
            class="menu-item-root has-icon"
            role="option"
            :aria-selected="o.value === value"
            :data-qa="o.label"
            @click="onPick(o.value)"
          >
            <span class="menu-item-root__icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="16" height="16">
                <rect
                  x="1.5" y="3" width="13" height="11.5" rx="1.5"
                  fill="none" stroke="currentColor" stroke-width="1.2"
                />
                <line
                  x1="1.5" y1="6.5" x2="14.5" y2="6.5"
                  stroke="currentColor" stroke-width="1.2"
                />
                <line
                  x1="5" y1="1.5" x2="5" y2="4.5"
                  stroke="currentColor" stroke-width="1.2" stroke-linecap="round"
                />
                <line
                  x1="11" y1="1.5" x2="11" y2="4.5"
                  stroke="currentColor" stroke-width="1.2" stroke-linecap="round"
                />
              </svg>
            </span>
            <span class="menu-item-root__text">
              <span class="menu-item-root__name">{{ o.label }}</span>
              <span v-if="o.subtitle" class="menu-item-root__sub">
                {{ o.subtitle }}
              </span>
            </span>
          </li>
          <li v-if="options.length === 0" class="menu-item-root menu-item-root--empty">
            No appointment types
          </li>
        </ul>
      </div>
    </div>

    <select
      :id="id"
      class="atd-field__hidden-select"
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
.atd-field {
  position: relative;
}
.atd-field__hidden-select {
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
.atd-field__trigger {
  min-height: 52px;
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
.atd-field__trigger:focus {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: -1px;
  border-color: transparent;
}
.atd-field__value-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.atd-field__name {
  font-weight: 500;
  color: var(--dex-fgColor-default, #272727);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.atd-field__sub {
  font-size: 12px;
  color: var(--dex-fgColor-muted, #6b7280);
}
.atd-field__placeholder {
  color: var(--dex-fgColor-muted, #6b7280);
}
.atd-field__placeholder .required::after {
  content: '*';
  color: var(--dex-color-red-600, #dc2626);
  margin-left: 2px;
}
.atd-field__caret {
  color: var(--dex-fgColor-muted, #6b7280);
  font-size: 12px;
  flex: 0 0 auto;
}

.multiselect.active .atd-field__trigger {
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
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
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
.menu-item-root__icon {
  color: var(--dex-fgColor-muted, #6b7280);
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.menu-item-root__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.menu-item-root__name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.menu-item-root__sub {
  font-size: 12px;
  color: var(--dex-fgColor-muted, #6b7280);
}
.menu-item-root--empty {
  padding: 10px;
  color: var(--dex-fgColor-muted, #6b7280);
  font-size: 13px;
  cursor: default;
}
</style>
