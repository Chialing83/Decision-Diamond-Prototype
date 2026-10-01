<template>
  <div ref="rootEl" class="dropsel">
    <button
      ref="triggerEl"
      type="button"
      class="dropsel__trigger dd-select"
      :class="{ 'dropsel__trigger--open': open }"
      :aria-label="ariaLabel"
      :aria-haspopup="'listbox'"
      :aria-expanded="open"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="dropsel__value" :class="{ 'dropsel__value--placeholder': !selectedLabel }">
        {{ selectedLabel || placeholder || 'Select' }}
      </span>
      <span class="dropsel__chevron" aria-hidden="true">▾</span>
    </button>

    <!-- Teleport the menu to <body> so `.dd-card`'s `overflow: hidden`
         (and any other clipping ancestor) doesn't cut the popup off. -->
    <Teleport to="body">
      <ul
        v-if="open"
        ref="menuEl"
        class="dropsel__menu"
        role="listbox"
        :aria-label="ariaLabel"
        :style="menuStyle"
      >
        <li
          v-for="opt in options"
          :key="opt.value"
          role="option"
          :aria-selected="opt.value === modelValue"
          class="dropsel__item"
          :class="{ 'dropsel__item--selected': opt.value === modelValue }"
          @click="pick(opt.value)"
        >
          <span v-if="opt.value === modelValue" class="dropsel__check" aria-hidden="true">✓</span>
          <span class="dropsel__item-label">{{ opt.label }}</span>
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * Thin custom-positioned select. Renders like a native `<select>` but
 * the popup is a real DOM listbox we control — so positioning,
 * alignment, and gap are consistent across every rule row instead of
 * defaulting to the browser's native (and OS-specific) `<select>`
 * popup behavior, which on macOS overlaps the trigger and on Windows
 * opens below at varying offsets.
 *
 * Positioning contract:
 *  - Menu opens DIRECTLY BELOW the trigger
 *  - 8 px vertical gap between trigger.bottom and menu.top
 *  - Left edge of menu aligns to left edge of trigger
 *  - Auto-flips to right-aligned if menu would overflow the viewport
 *    right edge (and similarly clamps if it would underflow the left)
 *
 * Mirrors the same v-model API the native `<select>` exposes so the
 * drop-in replacement in the rule rows is straightforward.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';

interface Option {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: Option[];
    placeholder?: string;
    ariaLabel?: string;
  }>(),
  {
    placeholder: 'Select',
    ariaLabel: undefined,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);
const triggerEl = ref<HTMLButtonElement | null>(null);
const menuEl = ref<HTMLUListElement | null>(null);
const menuStyle = ref<Record<string, string>>({});

const selectedLabel = computed(
  () => props.options.find((o) => o.value === props.modelValue)?.label ?? '',
);

function toggle() {
  open.value ? close() : openMenu();
}

function openMenu() {
  open.value = true;
  // Position the menu on the next frame so we can measure the trigger
  // accurately after Vue paints the listbox.
  requestAnimationFrame(positionMenu);
}

function close() {
  open.value = false;
}

function pick(value: string) {
  emit('update:modelValue', value);
  close();
  // Return focus to the trigger so keyboard nav stays in place
  requestAnimationFrame(() => triggerEl.value?.focus());
}

function positionMenu() {
  // Menu is teleported to <body>, so its `position: absolute` is relative
  // to the initial containing block (the document). All coordinates are
  // computed in DOCUMENT space (viewport rect + scrollX/Y) so the menu
  // moves naturally with page scroll and stays anchored to its trigger.
  //
  // Default placement: left-aligned to trigger.left, 8 px below
  // trigger.bottom. Flips to right-aligned if it would overflow the
  // viewport right; clamps if it would underflow the left.
  const t = triggerEl.value;
  const m = menuEl.value;
  if (!t || !m) return;
  const tr = t.getBoundingClientRect();
  const sx = window.scrollX || 0;
  const sy = window.scrollY || 0;
  const desiredWidth = Math.max(tr.width, 140);

  // Reset to default placement to measure cleanly
  const top = tr.bottom + sy + 8;
  let left = tr.left + sx;

  // Flip if the natural left would push the menu past the viewport right
  if (left + desiredWidth > sx + window.innerWidth - 8) {
    left = tr.right + sx - desiredWidth;
  }
  // Clamp if the chosen left would push past the viewport left
  if (left < sx + 8) left = sx + 8;

  // Bonus — if the menu would extend below the viewport, flip UPWARD so
  // it opens above the trigger instead. (Common when the trigger is
  // near the bottom of a scrollable container.)
  const menuHeight = m.getBoundingClientRect().height || 0;
  let finalTop = top;
  if (top - sy + menuHeight > window.innerHeight - 8) {
    const upward = tr.top + sy - 8 - menuHeight;
    if (upward >= sy + 8) {
      finalTop = upward;
    }
  }

  menuStyle.value = {
    position: 'absolute',
    left: `${left}px`,
    top: `${finalTop}px`,
    minWidth: `${desiredWidth}px`,
  };
}

function onDocPointerDown(e: PointerEvent) {
  if (!open.value) return;
  const target = e.target as Node;
  if (rootEl.value?.contains(target)) return;
  if (menuEl.value?.contains(target)) return;
  close();
}

function onDocKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.stopPropagation();
    close();
    triggerEl.value?.focus();
  }
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (!open.value) openMenu();
  }
}

// Lifecycle: bind/unbind document listeners while menu is open
watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onDocKeyDown, true);
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
  } else {
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    document.removeEventListener('keydown', onDocKeyDown, true);
    window.removeEventListener('resize', positionMenu);
    window.removeEventListener('scroll', positionMenu, true);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true);
  document.removeEventListener('keydown', onDocKeyDown, true);
  window.removeEventListener('resize', positionMenu);
  window.removeEventListener('scroll', positionMenu, true);
});
</script>

<style scoped>
.dropsel {
  display: inline-block;
  position: relative;
}

/* Trigger styled to match the existing .dd-select look so rule rows
 * stay visually identical to the native-select version they're
 * replacing. */
.dropsel__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid var(--dex-borderColor-alpha-subtle, #d1d5db);
  border-radius: 6px;
  font-family: inherit;
  font-size: 14px;
  color: #272727;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}
.dropsel__trigger:hover {
  border-color: var(--dex-color-gray-400, #9ca3af);
}
.dropsel__trigger:focus-visible,
.dropsel__trigger--open {
  outline: none;
  border-color: var(--dex-color-blue-700, #006ceb);
  box-shadow: 0 0 0 3px rgba(0, 108, 235, 0.15);
}
.dropsel__value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dropsel__value--placeholder {
  color: var(--dex-fgColor-muted, #6b7280);
}
.dropsel__chevron {
  font-size: 10px;
  line-height: 1;
  color: var(--dex-fgColor-muted, #6b7280);
  flex-shrink: 0;
}

/* Popup — teleported to <body>, so it can escape any clipping
 * ancestor (e.g. .dd-card with overflow: hidden). Coordinates are
 * computed in JS (document-space absolute) — see positionMenu(). */
.dropsel__menu {
  position: absolute;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: #fff;
  border: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
  border-radius: 8px;
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.12),
    0 2px 6px rgba(0, 0, 0, 0.06);
  /* Above the editor overlay (z-index: 120) so the teleported menu
   * isn't hidden behind the modal it's logically attached to. */
  z-index: 200;
  max-height: 320px;
  overflow-y: auto;
  font-family: inherit;
  font-size: 14px;
  color: #272727;
}
.dropsel__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}
.dropsel__item:hover {
  background: var(--dex-color-gray-100, #f3f4f6);
}
.dropsel__item--selected {
  background: rgba(0, 108, 235, 0.08);
  color: var(--dex-color-blue-700, #006ceb);
  font-weight: 600;
}
.dropsel__check {
  width: 12px;
  font-size: 12px;
  line-height: 1;
}
.dropsel__item-label {
  flex: 1;
}
</style>
