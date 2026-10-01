<template>
  <div
    ref="pickerEl"
    class="dd-picker"
    :style="{ left: `${placedLeft}px`, top: `${placedTop}px` }"
    role="dialog"
    aria-label="Add a step"
  >
    <div class="dd-picker__header">
      <DexInput
        ref="inputRef"
        v-model="query"
        type="search"
        label="Search"
        label-hidden
        placeholder="Search"
        @keydown.esc="$emit('close')"
      >
        <template #leading>
          <DexIcon name="search" />
        </template>
      </DexInput>
    </div>

    <div class="dd-picker__body">
      <button
        v-if="ddVisible"
        class="dd-picker__featured"
        type="button"
        @click="$emit('pick-decision-diamond')"
      >
        <span class="dd-picker__featured-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              d="M12 2 L22 12 L12 22 L2 12 Z"
              fill="#fff"
              stroke="#fff"
              stroke-width="0"
            />
          </svg>
        </span>
        <span class="dd-picker__featured-text">
          <span class="dd-picker__featured-title">Decision diamond</span>
          <span class="dd-picker__featured-desc">
            Branch the flow on a deal, appointment, invoice, job, or contact.
          </span>
        </span>
      </button>

      <!-- When triggers section -->
      <div v-if="filteredWhen.length > 0" class="dd-picker__group">
        <div class="dd-picker__section-title">When triggers</div>
        <div class="dd-picker__list">
          <button
            v-for="item in filteredWhen"
            :key="`w-${item.slug}`"
            class="dd-picker__item"
            type="button"
            @click="onPickWhen(item)"
          >
            <span
              class="dd-picker__item-icon"
              v-html="sizedSvg(item.svg, 20)"
            />
            <span class="dd-picker__item-label">{{ item.title }}</span>
          </button>
        </div>
      </div>

      <!-- Then triggers section -->
      <div v-if="filteredThen.length > 0" class="dd-picker__group">
        <div class="dd-picker__section-title">Then triggers</div>
        <div class="dd-picker__list">
          <button
            v-for="item in filteredThen"
            :key="`t-${item.slug}`"
            class="dd-picker__item"
            type="button"
            @click="onPickThen(item)"
          >
            <span
              class="dd-picker__item-icon"
              v-html="sizedSvg(item.svg, 20)"
            />
            <span class="dd-picker__item-label">{{ item.title }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { DexInput, DexIcon } from '@thryvlabs/dex-vue';

type IconItem = { title: string; slug: string; svg: string };

const props = defineProps<{
  type: 'when' | 'then';
  anchor: { x: number; y: number };
  /** When provided, the picker positions itself under this button rect
   *  (4 px gap), left-aligned to btn.left by default, flipping to
   *  right-aligned (so picker.right === btn.right) if it would overflow
   *  the canvas wrap. Falls back to raw `anchor` if absent. */
  anchorBtn?: { left: number; right: number; bottom: number };
  items: IconItem[];
  whenItems?: IconItem[];
  thenItems?: IconItem[];
  /** Hide the featured "Decision diamond" row. Used by the empty-state
   *  Starting-point picker since a diamond can't be the first node — it
   *  always needs an upstream trigger. */
  hideDecisionDiamond?: boolean;
  /** Center the picker horizontally under the anchor button (so the
   *  picker's vertical centerline aligns with the button's centerline)
   *  instead of left-aligning to btn.left. Used by the empty-state
   *  Starting-point picker for a balanced first-impression look. */
  centerOnAnchor?: boolean;
}>();

const emit = defineEmits<{
  pick: [item: IconItem];
  'pick-when': [item: IconItem];
  'pick-then': [item: IconItem];
  'pick-decision-diamond': [];
  close: [];
}>();

function onPickWhen(item: IconItem) {
  emit('pick-when', item);
}
function onPickThen(item: IconItem) {
  emit('pick-then', item);
}

const query = ref('');
const inputRef = ref<{ $el?: HTMLElement } | null>(null);
const pickerEl = ref<HTMLElement | null>(null);

/** Computed live position. Defaults to the button's left edge (left-
 *  aligned drop-down). After mount we measure overflow and switch to
 *  right-alignment if the picker would clip the canvas wrap's right
 *  edge. Falls back to the raw `anchor` if no button rect was given. */
const placedLeft = ref<number>(props.anchorBtn?.left ?? props.anchor.x);
const placedTop = ref<number>(props.anchorBtn?.bottom ?? props.anchor.y);

function applySmartAlignment() {
  if (!props.anchorBtn) return;
  const picker = pickerEl.value;
  if (!picker) return;

  // Everything is in DOCUMENT coords (CSS `left` is relative to the
  // initial containing block, which starts at document 0,0). The
  // anchor coords were stored in document coords by openPicker, so we
  // convert the canvas wrap's viewport rect into document coords by
  // adding window.scrollX. This makes the comparison and the eventual
  // `placedLeft` value all live in the same coordinate system.
  const wrap = document.querySelector(
    '.builder__canvas-wrap',
  ) as HTMLElement | null;
  const sx = window.scrollX || 0;
  const boundsRight = wrap
    ? wrap.getBoundingClientRect().right + sx
    : window.innerWidth + sx;
  const boundsLeft = wrap
    ? wrap.getBoundingClientRect().left + sx
    : sx;
  const pickerWidth = picker.getBoundingClientRect().width;

  // Default: left-aligned to the + button's left edge so the dropdown
  // visually descends from the button. When `centerOnAnchor` is set
  // (empty-state Starting-point picker), center the picker under the
  // button's horizontal midpoint instead.
  let next: number;
  if (props.centerOnAnchor) {
    const btnCenterX = (props.anchorBtn.left + props.anchorBtn.right) / 2;
    next = btnCenterX - pickerWidth / 2;
  } else {
    next = props.anchorBtn.left;
  }

  // If the chosen placement would overflow the wrap's right edge, try
  // the mirrored placement: right-aligned (so picker.right === btn.right).
  // Only switch if the right-aligned placement *also* doesn't underflow
  // the wrap's left edge — otherwise the picker can't fit either way,
  // and staying near the button is less jarring than throwing the
  // picker far to one side, away from its trigger.
  const wouldOverflowRight = next + pickerWidth > boundsRight - 8;
  const wouldUnderflowLeft = next < boundsLeft + 8;
  if (wouldOverflowRight) {
    const rightAligned = props.anchorBtn.right - pickerWidth;
    if (rightAligned >= boundsLeft + 8) {
      next = rightAligned;
    }
  } else if (wouldUnderflowLeft) {
    next = boundsLeft + 8;
  }
  placedLeft.value = next;
}

function onDocPointerDown(e: PointerEvent) {
  const target = e.target as Node;
  if (pickerEl.value && !pickerEl.value.contains(target)) {
    emit('close');
  }
}
function onDocKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    emit('close');
  }
}

onMounted(() => {
  // Smart-alignment: measure after the picker has its real width and
  // flip horizontally if it would clip the canvas wrap's right edge.
  // Two rAFs — one for first paint, one for any DOM settling. Also
  // re-run on window resize so the picker stays inside the wrap if the
  // viewport changes while open.
  requestAnimationFrame(() => {
    applySmartAlignment();
    requestAnimationFrame(() => applySmartAlignment());
  });
  window.addEventListener('resize', applySmartAlignment);

  // Try to focus the input on next tick.
  requestAnimationFrame(() => {
    const el = (inputRef.value?.$el ?? null) as HTMLElement | null;
    el?.querySelector('input')?.focus();
  });
  // Outside-click + Escape close (per HANDOFF §7).
  // Use pointerdown so we close BEFORE node clicks fire.
  document.addEventListener('pointerdown', onDocPointerDown, true);
  document.addEventListener('keydown', onDocKeyDown, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true);
  document.removeEventListener('keydown', onDocKeyDown, true);
  window.removeEventListener('resize', applySmartAlignment);
});

const filteredItems = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.items;
  return props.items.filter((it) =>
    it.title.toLowerCase().includes(q) || it.slug.includes(q),
  );
});

function filterList(list: IconItem[] | undefined): IconItem[] {
  if (!list) return [];
  const q = query.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (it) => it.title.toLowerCase().includes(q) || it.slug.includes(q),
  );
}

const filteredWhen = computed(() => filterList(props.whenItems));
const filteredThen = computed(() => filterList(props.thenItems));

const ddVisible = computed(() => {
  if (props.hideDecisionDiamond) return false;
  const q = query.value.trim().toLowerCase();
  if (!q) return true;
  return q.includes('decision') || q.includes('diamond') || q.includes('branch');
});

function sizedSvg(svg: string, size: number) {
  return svg
    .replace(/\swidth=['"][^'"]*['"]/, '')
    .replace(/\sheight=['"][^'"]*['"]/, '')
    .replace(/<svg /, `<svg width="${size}" height="${size}" `);
}
</script>

<style scoped>
.dd-picker {
  position: absolute;
  z-index: 50;
  width: 320px;
  max-height: 480px;
  display: flex;
  flex-direction: column;
  background: var(--dex-color-white, #fff);
  border: 1px solid var(--dex-color-gray-200, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  /* Inverse-scale against the canvas zoom so the picker renders at
   * native readable size at any zoom level. */
  transform: scale(calc(1 / var(--canvas-zoom, 1)));
  transform-origin: top left;
}
.dd-picker__header {
  padding: 8px;
  border-bottom: 1px solid var(--dex-color-gray-200, #e5e7eb);
}
.dd-picker__body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.dd-picker__featured {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f4f1ff;
  border: 1px solid #e0d7fa;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  margin-bottom: 8px;
}
.dd-picker__featured:hover {
  background: #ece6ff;
}
.dd-picker__featured-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #8358f1;
  border-radius: 6px;
  color: #fff;
  flex-shrink: 0;
}
.dd-picker__featured-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dd-picker__featured-title {
  font-weight: 600;
  font-size: 14px;
  color: #272727;
}
.dd-picker__featured-desc {
  font-size: 12px;
  color: var(--dex-color-gray-700, #6b7280);
}
.dd-picker__section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--dex-color-gray-700, #6b7280);
  margin: 8px 4px;
  letter-spacing: 0.04em;
}
.dd-picker__list {
  display: flex;
  flex-direction: column;
}
.dd-picker__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  color: #272727;
}
.dd-picker__item:hover {
  background: var(--dex-color-gray-100, #f3f4f6);
}
.dd-picker__item-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dd-picker__item-label {
  flex: 1;
}
</style>
