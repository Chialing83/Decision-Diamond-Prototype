<template>
  <div class="builder">
    <header class="builder__topbar">
      <div class="builder__topbar-left">
        <DexIconButton
          name="x"
          label="Close"
          @click="router.push('/automations')"
        />
        <div class="builder__title-block">
          <DexText variant="heading-3" as="h1" class="builder__title">
            {{ campaignName }}
          </DexText>
          <div class="builder__subtitle-row">
            <span class="builder__subtitle">{{ campaignSubtitle }}</span>
            <span class="builder__status-pill">{{ campaignStatusLabel }}</span>
          </div>
        </div>
      </div>

      <div class="builder__topbar-right">
        <span class="builder__saved">
          <DexIcon name="check-circle" aria-hidden="true" />
          Saved at {{ savedAt }}
        </span>
        <span class="builder__divider" aria-hidden="true" />
        <label class="builder__features">
          <span>Try new automation features</span>
          <button
            type="button"
            class="builder__switch"
            role="switch"
            :aria-checked="newFeaturesOn"
            @click="newFeaturesOn = !newFeaturesOn"
          >
            <span
              class="builder__switch-thumb"
              :class="{ 'builder__switch-thumb--on': newFeaturesOn }"
            />
          </button>
        </label>
        <span class="builder__divider" aria-hidden="true" />
        <button type="button" class="builder__reporting-link">
          <DexIcon name="bar-chart" aria-hidden="true" />
          Reporting
        </button>
        <span class="builder__divider" aria-hidden="true" />
        <DexDropdownMenu align="end">
          <template #default>
            <DexIconButton name="more-vertical" label="More options" />
          </template>
          <template #content>
            <DexDropdownMenuItem title="Rename / edit categories" />
            <DexDropdownMenuItem title="Make a Copy…" />
            <DexDropdownMenuItem title="Save Version" />
            <DexDropdownMenuItem title="Restore" />
            <DexDropdownMenuItem title="Revert Changes" />
            <DexDropdownMenuItem title="Merge Fields" />
            <DexDropdownMenuItem title="Links" />
            <DexDropdownMenuItem
              title="Delete Automation"
              variant="danger"
            />
          </template>
        </DexDropdownMenu>
        <DexButton variant="solid">Publish</DexButton>
      </div>
    </header>

    <div class="builder__body">
      <!-- Left sidebar: When / Then panel -->
      <aside
        v-if="!sidebarCollapsed"
        class="builder__sidebar"
        aria-label="Triggers and actions"
      >
        <div class="builder__sidebar-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="sidebarTab === 'when'"
            class="builder__sidebar-tab builder__sidebar-tab--when"
            :class="{ 'builder__sidebar-tab--active': sidebarTab === 'when' }"
            @click="sidebarTab = 'when'"
          >
            When
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="sidebarTab === 'then'"
            class="builder__sidebar-tab builder__sidebar-tab--then"
            :class="{ 'builder__sidebar-tab--active': sidebarTab === 'then' }"
            @click="sidebarTab = 'then'"
          >
            Then
          </button>
          <DexIconButton
            name="sidebar"
            label="Collapse panel"
            class="builder__sidebar-collapse"
            @click="sidebarCollapsed = true"
          />
        </div>

        <div class="builder__sidebar-search">
          <DexIcon name="search" aria-hidden="true" />
          <input
            v-model="sidebarQuery"
            type="search"
            :placeholder="`Search ${sidebarTab} triggers`"
            class="builder__sidebar-search-input"
            :aria-label="`Search ${sidebarTab} triggers`"
          />
        </div>

        <ul class="builder__sidebar-list" role="list">
          <li
            v-for="item in filteredSidebarItems"
            :key="item.slug"
            class="builder__sidebar-item"
            :title="item.title"
            draggable="true"
            @click="onSidebarItemClick(item)"
            @dragstart="onSidebarDragStart(item, $event)"
            @dragend="onSidebarDragEnd"
          >
            <span class="builder__sidebar-item-icon" v-html="item.svg" />
            <span class="builder__sidebar-item-label">{{ item.title }}</span>
            <span
              v-if="NEW_TRIGGER_SLUGS.has(item.slug)"
              class="builder__sidebar-item-new"
            >New</span>
          </li>
        </ul>
      </aside>

      <button
        v-else
        type="button"
        class="builder__sidebar-expand"
        aria-label="Expand panel"
        @click="sidebarCollapsed = false"
      >
        <DexIcon name="sidebar" />
      </button>

    <div
      ref="canvasWrapEl"
      class="builder__canvas-wrap"
      :class="{
        'builder__canvas-wrap--pan-mode': panMode && !isPanning,
        'builder__canvas-wrap--panning': isPanning,
      }"
      @click="onCanvasClick"
      @mousedown="onCanvasMouseDown"
      @pointerdown="onCanvasPointerDown"
      @dragover.prevent="onCanvasDragOver"
      @drop.prevent="onCanvasDrop"
    >
      <div
        class="builder__surface"
        :style="{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          '--canvas-zoom': zoom,
        }"
      >
      <svg
        class="builder__edges"
        :viewBox="viewBox"
        :width="surfaceBounds.width"
        :height="surfaceBounds.height"
        :style="{
          left: `${surfaceBounds.minX}px`,
          top: `${surfaceBounds.minY}px`,
        }"
        preserveAspectRatio="xMinYMin meet"
      >
        <defs>
          <!-- Arrow markers retired — connectors now render without
               an arrowhead per the spec update. -->

        </defs>
        <!-- Live drag-to-connect preview -->
        <path
          v-if="connecting"
          :d="connectingPath"
          fill="none"
          :stroke="connecting?.targetId ? '#000000' : '#9CA3AF'"
          stroke-width="2.5"
          stroke-dasharray="6 4"
          pointer-events="none"
        />
        <g
          v-for="edge in edges"
          :key="edge.id"
          class="edge-group"
          :class="{
            'edge-group--selected': selectedEdgeId === edge.id,
            'edge-group--locked': isLockedEdge(edge.id),
          }"
          @click.stop="onEdgeClick(edge.id)"
        >
          <!-- Invisible 15-px hit stroke so the 2-px line is clickable. -->
          <path
            v-if="!isLockedEdge(edge.id)"
            :d="edgePath(edge)"
            fill="none"
            stroke="transparent"
            stroke-width="15"
            pointer-events="stroke"
            class="edge-hit"
          />
          <!-- Visible connector line — no arrowhead (per spec). -->
          <path
            :d="edgePath(edge)"
            fill="none"
            :stroke="
              isLockedEdge(edge.id)
                ? '#9CA3AF'
                : selectedEdgeId === edge.id
                  ? '#2563eb'
                  : '#ddd'
            "
            stroke-width="2"
            stroke-linecap="round"
            :stroke-dasharray="isLockedEdge(edge.id) ? '6 4' : undefined"
            class="edge-line"
            pointer-events="none"
          />
          <!-- Lock badge centered on locked edges (HANDOFF §10.5) -->
          <g
            v-if="isLockedEdge(edge.id)"
            :transform="`translate(${edgeMidpoint(edge).x}, ${edgeMidpoint(edge).y})`"
            style="cursor: help"
          >
            <title>Locked dependency — Confirm Email is auto-managed.</title>
            <circle r="14" fill="#fff" stroke="#9CA3AF" stroke-width="1.5" />
            <path
              d="M -4 -2 H 4 V 4 H -4 Z M -2 -2 V -4 A 2 2 0 0 1 2 -4 V -2"
              fill="none"
              stroke="#4A4A4A"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </g>
        </g>
      </svg>

      <!-- Floating "Delete connection" pill at the midpoint of the
           currently-selected edge. -->
      <button
        v-if="selectedEdge"
        type="button"
        class="edge-delete-pill"
        :style="edgeDeletePillStyle"
        @click.stop="deleteSelectedEdge"
        @pointerdown.stop
      >
        <DexIcon name="trash-2" aria-hidden="true" />
        Delete connection
      </button>

      <!-- Empty state intentionally lives OUTSIDE .builder__surface
           (see sibling block below the surface close) so the centered
           card ignores pan/zoom transforms and always sits in the
           geometric middle of the visible canvas. -->

      <div
        v-for="node in nodes"
        :key="node.id"
        class="node"
        :class="{
          'node--decision': node.type === 'decision',
          'node--trigger': node.type === 'trigger',
          'node--action': node.type === 'action',
          'node--selected': selectedNodeIds.has(node.id),
          'node--multi-selected': selectedNodeIds.size > 1 && selectedNodeIds.has(node.id),
          'node--dragging': nodeDrag?.ids?.includes(node.id),
        }"
        :style="nodeStyle(node)"
        @click.stop="onNodeClick(node, $event)"
        @pointerdown="onNodePointerDown(node, $event)"
      >
        <div v-if="node.type === 'decision'" class="node__decision-wrap">
          <div
            class="node__decision-shape"
            :class="{
              'node__decision-shape--selected': selectedNodeIds.has(node.id),
            }"
          >
            <span class="node__decision-dot" aria-hidden="true" />
          </div>
          <div class="node__caption">{{ node.title || 'Decision Diamond' }}</div>
        </div>

        <div v-else class="node__tile-wrap">
          <div
            class="node__tile"
            :class="{
              'node__tile--selected':
                selectedNodeIds.has(node.id) &&
                connecting?.targetId !== node.id,
              'node__tile--connect-target':
                connecting?.targetId === node.id,
            }"
            @dblclick.stop="onNodeDoubleClick(node)"
          >
            <span
              v-if="nodeIconSvg(node)"
              class="node__tile-icon"
              v-html="nodeIconSvg(node)"
            />
            <span
              v-else
              class="node__tile-icon node__tile-icon--fallback"
              aria-hidden="true"
            >
              {{ node.type === 'trigger' ? 'W' : 'T' }}
            </span>
            <span class="node__tile-dot" aria-hidden="true" />
          </div>
          <textarea
            v-if="renamingNodeId === node.id"
            ref="renameInputs"
            class="node__caption node__caption--rename"
            :value="renameDraft"
            rows="2"
            @click.stop
            @mousedown.stop
            @input="onRenameInput($event)"
            @keydown.enter.prevent="commitRename(node.id)"
            @keydown.esc.prevent="cancelRename"
            @blur="commitRename(node.id)"
          />
          <button
            v-else
            type="button"
            class="node__caption node__caption--button"
            :title="`Click to rename — ${node.title}`"
            @click.stop="startRename(node)"
            @mousedown.stop
          >
            {{ node.title }}
          </button>
        </div>

        <!-- Status tooltip above the node (visible on node hover) -->
        <div class="node__status-tooltip" aria-hidden="true">Published</div>

        <button
          type="button"
          class="node__add"
          :class="{ 'node__add--active': pickerOriginId === node.id }"
          aria-label="Add a step after this"
          @click.stop="openPicker(node, $event)"
          @pointerdown.stop="beginConnect(node, $event)"
        >
          <DexIcon name="add" aria-hidden="true" />
          <span class="node__add-tooltip" role="tooltip">
            Drag to connect or click to add
          </span>
        </button>
      </div>

      <div
        v-if="marquee && marquee.active"
        class="builder__marquee"
        :style="marqueeStyle"
      />

      <!-- NodeActionMenu — anchored to the right of the selected node
           (per the sequence-click spec). -->
      <div
        v-if="actionMenuNode"
        class="node-action-menu"
        :style="actionMenuStyle"
        role="menu"
        :aria-label="`Actions for ${actionMenuNode.title}`"
        @click.stop
        @pointerdown.stop
      >
        <button
          type="button"
          class="node-action-menu__item"
          role="menuitem"
          @click="onActionViewEdit"
        >
          <DexIcon name="edit-2" aria-hidden="true" />
          <span>View and edit</span>
        </button>
        <button
          type="button"
          class="node-action-menu__item"
          role="menuitem"
          @click="onActionSettings"
        >
          <DexIcon name="settings" aria-hidden="true" />
          <span>Settings</span>
        </button>
        <button
          v-if="actionMenuNode.type !== 'decision'"
          type="button"
          class="node-action-menu__item"
          role="menuitem"
          @click="onActionDuplicate"
        >
          <DexIcon name="copy" aria-hidden="true" />
          <span>Duplicate</span>
        </button>
        <button
          v-if="actionMenuNode.type !== 'decision'"
          type="button"
          class="node-action-menu__item"
          role="menuitem"
          @click="onActionRename"
        >
          <!-- `edit` is the standalone pencil glyph; `edit-2` (above
               for "View and edit") is the pencil-in-square variant.
               Using `edit-3` here used to silently fail because that
               name isn't in @thryvlabs/dex-vue's icon set. -->
          <DexIcon name="edit" aria-hidden="true" />
          <span>Rename</span>
        </button>
        <button
          type="button"
          class="node-action-menu__item node-action-menu__item--danger"
          role="menuitem"
          @click="onActionDelete"
        >
          <DexIcon name="trash-2" aria-hidden="true" />
          <span>Delete</span>
        </button>
        <div class="node-action-menu__divider" role="separator" />
        <label class="node-action-menu__ready">
          <span>Ready</span>
          <button
            type="button"
            class="node-action-menu__switch"
            role="switch"
            :aria-checked="nodeReady[actionMenuNode.id] !== false"
            @click="toggleNodeReady(actionMenuNode.id)"
          >
            <span
              class="node-action-menu__switch-thumb"
              :class="{
                'node-action-menu__switch-thumb--on':
                  nodeReady[actionMenuNode.id] !== false,
              }"
            />
          </button>
        </label>
      </div>

      <div
        v-if="selectedNodeIds.size >= 2"
        class="builder__selection-toolbar"
        @click.stop
      >
        <span class="builder__selection-count">
          {{ selectedNodeIds.size }} selected
        </span>
        <DexButton variant="solid" size="sm" @click="onTidyUpClick">
          Tidy up
        </DexButton>
        <DexButton variant="ghost" size="sm" @click="clearSelection">
          Clear
        </DexButton>
      </div>
      </div>
      <!-- /builder__surface (pan/zoom transformed inner div) -->

      <!-- Empty state — sibling of .builder__surface (not inside it)
           so its `position: absolute; top: 50%; left: 50%` centers it in
           the visible .builder__canvas-wrap regardless of pan/zoom. -->
      <div v-if="nodes.length === 0" class="builder__empty">
        <h2 class="builder__empty-title">Let's build your automation</h2>
        <p class="builder__empty-sub">
          To get started drag over a "When" or "Then" from the left panel<br />
          or select one below.
        </p>
        <button
          type="button"
          class="builder__starting-point"
          @click.stop="openStartingPointPicker"
        >
          <span class="builder__starting-plus" aria-hidden="true">+</span>
          <span class="builder__starting-text">
            <span class="builder__starting-title">Starting point</span>
            <span class="builder__starting-sub">A contact is added when…</span>
          </span>
        </button>
      </div>

      <!-- Bottom-left floating toolbar (inside canvas so it never
           overlaps the left sidebar) -->
      <div class="builder__floating-toolbar" aria-label="Canvas tools">
        <button
          type="button"
          class="builder__floating-btn"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
        >
          <DexIcon name="key-command" />
        </button>
        <button
          type="button"
          class="builder__floating-btn"
          aria-label="Notes"
          title="Notes"
        >
          <DexIcon name="edit-2" />
        </button>
        <button
          type="button"
          class="builder__floating-btn"
          aria-label="Find on canvas"
          title="Find on canvas"
        >
          <DexIcon name="search" />
        </button>
        <button
          type="button"
          class="builder__floating-btn"
          aria-label="Recenter canvas"
          title="Recenter canvas"
        >
          <DexIcon name="target" />
        </button>
      </div>
      <!-- Bottom-center zoom controls -->
      <div class="builder__zoom" aria-label="Canvas zoom">
        <button
          type="button"
          class="builder__zoom-btn"
          aria-label="Zoom out"
          @click="zoomOut"
        >
          −
        </button>
        <span class="builder__zoom-value">{{ zoomLevel }}%</span>
        <button
          type="button"
          class="builder__zoom-btn"
          aria-label="Zoom in"
          @click="zoomIn"
        >
          +
        </button>
      </div>
      <div class="builder__version">1.70.0.945385</div>

      <!-- Bottom-right help pill -->
      <button
        type="button"
        class="builder__help-pill"
        aria-label="Help and support"
      >
        Help &amp; support
        <DexIcon name="external-link" aria-hidden="true" />
      </button>
    </div>
    </div>

    <InlineAddPicker
      v-if="picker"
      :type="picker.type"
      :anchor="picker.anchor"
      :anchor-btn="picker.anchorBtn"
      :items="picker.type === 'when' ? whenItems : thenItems"
      :when-items="whenItems"
      :then-items="picker.originId === STARTING_POINT_SENTINEL ? [] : thenItems"
      :hide-decision-diamond="picker.originId === STARTING_POINT_SENTINEL"
      :center-on-anchor="picker.originId === STARTING_POINT_SENTINEL"
      @pick="onPickIcon"
      @pick-when="onPickWhen"
      @pick-then="onPickThen"
      @pick-decision-diamond="onPickDD"
      @close="picker = null"
    />

    <DecisionDiamondEditor
      v-if="editorDiamondId"
      :config="currentConfig"
      :relevant-entities="currentRelevantEntities"
      :trigger-slug="currentTriggerSlug"
      @update:config="onConfigUpdate"
      @save="onEditorSave"
      @close="editorDiamondId = null"
    />

    <TriggerConfigModal
      v-if="triggerConfigOpenId"
      :slug="triggerConfigSlug"
      :initial-config="triggerConfigInitial"
      @update:config="onTriggerConfigUpdate"
      @close="triggerConfigOpenId = null"
    />

    <Teleport to="body">
      <div
        v-if="tidyDialog"
        class="tidy-overlay"
        @click.self="tidyDialog = null"
      >
        <div class="tidy-modal" role="dialog" aria-modal="true">
          <header class="tidy-modal__header">
            <h2 class="tidy-modal__title">
              {{
                tidyDialog.kind === 'warning'
                  ? 'Linked steps detected'
                  : 'Tidy up selection'
              }}
            </h2>
            <button
              type="button"
              class="tidy-modal__close"
              aria-label="Close"
              @click="tidyDialog = null"
            >
              ×
            </button>
          </header>

          <div class="tidy-modal__body">
            <template v-if="tidyDialog.kind === 'warning'">
              <p class="tidy-modal__text">
                Your selection includes one branch of a decision diamond but
                not its linked pair. Tidy up will auto-include the linked
                step{{ tidyDialog.missing.length === 1 ? '' : 's' }} so the
                layout stays organized.
              </p>
              <ul class="tidy-modal__list">
                <li
                  v-for="m in tidyDialog.missing"
                  :key="m.id"
                  class="tidy-modal__list-item"
                >
                  <span class="tidy-modal__chip">linked</span>
                  {{ m.title }}
                </li>
              </ul>
            </template>

            <template v-else>
              <p class="tidy-modal__text">
                Rearrange the {{ tidyDialog.affected.length }} selected
                step{{ tidyDialog.affected.length === 1 ? '' : 's' }} into a
                clean grid? Their connections to other steps stay the same.
              </p>
              <div class="tidy-modal__summary">
                <div class="tidy-modal__summary-row">
                  <span class="tidy-modal__summary-label">Columns</span>
                  <span class="tidy-modal__summary-value">
                    {{ tidyDialog.preview.columns }}
                  </span>
                </div>
                <div class="tidy-modal__summary-row">
                  <span class="tidy-modal__summary-label">Rows</span>
                  <span class="tidy-modal__summary-value">
                    {{ tidyDialog.preview.rows }}
                  </span>
                </div>
                <div class="tidy-modal__summary-row">
                  <span class="tidy-modal__summary-label">Linked pairs</span>
                  <span class="tidy-modal__summary-value">
                    {{ tidyDialog.preview.linkedPairs }}
                  </span>
                </div>
              </div>
            </template>
          </div>

          <footer class="tidy-modal__footer">
            <DexButton variant="ghost" @click="tidyDialog = null">
              Cancel
            </DexButton>
            <DexButton variant="solid" @click="confirmTidy">
              {{
                tidyDialog.kind === 'warning' ? 'Include and tidy up' : 'Tidy up'
              }}
            </DexButton>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick as nextTickFn, reactive, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  DexIconButton,
  DexText,
  DexButton,
  DexIcon,
  DexDropdownMenu,
  DexDropdownMenuItem,
} from '@thryvlabs/dex-vue';
import automationIcons from '../../decisionDiamond/automationIcons.json';
import type { BuilderEdge, BuilderNode, DecisionDiamondConfig } from '../../decisionDiamond/types';
import { uid } from '../../decisionDiamond/types';
import { describeContactCondition } from '../../decisionDiamond/contactAttributes';
import { getTriggerField } from '../../decisionDiamond/triggerAttributes';
import {
  dissolveCollapsedDiamonds,
  insertDecisionDiamondAfter,
  relevantEntitiesFor,
  syncGroupsToEdges,
  upstreamTriggerSlug,
} from '../../decisionDiamond/engine';
import { automations } from '../automations';
import InlineAddPicker from './InlineAddPicker.vue';
import DecisionDiamondEditor from './DecisionDiamondEditor.vue';
import TriggerConfigModal from './TriggerConfigModal.vue';

const router = useRouter();
const route = useRoute();

const campaignId = computed(() => String(route.params.id ?? ''));
const campaignName = computed(() => {
  if (campaignId.value === 'new') return 'Untitled automation';
  return (
    automations.find((a) => a.id === campaignId.value)?.name ??
    'Decision diamond demo'
  );
});

const campaignSubtitle = computed(() => {
  if (campaignId.value === 'new') return 'Uncategorized';
  return 'Jialing';
});

const campaignStatusLabel = computed(() => {
  if (campaignId.value === 'new') return 'Draft';
  return 'Published · Unpublished edits';
});

type IconItem = { title: string; slug: string; svg: string };
const whenItems = (automationIcons as { when: IconItem[] }).when;
const thenItems = (automationIcons as { then: IconItem[] }).then;

/** Look up the inline SVG for a node based on its slug. */
function nodeIconSvg(node: BuilderNode): string | undefined {
  if (!node.name) return undefined;
  const hit =
    whenItems.find((i) => i.slug === node.name) ||
    thenItems.find((i) => i.slug === node.name);
  return hit?.svg;
}

// ===================================================================
// New header / sidebar / empty-state state
// ===================================================================

const newFeaturesOn = ref(true);

// ===================================================================
// Click-to-rename node labels (per HANDOFF §5)
// ===================================================================

const renamingNodeId = ref<string | null>(null);
const renameDraft = ref('');

// ===================================================================
// Edge selection (per funnel-connector spec)
// ===================================================================

const selectedEdgeId = ref<string | null>(null);

const selectedEdge = computed(() =>
  selectedEdgeId.value
    ? edges.value.find((e) => e.id === selectedEdgeId.value) ?? null
    : null,
);

const edgeDeletePillStyle = computed(() => {
  const e = selectedEdge.value;
  if (!e) return { display: 'none' };
  const m = edgeMidpoint(e);
  // Inverse-scale so the pill renders at native size regardless of
  // canvas zoom — matches the readable-menu treatment.
  return {
    left: `${m.x}px`,
    top: `${m.y}px`,
    transform: `translate(-50%, -50%) scale(${1 / zoom.value})`,
  };
});

function onEdgeClick(edgeId: string) {
  // Locked edges are passive — clicks do nothing.
  if (isLockedEdge(edgeId)) return;
  selectedEdgeId.value = edgeId;
  // Mutually-exclusive selection: clear node selection + menu.
  selectedNodeIds.value = new Set();
  closeActionMenu();
}

function deleteSelectedEdge() {
  if (!selectedEdgeId.value) return;
  edges.value = edges.value.filter((e) => e.id !== selectedEdgeId.value);
  selectedEdgeId.value = null;
}

// Keyboard: Delete / Backspace removes the selected edge.
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (!selectedEdgeId.value) return;
    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      (document.activeElement as HTMLElement | null)?.isContentEditable
    )
      return;
    e.preventDefault();
    deleteSelectedEdge();
  });
}

// ===================================================================
// NodeActionMenu (single-click + double-click open the same menu)
// ===================================================================

const actionMenuNodeId = ref<string | null>(null);
const nodeReady = reactive<Record<string, boolean>>({});

const actionMenuNode = computed<BuilderNode | null>(() => {
  const id = actionMenuNodeId.value;
  if (!id) return null;
  return nodes.value.find((n) => n.id === id) ?? null;
});

const actionMenuStyle = computed(() => {
  const n = actionMenuNode.value;
  if (!n) return { display: 'none' };
  // Inverse-scale so the menu renders at native size regardless of
  // canvas zoom. Position the anchor (top-left) just past the tile's
  // right edge in canvas-space; the inverse scale lifts the visual
  // size back to 1:1 without affecting the anchor.
  return {
    left: `${n.x + NODE_W + 12}px`,
    top: `${n.y}px`,
    transform: `scale(${1 / zoom.value})`,
    transformOrigin: 'top left',
  };
});

function openActionMenu(node: BuilderNode) {
  actionMenuNodeId.value = node.id;
  selectedNodeIds.value = new Set([node.id]);
}

function closeActionMenu() {
  actionMenuNodeId.value = null;
}

/** Outside-click handler — close the action menu when the user clicks
 *  anywhere outside the menu itself (including other nodes, the
 *  sidebar, header, etc.). Capture phase so it runs before any node
 *  handlers reopen the menu for the newly-clicked node. */
function onDocPointerDownForMenu(e: PointerEvent) {
  if (!actionMenuNodeId.value) return;
  const target = e.target as Node | null;
  if (!target) return;
  // Click landed inside the menu — keep it open.
  if (
    target instanceof Element &&
    target.closest('.node-action-menu')
  ) {
    return;
  }
  closeActionMenu();
}

if (typeof window !== 'undefined') {
  document.addEventListener('pointerdown', onDocPointerDownForMenu, true);
}

function toggleNodeReady(id: string) {
  nodeReady[id] = nodeReady[id] === false;
}

function onActionViewEdit() {
  const n = actionMenuNode.value;
  if (!n) return;
  closeActionMenu();
  if (n.type === 'decision') {
    openDecisionEditor(n.id);
  } else if (n.name && TRIGGER_CONFIG_SLUGS.has(n.name)) {
    triggerConfigOpenId.value = n.id;
  }
}

function onActionSettings() {
  onActionViewEdit();
}

function onActionDuplicate() {
  const n = actionMenuNode.value;
  if (!n) return;
  const clone: BuilderNode = {
    ...n,
    id: uid('n'),
    x: n.x + 120,
    y: n.y + 40,
  };
  nodes.value = [...nodes.value, clone];
  closeActionMenu();
}

function onActionRename() {
  const n = actionMenuNode.value;
  if (!n) return;
  closeActionMenu();
  startRename(n);
}

function onActionDelete() {
  const n = actionMenuNode.value;
  if (!n) return;
  // Locked pairs delete together
  const pair = lockedPairForNode(n.id);
  const removeIds = new Set<string>();
  if (pair) {
    removeIds.add(pair.hostId);
    removeIds.add(pair.partnerId);
    lockedPairs.value = lockedPairs.value.filter(
      (p) => p.hostId !== pair.hostId,
    );
  } else {
    removeIds.add(n.id);
  }
  nodes.value = nodes.value.filter((node) => !removeIds.has(node.id));
  edges.value = edges.value.filter(
    (e) => !removeIds.has(e.from) && !removeIds.has(e.to),
  );
  closeActionMenu();
}

// ===================================================================
// Drag node tile on canvas (per HANDOFF §5)
// ===================================================================

type NodeDragState = {
  ids: string[];
  starts: Map<string, { x: number; y: number }>;
  startClientX: number;
  startClientY: number;
  started: boolean;
};
const nodeDrag = ref<NodeDragState | null>(null);
const NODE_DRAG_THRESHOLD = 4;
let nodeDragSuppressClick = false;

function onNodePointerDown(node: BuilderNode, e: PointerEvent) {
  // Don't start a drag if Shift (selection toggle), pan mode, on a
  // pickup-style child (+ button, label rename, kebab), or right-click.
  if (e.button !== 0) return;
  if (e.shiftKey || panMode.value) return;
  const target = e.target as HTMLElement;
  if (
    target.closest('.node__add') ||
    target.closest('.node__caption--rename') ||
    target.closest('.node__caption--button')
  )
    return;

  // If the node is part of a locked pair, drag the pair together.
  const pair = lockedPairForNode(node.id);
  const ids = pair ? [pair.hostId, pair.partnerId] : [node.id];
  const starts = new Map<string, { x: number; y: number }>();
  for (const n of nodes.value) {
    if (ids.includes(n.id)) starts.set(n.id, { x: n.x, y: n.y });
  }

  nodeDrag.value = {
    ids,
    starts,
    startClientX: e.clientX,
    startClientY: e.clientY,
    started: false,
  };
  window.addEventListener('pointermove', onNodeDragMove);
  window.addEventListener('pointerup', onNodeDragUp);
}

function onNodeDragMove(e: PointerEvent) {
  const g = nodeDrag.value;
  if (!g) return;
  const dxClient = e.clientX - g.startClientX;
  const dyClient = e.clientY - g.startClientY;
  if (
    !g.started &&
    Math.hypot(dxClient, dyClient) < NODE_DRAG_THRESHOLD
  ) {
    return;
  }
  if (!g.started) {
    g.started = true;
  }
  const dx = dxClient / zoom.value;
  const dy = dyClient / zoom.value;
  nodes.value = nodes.value.map((n) => {
    if (!g.ids.includes(n.id)) return n;
    const s = g.starts.get(n.id);
    if (!s) return n;
    return { ...n, x: Math.round(s.x + dx), y: Math.round(s.y + dy) };
  });
}

function onNodeDragUp() {
  window.removeEventListener('pointermove', onNodeDragMove);
  window.removeEventListener('pointerup', onNodeDragUp);
  if (nodeDrag.value?.started) {
    // Suppress the click that follows pointerup so we don't open the
    // node action menu after a drag.
    nodeDragSuppressClick = true;
    window.setTimeout(() => {
      nodeDragSuppressClick = false;
    }, 0);
  }
  nodeDrag.value = null;
}

// ===================================================================
// Trigger config modals (per HANDOFF §13)
// ===================================================================

const TRIGGER_CONFIG_SLUGS = new Set([
  'product-is-purchased',
  'appointments',
  'pipeline-stage-is-moved',
  'quote-status',
]);

const triggerConfigOpenId = ref<string | null>(null);
const triggerConfigs = reactive<Record<string, Record<string, string>>>({});

const triggerConfigSlug = computed(() => {
  const id = triggerConfigOpenId.value;
  if (!id) return '';
  return nodes.value.find((n) => n.id === id)?.name ?? '';
});
const triggerConfigInitial = computed(() => {
  const id = triggerConfigOpenId.value;
  return id ? triggerConfigs[id] ?? {} : {};
});

function maybeOpenTriggerConfig(node: BuilderNode) {
  if (node.name && TRIGGER_CONFIG_SLUGS.has(node.name)) {
    triggerConfigOpenId.value = node.id;
  }
}

function onTriggerConfigUpdate(next: Record<string, string>) {
  const id = triggerConfigOpenId.value;
  if (!id) return;
  triggerConfigs[id] = next;
}

// ===================================================================
// Drag-to-connect from the hover "+" (per HANDOFF §6)
// ===================================================================

const connecting = ref<{
  originId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  targetId: string | null;
} | null>(null);
const CONNECT_THRESHOLD = 8;

let connectGesture: {
  originId: string;
  startClientX: number;
  startClientY: number;
  started: boolean;
} | null = null;

function beginConnect(origin: BuilderNode, e: PointerEvent) {
  e.preventDefault();
  connectGesture = {
    originId: origin.id,
    startClientX: e.clientX,
    startClientY: e.clientY,
    started: false,
  };
  window.addEventListener('pointermove', onConnectMove);
  window.addEventListener('pointerup', onConnectUp);
}

function clientToCanvas(clientX: number, clientY: number) {
  const wrap = canvasWrapEl.value;
  if (!wrap) return { x: clientX, y: clientY };
  const r = wrap.getBoundingClientRect();
  return {
    x: (clientX - r.left - pan.value.x) / zoom.value,
    y: (clientY - r.top - pan.value.y) / zoom.value,
  };
}

function onConnectMove(e: PointerEvent) {
  if (!connectGesture) return;
  const dx = e.clientX - connectGesture.startClientX;
  const dy = e.clientY - connectGesture.startClientY;
  if (
    !connectGesture.started &&
    Math.hypot(dx, dy) < CONNECT_THRESHOLD
  ) {
    return; // ignore until past the click-vs-drag threshold
  }
  if (!connectGesture.started) {
    // Promote to a real connect gesture
    connectGesture.started = true;
    const origin = nodes.value.find(
      (n) => n.id === connectGesture!.originId,
    );
    if (!origin) return;
    const start = { x: origin.x + nodeWidth(origin) / 2, y: origin.y + nodeHeight(origin) / 2 };
    connecting.value = {
      originId: origin.id,
      startX: start.x,
      startY: start.y,
      currentX: start.x,
      currentY: start.y,
      targetId: null,
    };
  }
  const cur = clientToCanvas(e.clientX, e.clientY);
  // Hit-test for a target node under the cursor
  const target = nodes.value.find((n) => {
    if (n.id === connectGesture!.originId) return false;
    const w = nodeWidth(n);
    const h = nodeHeight(n);
    return (
      cur.x >= n.x &&
      cur.x <= n.x + w &&
      cur.y >= n.y &&
      cur.y <= n.y + h
    );
  });
  connecting.value = {
    ...(connecting.value as NonNullable<typeof connecting.value>),
    currentX: target ? target.x + nodeWidth(target) / 2 : cur.x,
    currentY: target ? target.y + nodeHeight(target) / 2 : cur.y,
    targetId: target?.id ?? null,
  };
}

function onConnectUp() {
  window.removeEventListener('pointermove', onConnectMove);
  window.removeEventListener('pointerup', onConnectUp);
  const c = connecting.value;
  if (
    c &&
    c.targetId &&
    c.targetId !== c.originId &&
    !edges.value.some((e) => e.from === c.originId && e.to === c.targetId)
  ) {
    edges.value = [
      ...edges.value,
      { id: uid('e'), from: c.originId, to: c.targetId },
    ];
  }
  connecting.value = null;
  connectGesture = null;
}

const connectingPath = computed(() => {
  const c = connecting.value;
  if (!c) return '';
  const dx = Math.abs(c.currentX - c.startX) / 2;
  return `M ${c.startX} ${c.startY} C ${c.startX + dx} ${c.startY}, ${c.currentX - dx} ${c.currentY}, ${c.currentX} ${c.currentY}`;
});

function startRename(node: BuilderNode) {
  if (node.type === 'decision') return; // decisions auto-title from rules
  renamingNodeId.value = node.id;
  renameDraft.value = node.title;
  void nextTickFn(() => {
    document
      .querySelector<HTMLTextAreaElement>('.node__caption--rename')
      ?.focus();
    document
      .querySelector<HTMLTextAreaElement>('.node__caption--rename')
      ?.select();
  });
}

function onRenameInput(e: Event) {
  renameDraft.value = (e.target as HTMLTextAreaElement).value;
}

function commitRename(nodeId: string) {
  if (renamingNodeId.value !== nodeId) return;
  const next = renameDraft.value.trim();
  if (next) {
    nodes.value = nodes.value.map((n) =>
      n.id === nodeId && n.title !== next ? { ...n, title: next } : n,
    );
  }
  renamingNodeId.value = null;
}

function cancelRename() {
  renamingNodeId.value = null;
}

function onNodeDoubleClick(node: BuilderNode) {
  // Per sequence-click spec: double-click produces the same end state as
  // a single click. The user must explicitly choose "View and edit"
  // from the action menu to enter an editor.
  openActionMenu(node);
}

// ===================================================================
// Pan + zoom (per HANDOFF-CANVAS-V1 §§1, 4)
// ===================================================================

const zoom = ref(0.5);              // [0.25, 2]
const pan = ref({ x: 0, y: 0 });    // canvas-wrapper offset
const panMode = ref(false);         // Tab toggles
const isPanning = ref(false);

const zoomLevel = computed({
  get: () => Math.round(zoom.value * 100),
  set: (pct: number) => {
    zoom.value = Math.max(0.25, Math.min(2, pct / 100));
  },
});

function setZoom(pct: number) {
  zoomLevel.value = pct;
}
function zoomOut() {
  setZoom(Math.max(25, zoomLevel.value - 10));
}
function zoomIn() {
  setZoom(Math.min(200, zoomLevel.value + 10));
}

/** Tab-to-pan: hold Tab to enter pan mode; release to exit. */
function onPanKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    // Only respond when no input/select/textarea has focus
    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    panMode.value = true;
  }
}
function onPanKeyup(e: KeyboardEvent) {
  if (e.key === 'Tab') panMode.value = false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onPanKeydown);
  window.addEventListener('keyup', onPanKeyup);
  // Cleanup happens via the component being unmounted with the page; for
  // a single-instance builder this is fine.
}

let panGesture: {
  startPanX: number;
  startPanY: number;
  startClientX: number;
  startClientY: number;
} | null = null;

function onCanvasPointerDown(e: PointerEvent) {
  // Allow pan whenever the user presses on EMPTY canvas (background)
  // — no Tab key required. Tab+drag still works as an alternate path
  // (and forces pan even if a small piece of node chrome is under
  // the cursor). Shift+drag is reserved for marquee select.
  if (e.shiftKey) return;
  const target = e.target as HTMLElement;
  if (
    target.closest('.node') ||
    target.closest('.dd-picker') ||
    target.closest('.node-action-menu') ||
    target.closest('.edge-group') ||
    target.closest('.edge-delete-pill') ||
    target.closest('.add-inline')
  ) {
    // Tab+drag override — even if pointer is over node chrome, treat
    // as a pan when explicit pan mode is engaged.
    if (!panMode.value) return;
  }
  e.preventDefault();
  isPanning.value = true;
  panGesture = {
    startPanX: pan.value.x,
    startPanY: pan.value.y,
    startClientX: e.clientX,
    startClientY: e.clientY,
  };
  window.addEventListener('pointermove', onPanPointerMove);
  window.addEventListener('pointerup', onPanPointerUp);
}
function onPanPointerMove(e: PointerEvent) {
  if (!panGesture) return;
  pan.value = {
    x: panGesture.startPanX + (e.clientX - panGesture.startClientX),
    y: panGesture.startPanY + (e.clientY - panGesture.startClientY),
  };
}
function onPanPointerUp() {
  isPanning.value = false;
  panGesture = null;
  window.removeEventListener('pointermove', onPanPointerMove);
  window.removeEventListener('pointerup', onPanPointerUp);
  // Suppress the synthetic click that follows pointerup so a pan
  // gesture doesn't accidentally clear selection via onCanvasClick.
  panSuppressClick = true;
  window.setTimeout(() => {
    panSuppressClick = false;
  }, 50);
}

let panSuppressClick = false;
const savedAt = computed(() => {
  // Static for prototype — would be a live "last saved" timestamp in
  // production.
  const d = new Date();
  let h = d.getHours();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}${ampm}`;
});

const sidebarCollapsed = ref(false);
const sidebarTab = ref<'when' | 'then'>('when');
const sidebarQuery = ref('');

/** Sidebar trigger slugs that get the green "New" chip. These are the
 *  four CRM triggers the decision-diamond editor is entity-aware for
 *  (per DECISION-DIAMOND-LOGIC.md §4). The previously-labeled
 *  `landing-page-is-submitted` no longer wears the chip. */
const NEW_TRIGGER_SLUGS = new Set([
  'product-is-purchased',
  'quote-status',
  'pipeline-stage-is-moved',
  'appointments',
]);

const filteredSidebarItems = computed(() => {
  const items = sidebarTab.value === 'when' ? whenItems : thenItems;
  const q = sidebarQuery.value.trim().toLowerCase();
  if (!q) return items;
  return items.filter((i) => i.title.toLowerCase().includes(q));
});

// ===================================================================
// Sidebar drag-to-canvas (per HANDOFF §8.4)
// ===================================================================

const DND_MIME = 'application/x-automation-item';
const sidebarDragging = ref(false);

function onSidebarDragStart(item: IconItem, e: DragEvent) {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData(
    DND_MIME,
    JSON.stringify({
      slug: item.slug,
      title: item.title,
      kind: sidebarTab.value,
    }),
  );
  sidebarDragging.value = true;
}
function onSidebarDragEnd() {
  sidebarDragging.value = false;
}
function onCanvasDragOver(e: DragEvent) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
}
function onCanvasDrop(e: DragEvent) {
  sidebarDragging.value = false;
  const raw = e.dataTransfer?.getData(DND_MIME);
  if (!raw) return;
  let payload: { slug: string; title: string; kind: 'when' | 'then' };
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  const { x, y } = clientToCanvas(e.clientX, e.clientY);
  // Snap so the cursor lands on the tile's center
  const dropX = Math.round(x - NODE_W / 2);
  const dropY = Math.round(y - NODE_H / 2);

  // Locked-pair shortcut for Get email opt-in
  if (payload.kind === 'then' && payload.slug === 'get-email-opt-in') {
    const { host, partner, lockEdge } = buildEmailOptInLockedPairCells(
      { slug: payload.slug, title: payload.title },
      dropX,
      dropY,
    );
    nodes.value = [...nodes.value, host, partner];
    edges.value = [...edges.value, lockEdge];
    lockedPairs.value = [
      ...lockedPairs.value,
      { hostId: host.id, partnerId: partner.id, edgeId: lockEdge.id },
    ];
    return;
  }

  const newNode: BuilderNode = {
    id: uid('n'),
    type: payload.kind === 'when' ? 'trigger' : 'action',
    name: payload.slug,
    title: payload.title,
    x: dropX,
    y: dropY,
  };
  nodes.value = [...nodes.value, newNode];
  maybeOpenTriggerConfig(newNode);
}

function onSidebarItemClick(item: IconItem) {
  // Plant the item at a sensible location on a fresh canvas, or after
  // the last node if there's existing content.
  const id = uid('n');
  if (nodes.value.length === 0) {
    nodes.value.push({
      id,
      type: sidebarTab.value === 'when' ? 'trigger' : 'action',
      title: item.title,
      name: item.slug,
      x: 80,
      y: 240,
    });
  } else {
    const last = nodes.value[nodes.value.length - 1];
    nodes.value.push({
      id,
      type: sidebarTab.value === 'when' ? 'trigger' : 'action',
      title: item.title,
      name: item.slug,
      x: last.x + NODE_W + PH_GAP,
      y: last.y,
    });
    edges.value.push({ id: uid('e'), from: last.id, to: id });
  }
}

/** Sentinel originId used by the empty-state Starting-point picker so
 *  the pick handler knows to seed the FIRST node from scratch instead
 *  of routing through `insertAfter` (which requires an existing
 *  origin). */
const STARTING_POINT_SENTINEL = '__starting-point__';

/** Open the InlineAddPicker anchored below the empty-state Starting
 *  point button. The picker is restricted to `when` items (triggers)
 *  since a starting point must be a trigger; picking one becomes the
 *  first node on the canvas. */
function openStartingPointPicker(ev: MouseEvent) {
  const btnRect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
  const sx = window.scrollX || 0;
  const sy = window.scrollY || 0;
  picker.value = {
    originId: STARTING_POINT_SENTINEL,
    type: 'when',
    anchor: { x: btnRect.left + sx, y: btnRect.bottom + 4 + sy },
    anchorBtn: {
      left: btnRect.left + sx,
      right: btnRect.right + sx,
      bottom: btnRect.bottom + 4 + sy,
    },
  };
}

/** Seed the first trigger node when the user picks from the
 *  starting-point dropdown. Position matches the legacy
 *  seedStartingPoint default so the rest of the canvas math stays put. */
function seedFirstNode(payload: { name: string; title: string }) {
  const newNode: BuilderNode = {
    id: uid('n'),
    type: 'trigger',
    title: payload.title,
    name: payload.name,
    x: 80,
    y: 240,
  };
  nodes.value.push(newNode);
  // Mirror the drag-drop flow: pop the trigger config modal for triggers
  // that have one (Pipeline / Product / Appointments) so the user can
  // configure right away without hunting for "View and edit".
  maybeOpenTriggerConfig(newNode);
}

// Canvas Sequence Tile tokens (per HANDOFF-CANVAS-SEQUENCE-V1 §10)
const NODE_W = 90;
const NODE_H = 90;
const DIAMOND_W = 90;
const DIAMOND_H = 90;
const ICON_SIZE = 48;
const TILE_RADIUS = 22;
const STATUS_SIZE = 30;
const STATUS_OVERHANG = 8;
const LABEL_WIDTH = 373;
const LABEL_TOP_OFFSET = 122;
const LABEL_FONT = 26;
const HOVER_ADD_SIZE = 64;
const SELECTION_RING = 6;
const SELECT_ACCENT = '#8358F1';
const PH_GAP = 120;
const LOCKED_PAIR_GAP = 240;

// Seed: a deal-shaped chain that exercises the auto-insert + DD path.
const nodes = ref<BuilderNode[]>([
  {
    id: 'n1',
    type: 'trigger',
    title: 'Pipeline stage is moved',
    subtitle: 'Deal stage changes',
    name: 'pipeline-stage-is-moved',
    x: 80,
    y: 240,
  },
  {
    id: 'n2',
    type: 'decision',
    title: 'Decision',
    x: 80 + NODE_W + PH_GAP,
    y: 240,
  },
  {
    id: 'n3',
    type: 'action',
    title: 'Send email',
    subtitle: 'High value follow-up',
    name: 'send-email',
    x: 80 + (NODE_W + PH_GAP) * 2 + 50,
    y: 100,
  },
  {
    id: 'n4',
    type: 'action',
    title: 'Send text message',
    subtitle: 'Standard cadence',
    name: 'send-text-message',
    x: 80 + (NODE_W + PH_GAP) * 2 + 50,
    y: 380,
  },
]);

const edges = ref<BuilderEdge[]>([
  { id: 'e1', from: 'n1', to: 'n2' },
  { id: 'e2', from: 'n2', to: 'n3' },
  { id: 'e3', from: 'n2', to: 'n4' },
]);

// When the route id is "new", start the builder in its empty state so
// the user sees the full Let's-build-your-automation experience.
if (route.params.id === 'new') {
  nodes.value = [];
  edges.value = [];
}

const selectedNodeIds = ref<Set<string>>(new Set());
const editorDiamondId = ref<string | null>(null);
const picker = ref<{
  originId: string;
  type: 'when' | 'then';
  anchor: { x: number; y: number };
  /** Button rect (relative to canvas wrap) so the picker can flip
   *  between left-aligned and right-aligned on overflow. */
  anchorBtn?: { left: number; right: number; bottom: number };
} | null>(null);

const canvasWrapEl = ref<HTMLDivElement | null>(null);

type MarqueeState = {
  active: boolean;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  initialSelection: Set<string>;
};
const marquee = ref<MarqueeState | null>(null);

type TidyDialog =
  | {
      kind: 'warning';
      affected: string[];
      missing: { id: string; title: string }[];
    }
  | {
      kind: 'confirm';
      affected: string[];
      preview: { columns: number; rows: number; linkedPairs: number };
    };
const tidyDialog = ref<TidyDialog | null>(null);

const marqueeStyle = computed(() => {
  const m = marquee.value;
  if (!m) return {};
  const left = Math.min(m.startX, m.curX);
  const top = Math.min(m.startY, m.curY);
  const width = Math.abs(m.curX - m.startX);
  const height = Math.abs(m.curY - m.startY);
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  };
});

const decisionConfigs = reactive<Record<string, DecisionDiamondConfig>>({});

function ensureConfig(diamondId: string) {
  const existing = decisionConfigs[diamondId];
  if (existing) {
    // PRESERVE saved groups verbatim. The old behavior re-ran
    // `syncGroupsToEdges` on every reopen, which rebuilds groups from
    // the diamond's outgoing edges — that wiped any rule the user had
    // saved when the diamond had no downstream wired yet (e.g. after
    // the split-save flow where each new diamond starts with 0
    // outgoing edges but already carries its inherited rule).
    //
    // Only run the edge-sync if the saved config has zero groups
    // (genuinely empty — let the edges seed initial placeholders).
    if (existing.groups.length > 0) return;
    decisionConfigs[diamondId] = syncGroupsToEdges(
      existing,
      diamondId,
      nodes.value,
      edges.value,
    );
    return;
  }
  const initial: DecisionDiamondConfig = syncGroupsToEdges(
    {
      groups: [],
      defaultRouting: '__drop__',
    },
    diamondId,
    nodes.value,
    edges.value,
  );
  decisionConfigs[diamondId] = initial;
}

const currentConfig = computed<DecisionDiamondConfig>(() => {
  const id = editorDiamondId.value;
  if (!id) {
    return { groups: [], defaultRouting: '__drop__' };
  }
  return (
    decisionConfigs[id] ?? { groups: [], defaultRouting: '__drop__' }
  );
});

/** The slug of the closest upstream trigger to the currently-open
 *  diamond. Drives entity-aware scoping of the diamond's field
 *  dropdown — only attributes exposed by THIS trigger are surfaced.
 *  Null when the diamond has no trigger upstream (e.g. while still
 *  being placed) — editor falls back to the default Deal field set. */
const currentTriggerSlug = computed(() => {
  const id = editorDiamondId.value;
  if (!id) return null;
  return upstreamTriggerSlug(id, nodes.value, edges.value);
});

const currentRelevantEntities = computed(() => {
  const id = editorDiamondId.value;
  if (!id) return new Set<never>();
  const cfg = decisionConfigs[id];
  return relevantEntitiesFor(id, nodes.value, edges.value, cfg?.boundEntity);
});

function onConfigUpdate(next: DecisionDiamondConfig) {
  if (!editorDiamondId.value) return;
  decisionConfigs[editorDiamondId.value] = next;
}

/** Save handler — REPLACES the single decision diamond with N parallel
 *  decision diamonds, one per sequence configured. Each new diamond
 *  inherits one sequence's rules and is titled with a plain-English
 *  rule summary so the user can read the routing at a glance from
 *  the canvas without opening each diamond.
 *
 *  Topology change:
 *
 *    Before:  [upstream] → [Diamond w/ N sequences]   (no outgoing yet)
 *    After:   [upstream] ─┬→ [Diamond: "Deal Value exceeds $5,000"]
 *                        ├→ [Diamond: "Deal Stage equals Won"]
 *                        ├→ ⋯
 *                        └→ [Diamond: "Contact's Tags contains VIP"]
 *
 *  No downstream placeholder nodes — the diamonds themselves carry the
 *  rule label as their title. The user wires up their own downstream
 *  actions by dragging from the diamond's "+" later.
 *
 *  Edge case — single sequence: still produces one renamed diamond. */
function onEditorSave() {
  const diamondId = editorDiamondId.value;
  if (!diamondId) return;
  const original = nodes.value.find((n) => n.id === diamondId);
  const cfg = decisionConfigs[diamondId];
  if (!original || !cfg || cfg.groups.length === 0) {
    editorDiamondId.value = null;
    return;
  }

  // Identify all sibling diamonds (same groupKey as the saved one)
  // so they all get cleaned up before we recreate the split. Without
  // this, re-saving from any sibling would leave the OTHER siblings on
  // the canvas, inflating the diamond count above the sequence count.
  const siblingIds = new Set<string>([diamondId]);
  if (original.groupKey) {
    nodes.value.forEach((n) => {
      if (n.groupKey === original.groupKey) siblingIds.add(n.id);
    });
  }

  // Capture upstream sources that feed any sibling — union them so the
  // fresh diamonds inherit the same fan-in. (In practice every sibling
  // shares the same incoming sources, so this dedupes to the same set.)
  const incomingSources = Array.from(
    new Set(
      edges.value
        .filter((e) => siblingIds.has(e.to))
        .map((e) => e.from),
    ),
  );

  // Remove ALL siblings + every edge touching any of them.
  let nextNodes = nodes.value.filter((n) => !siblingIds.has(n.id));
  let nextEdges = edges.value.filter(
    (e) => !siblingIds.has(e.from) && !siblingIds.has(e.to),
  );

  // Drop their config entries.
  siblingIds.forEach((id) => {
    delete decisionConfigs[id];
  });

  // Layout: stack the new diamonds vertically where the original sat.
  const verticalSpacing = DIAMOND_H + 32;
  const stackHeight = (cfg.groups.length - 1) * verticalSpacing;
  const topY = original.y - stackHeight / 2;

  // Fresh groupKey shared across this generation of siblings, so the
  // next re-save can clean them up the same way.
  const newGroupKey = uid('grp');

  cfg.groups.forEach((group, i) => {
    const newDiamondId = uid('d');
    const newY = topY + i * verticalSpacing;

    // Rule summary for THIS diamond's title (canvas label = just the
    // rule this branch represents).
    const summary = summarizeGroupRules(group, i);

    nextNodes.push({
      id: newDiamondId,
      type: 'decision',
      title: summary,
      x: original.x,
      y: newY,
      groupKey: newGroupKey,
    });

    // Each split diamond carries ONLY its own sequence's rules — the
    // one whose summary becomes its title. This way opening Diamond A
    // shows "Sequence 1: Rule A" while Diamond B shows "Sequence 1:
    // Rule B" — the two siblings are visually distinct because the
    // configs are. (Earlier this used to clone the full config to every
    // sibling, which made all of them open identically; per the user's
    // follow-up, that was wrong — each diamond should reflect its own
    // rule attributes, not the union.)
    decisionConfigs[newDiamondId] = {
      groups: [
        {
          id: group.id,
          targetFlowId: '',
          targetName: group.targetName || `Sequence ${i + 1}`,
          blocks: group.blocks.map((b) => ({
            ...b,
            conditions: b.conditions.map((c) => ({
              ...c,
              values: [...c.values],
            })),
          })),
        },
      ],
      defaultRouting: '__drop__',
      boundEntity: cfg.boundEntity,
    };

    // Fan-in: upstream sources → this new diamond. No outgoing edge —
    // the user adds it via the "+" affordance after save.
    incomingSources.forEach((srcId) => {
      nextEdges.push({ id: uid('e'), from: srcId, to: newDiamondId });
    });
  });

  nodes.value = nextNodes;
  edges.value = nextEdges;
  editorDiamondId.value = null;
}

/** Plain-English label for a sequence's rule set, used as the canvas
 *  title for the diamond that inherits it after save. Joins AND-rows
 *  with " AND " and OR-blocks with " OR ". Falls back to a generic
 *  "Rule N" if no condition has its field set. */
function summarizeGroupRules(
  group: import('../../decisionDiamond/types').DDGroup,
  index: number,
): string {
  const blockSummaries: string[] = [];
  for (const block of group.blocks) {
    const condParts: string[] = [];
    for (const c of block.conditions) {
      const part = describeAnyCondition(c);
      if (part) condParts.push(part);
    }
    if (condParts.length > 0) blockSummaries.push(condParts.join(' AND '));
  }
  if (blockSummaries.length === 0) return `Rule ${index + 1}`;
  return blockSummaries.join(' OR ');
}

/** One-line describer that handles both deal- and contact-scoped
 *  conditions. Mirrors DecisionDiamondEditor's describeCondition but
 *  scoped to what the canvas needs for a diamond title. */
function describeAnyCondition(
  c: import('../../decisionDiamond/types').DDCondition,
): string {
  if (c.entity === 'contact') {
    if (!c.category && !c.field) return '';
    return describeContactCondition(c);
  }
  if (!c.field) return '';
  // Resolve label across all known field sets: deal defaults first
  // (so existing rule labels stay stable), then any of the trigger
  // schemas (Product / Quote / Pipeline / Appointment). Falls back to
  // the raw id if nothing matches.
  const label =
    DEAL_FIELD_LABEL[c.field] ??
    getTriggerField(c.field)?.label ??
    c.field;
  if (!c.operator) return label;
  const opLabel = DEAL_OPERATOR_LABEL[c.operator] ?? c.operator;
  const valStr =
    c.values.length === 0
      ? ''
      : c.operator === 'between'
        ? ` ${c.values[0] || '…'}–${c.values[1] || '…'}`
        : c.field === 'dealValue' && c.values[0]
          ? ` $${c.values[0]}`
          : ` ${c.values[0]}`;
  return `${label} ${opLabel}${valStr}`;
}

const DEAL_FIELD_LABEL: Record<string, string> = {
  dealValue: 'Deal Value',
  dealStage: 'Deal Stage',
  dealCompletionTime: 'Completion Time',
  dealExpirationTime: 'Expiration Time',
};
const DEAL_OPERATOR_LABEL: Record<string, string> = {
  equals: 'equals',
  exceeds: 'exceeds',
  lessThan: 'less than',
  between: 'between',
};

function nodeWidth(n: BuilderNode) {
  return n.type === 'decision' ? DIAMOND_W : NODE_W;
}
function nodeHeight(n: BuilderNode) {
  return n.type === 'decision' ? DIAMOND_H : NODE_H;
}

function nodeStyle(n: BuilderNode) {
  return {
    left: `${n.x}px`,
    top: `${n.y}px`,
    width: `${nodeWidth(n)}px`,
    height: `${nodeHeight(n)}px`,
  };
}

/** Bounds of the canvas surface in CSS-pixel units. Drives the SVG's
 *  width/height *and* its viewBox so the path coordinate system is a
 *  1:1 mapping to the same CSS pixels the nodes are positioned in.
 *  Without this the SVG stretches non-uniformly and arrowheads miss
 *  the node anchors. */
const surfaceBounds = computed(() => {
  const xs = nodes.value.map((n) => n.x);
  const ys = nodes.value.map((n) => n.y);
  const widths = nodes.value.map((n) => n.x + nodeWidth(n));
  const heights = nodes.value.map((n) => n.y + nodeHeight(n));
  const minX = Math.min(0, ...xs) - 100;
  const minY = Math.min(0, ...ys) - 100;
  const maxX = Math.max(1200, ...widths) + 240;
  const maxY = Math.max(700, ...heights) + 200;
  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  };
});

const viewBox = computed(() => {
  const b = surfaceBounds.value;
  return `${b.minX} ${b.minY} ${b.width} ${b.height}`;
});

/** Right-side connection point of a node.
 *  - Trigger/action: middle of the right edge of the 90×90 bounding box.
 *  - Decision: right VERTEX of the rotated 64×64 inscribed diamond
 *    (= bounding-box midpoint X-offset 77 ≈ 90 - 13). Both outgoing
 *    edges share this single emission point per the spec. */
function nodeAnchorRight(n: BuilderNode) {
  if (n.type === 'decision') {
    return { x: n.x + 77, y: n.y + nodeHeight(n) / 2 };
  }
  return { x: n.x + nodeWidth(n), y: n.y + nodeHeight(n) / 2 };
}
/** Left-side connection point — mirror of nodeAnchorRight. */
function nodeAnchorLeft(n: BuilderNode) {
  if (n.type === 'decision') {
    return { x: n.x + 13, y: n.y + nodeHeight(n) / 2 };
  }
  return { x: n.x, y: n.y + nodeHeight(n) / 2 };
}

function edgeEndpoints(edge: BuilderEdge) {
  const from = nodes.value.find((n) => n.id === edge.from);
  const to = nodes.value.find((n) => n.id === edge.to);
  if (!from || !to) return null;
  return {
    fromAnchor: nodeAnchorRight(from),
    toAnchor: nodeAnchorLeft(to),
  };
}

function edgeMidpoint(edge: BuilderEdge) {
  const ep = edgeEndpoints(edge);
  if (!ep) return { x: 0, y: 0 };
  return {
    x: (ep.fromAnchor.x + ep.toAnchor.x) / 2,
    y: (ep.fromAnchor.y + ep.toAnchor.y) / 2,
  };
}

/** Inset (px) between connector endpoints and the node tile edge.
 *  Zero ⇒ the arrowhead tip lands exactly on the node's left edge,
 *  and the line origin sits exactly on the source's right edge. */
const EDGE_NODE_GAP = 0;

function edgePath(edge: BuilderEdge) {
  const from = nodes.value.find((n) => n.id === edge.from);
  const to = nodes.value.find((n) => n.id === edge.to);
  if (!from || !to) return '';
  const fromAnchorRaw = nodeAnchorRight(from);
  const toAnchorRaw = nodeAnchorLeft(to);
  // Pull both ends inward so the line + arrowhead sit just outside
  // the tile edges, not touching them.
  const fromAnchor = {
    x: fromAnchorRaw.x + EDGE_NODE_GAP,
    y: fromAnchorRaw.y,
  };
  const toAnchor = {
    x: toAnchorRaw.x - EDGE_NODE_GAP,
    y: toAnchorRaw.y,
  };
  const dy = toAnchor.y - fromAnchor.y;
  if (Math.abs(dy) < 2) {
    return `M ${fromAnchor.x} ${fromAnchor.y} L ${toAnchor.x} ${toAnchor.y}`;
  }
  // Bezier handles offset by max(40, |dx| * 0.4) — gentle S-curve
  // into the target row.
  const handle = Math.max(
    40,
    Math.abs(toAnchor.x - fromAnchor.x) * 0.4,
  );
  const c1x = fromAnchor.x + handle;
  const c2x = toAnchor.x - handle;
  return `M ${fromAnchor.x} ${fromAnchor.y} C ${c1x} ${fromAnchor.y}, ${c2x} ${toAnchor.y}, ${toAnchor.x} ${toAnchor.y}`;
}

function onCanvasClick() {
  if (marquee.value?.active) return;
  if (panSuppressClick) return;
  selectedNodeIds.value = new Set();
  selectedEdgeId.value = null;
  picker.value = null;
  closeActionMenu();
}

function clearSelection() {
  selectedNodeIds.value = new Set();
}

function onNodeClick(n: BuilderNode, ev: MouseEvent) {
  // Don't fire selection/menu after a drag gesture (per HANDOFF §6).
  if (nodeDragSuppressClick) return;
  picker.value = null;
  if (ev.shiftKey) {
    // Toggle in/out of selection — Shift+Click flow.
    const next = new Set(selectedNodeIds.value);
    if (next.has(n.id)) {
      next.delete(n.id);
    } else {
      next.add(n.id);
    }
    selectedNodeIds.value = next;
    // Close any single-node action menu when multi-selecting.
    if (next.size !== 1) closeActionMenu();
    return;
  }
  // Single-click: select + open the action menu anchored to the right.
  openActionMenu(n);
}

function openDecisionEditor(diamondId: string) {
  ensureConfig(diamondId);
  editorDiamondId.value = diamondId;
}

function onCanvasMouseDown(ev: MouseEvent) {
  if (!ev.shiftKey) return;
  // Only start marquee on the canvas background, not on a node.
  const target = ev.target as HTMLElement;
  if (target.closest('.node') || target.closest('.builder__selection-toolbar')) {
    return;
  }
  const wrap = canvasWrapEl.value;
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const startX = ev.clientX - rect.left + wrap.scrollLeft;
  const startY = ev.clientY - rect.top + wrap.scrollTop;
  marquee.value = {
    active: true,
    startX,
    startY,
    curX: startX,
    curY: startY,
    initialSelection: new Set(selectedNodeIds.value),
  };
  ev.preventDefault();

  const onMove = (e: MouseEvent) => {
    if (!marquee.value || !canvasWrapEl.value) return;
    const r = canvasWrapEl.value.getBoundingClientRect();
    marquee.value.curX =
      e.clientX - r.left + canvasWrapEl.value.scrollLeft;
    marquee.value.curY =
      e.clientY - r.top + canvasWrapEl.value.scrollTop;
    updateMarqueeSelection();
  };
  const onUp = () => {
    if (marquee.value) {
      marquee.value.active = false;
      marquee.value = null;
    }
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function updateMarqueeSelection() {
  const m = marquee.value;
  if (!m) return;
  const left = Math.min(m.startX, m.curX);
  const right = Math.max(m.startX, m.curX);
  const top = Math.min(m.startY, m.curY);
  const bottom = Math.max(m.startY, m.curY);
  const next = new Set(m.initialSelection);
  for (const n of nodes.value) {
    const w = nodeWidth(n);
    const h = nodeHeight(n);
    const nLeft = n.x;
    const nRight = n.x + w;
    const nTop = n.y;
    const nBottom = n.y + h;
    const hit =
      nRight >= left && nLeft <= right && nBottom >= top && nTop <= bottom;
    if (hit) next.add(n.id);
  }
  selectedNodeIds.value = next;
}

// ----- Tidy up -----

const NODE_GAP_X = 80;
const NODE_GAP_Y = 60;

function forkSiblings(diamondId: string): string[] {
  // Decision diamonds with shared parent(s) are "linked siblings". Any
  // diamond whose incoming-source set is the same as another diamond's is
  // considered part of the same fork group. Approximation when the engine
  // hasn't stamped a forkGroupId yet.
  const incomingOf = (id: string) =>
    edges.value
      .filter((e) => e.to === id)
      .map((e) => e.from)
      .sort()
      .join('|');
  const target = nodes.value.find((n) => n.id === diamondId);
  if (!target || target.type !== 'decision') return [];
  const targetKey = incomingOf(diamondId);
  if (!targetKey) return [];
  return nodes.value
    .filter(
      (n) =>
        n.type === 'decision' &&
        n.id !== diamondId &&
        incomingOf(n.id) === targetKey,
    )
    .map((n) => n.id);
}

function linkedPartners(nodeId: string): string[] {
  // For an action/trigger that shares a decision-diamond parent with other
  // nodes (its siblings on a fork), the partners are those siblings. Tidy
  // up needs to keep the pair together so the layout stays organized.
  const node = nodes.value.find((n) => n.id === nodeId);
  if (!node) return [];
  if (node.type === 'decision') {
    return forkSiblings(nodeId);
  }
  const parents = edges.value
    .filter((e) => e.to === nodeId)
    .map((e) => e.from);
  const diamondParents = parents.filter((p) => {
    const pn = nodes.value.find((n) => n.id === p);
    return pn?.type === 'decision';
  });
  if (diamondParents.length === 0) return [];
  const partners = new Set<string>();
  for (const p of diamondParents) {
    for (const e of edges.value) {
      if (e.from === p && e.to !== nodeId) partners.add(e.to);
    }
  }
  return Array.from(partners);
}

function findMissingLinkedNodes(selected: Set<string>): string[] {
  const missing = new Set<string>();
  for (const id of selected) {
    for (const partner of linkedPartners(id)) {
      if (!selected.has(partner)) missing.add(partner);
    }
  }
  return Array.from(missing);
}

function countLinkedPairs(selected: Set<string>): number {
  const seen = new Set<string>();
  let count = 0;
  for (const id of selected) {
    if (seen.has(id)) continue;
    const partners = linkedPartners(id).filter((p) => selected.has(p));
    if (partners.length === 0) continue;
    count += 1;
    seen.add(id);
    for (const p of partners) seen.add(p);
  }
  return count;
}

function onTidyUpClick() {
  const selected = selectedNodeIds.value;
  if (selected.size < 2) return;
  const missingIds = findMissingLinkedNodes(selected);
  if (missingIds.length > 0) {
    tidyDialog.value = {
      kind: 'warning',
      affected: Array.from(selected),
      missing: missingIds.map((id) => {
        const n = nodes.value.find((nn) => nn.id === id);
        return { id, title: n?.title ?? id };
      }),
    };
    return;
  }
  openConfirmDialog(Array.from(selected));
}

function openConfirmDialog(affected: string[]) {
  const set = new Set(affected);
  const layout = computeTidyLayout(affected);
  tidyDialog.value = {
    kind: 'confirm',
    affected,
    preview: {
      columns: layout.columns,
      rows: layout.rows,
      linkedPairs: countLinkedPairs(set),
    },
  };
}

function confirmTidy() {
  if (!tidyDialog.value) return;
  if (tidyDialog.value.kind === 'warning') {
    const next = new Set(selectedNodeIds.value);
    for (const m of tidyDialog.value.missing) next.add(m.id);
    selectedNodeIds.value = next;
    openConfirmDialog(Array.from(next));
    return;
  }
  applyTidyLayout(tidyDialog.value.affected);
  tidyDialog.value = null;
}

function computeTidyLayout(affected: string[]): {
  positions: Map<string, { x: number; y: number }>;
  columns: number;
  rows: number;
} {
  const set = new Set(affected);
  const idToNode = new Map(nodes.value.map((n) => [n.id, n]));

  // Build induced subgraph adjacency over the selection.
  const indegree = new Map<string, number>();
  const outAdj = new Map<string, string[]>();
  for (const id of affected) {
    indegree.set(id, 0);
    outAdj.set(id, []);
  }
  for (const e of edges.value) {
    if (set.has(e.from) && set.has(e.to)) {
      outAdj.get(e.from)!.push(e.to);
      indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
    }
  }

  // Order roots by their current x then y so left-most upstream stays left.
  const sortByPos = (ids: string[]) =>
    ids
      .slice()
      .sort((a, b) => {
        const na = idToNode.get(a)!;
        const nb = idToNode.get(b)!;
        return na.x - nb.x || na.y - nb.y;
      });

  // Compute column (level) per node by longest path from any root in the subgraph.
  const level = new Map<string, number>();
  for (const id of affected) level.set(id, 0);
  // Kahn-style topological pass.
  const queue = sortByPos(affected.filter((id) => indegree.get(id) === 0));
  const remaining = new Map(indegree);
  const visited = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const lvl = level.get(id) ?? 0;
    for (const next of outAdj.get(id) ?? []) {
      level.set(next, Math.max(level.get(next) ?? 0, lvl + 1));
      remaining.set(next, (remaining.get(next) ?? 1) - 1);
      if ((remaining.get(next) ?? 0) <= 0) queue.push(next);
    }
  }
  // Any unvisited (cycle / orphan) gets its own column 0.
  for (const id of affected) {
    if (!level.has(id)) level.set(id, 0);
  }

  // Group by column, sort within column by current y to keep relative order.
  const columns = new Map<number, string[]>();
  for (const id of affected) {
    const c = level.get(id)!;
    if (!columns.has(c)) columns.set(c, []);
    columns.get(c)!.push(id);
  }
  for (const arr of columns.values()) {
    arr.sort((a, b) => {
      const na = idToNode.get(a)!;
      const nb = idToNode.get(b)!;
      return na.y - nb.y || na.x - nb.x;
    });
  }

  // Anchor: top-left of current selection bounding box.
  let anchorX = Infinity;
  let anchorY = Infinity;
  for (const id of affected) {
    const n = idToNode.get(id)!;
    if (n.x < anchorX) anchorX = n.x;
    if (n.y < anchorY) anchorY = n.y;
  }
  if (!Number.isFinite(anchorX)) anchorX = 80;
  if (!Number.isFinite(anchorY)) anchorY = 80;

  const positions = new Map<string, { x: number; y: number }>();
  const colKeys = Array.from(columns.keys()).sort((a, b) => a - b);
  let cursorX = anchorX;
  let maxRows = 0;
  for (const c of colKeys) {
    const ids = columns.get(c)!;
    let cursorY = anchorY;
    let colWidth = 0;
    for (const id of ids) {
      const n = idToNode.get(id)!;
      positions.set(id, { x: cursorX, y: cursorY });
      cursorY += nodeHeight(n) + NODE_GAP_Y;
      colWidth = Math.max(colWidth, nodeWidth(n));
    }
    if (ids.length > maxRows) maxRows = ids.length;
    cursorX += colWidth + NODE_GAP_X;
  }

  return { positions, columns: colKeys.length, rows: maxRows };
}

function applyTidyLayout(affected: string[]) {
  const { positions } = computeTidyLayout(affected);
  nodes.value = nodes.value.map((n) => {
    const p = positions.get(n.id);
    if (!p) return n;
    return { ...n, x: p.x, y: p.y };
  });
}

const pickerOriginId = computed(() => picker.value?.originId ?? null);

function openPicker(
  origin: BuilderNode,
  ev: MouseEvent,
  options: { type?: 'when' | 'then' } = {},
) {
  picker.value = null;
  const type: 'when' | 'then' = options.type ?? 'then';

  // Position the picker UNDER the + button (the click target) with a
  // 4 px gap. Left-aligned to the button's left edge by default; the
  // picker flips to right-aligned (so its right edge == btn.right) if
  // it would overflow the canvas wrap's right edge — see
  // InlineAddPicker's `applySmartAlignment`.
  //
  // We store anchor positions in DOCUMENT coordinates (= viewport +
  // current scroll). CSS `left:` is relative to the initial containing
  // block (which starts at document origin, not the scrolled viewport),
  // so using document coords lets the picker apply the values directly
  // as inline styles without any subsequent conversion.
  const btnRect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
  const sx = window.scrollX || 0;
  const sy = window.scrollY || 0;
  const x = btnRect.left + sx;
  const y = btnRect.bottom + 4 + sy;

  picker.value = {
    originId: origin.id,
    type,
    anchor: { x, y },
    anchorBtn: {
      left: btnRect.left + sx,
      right: btnRect.right + sx,
      bottom: y,
    },
  };
}

/** Nodes with no outgoing edge — these are the "latest sequences"
 *  where the user typically wants to keep building. Decisions excluded
 *  since they route through their own dedicated UI. */
const leafNodes = computed(() =>
  nodes.value.filter(
    (n) =>
      n.type !== 'decision' &&
      !edges.value.some((e) => e.from === n.id),
  ),
);

function isWhenLeaf(n: BuilderNode) {
  return n.type === 'trigger';
}
function isThenLeaf(n: BuilderNode) {
  return n.type === 'action';
}

/** Position of the dashed add-inline container for a leaf node. */
function addInlineStyle(n: BuilderNode) {
  const gap = 40;
  return {
    left: `${n.x + NODE_W + gap}px`,
    top: `${n.y + NODE_H / 2}px`,
  };
}

/** Open the picker keyed to a specific type from a leaf's add-inline. */
function openInlinePicker(
  n: BuilderNode,
  type: 'when' | 'then',
  ev: MouseEvent,
) {
  openPicker(n, ev, { type });
}

function onPickIcon(item: IconItem) {
  if (!picker.value) return;
  if (picker.value.originId === STARTING_POINT_SENTINEL) {
    seedFirstNode({ name: item.slug, title: item.title });
  } else if (item.slug === 'get-email-opt-in') {
    // Locked-pair shortcut for Get email opt-in (per HANDOFF §10)
    insertGetEmailOptInLockedPair(picker.value.originId, item);
  } else {
    insertAfter(picker.value.originId, {
      type: picker.value.type === 'when' ? 'trigger' : 'action',
      name: item.slug,
      title: item.title,
    });
  }
  picker.value = null;
}

function onPickWhen(item: IconItem) {
  if (!picker.value) return;
  if (picker.value.originId === STARTING_POINT_SENTINEL) {
    seedFirstNode({ name: item.slug, title: item.title });
  } else {
    insertAfter(picker.value.originId, {
      type: 'trigger',
      name: item.slug,
      title: item.title,
    });
  }
  picker.value = null;
}

function onPickThen(item: IconItem) {
  if (!picker.value) return;
  if (item.slug === 'get-email-opt-in') {
    insertGetEmailOptInLockedPair(picker.value.originId, item);
  } else {
    insertAfter(picker.value.originId, {
      type: 'action',
      name: item.slug,
      title: item.title,
    });
  }
  picker.value = null;
}

// ===================================================================
// Locked pairs registry (per HANDOFF §10)
// ===================================================================

type LockedPair = { hostId: string; partnerId: string; edgeId: string };
const lockedPairs = ref<LockedPair[]>([]);

function buildEmailOptInLockedPairCells(
  payload: { slug: string; title: string },
  hostX: number,
  hostY: number,
) {
  const hostId = uid('n');
  const partnerId = uid('n');
  const edgeId = uid('e');
  const host: BuilderNode = {
    id: hostId,
    type: 'action',
    title: 'Email Confirmation Request',
    name: payload.slug, // 'get-email-opt-in' under the hood
    x: hostX,
    y: hostY,
  };
  const partner: BuilderNode = {
    id: partnerId,
    type: 'trigger',
    title: 'Confirm Email',
    name: 'confirm-email',
    x: hostX + NODE_W + LOCKED_PAIR_GAP,
    y: hostY,
  };
  const lockEdge: BuilderEdge = { id: edgeId, from: hostId, to: partnerId };
  return { host, partner, lockEdge };
}

function insertGetEmailOptInLockedPair(
  originId: string,
  item: { slug: string; title: string },
) {
  const origin = nodes.value.find((n) => n.id === originId);
  if (!origin) return;
  const { host, partner, lockEdge } = buildEmailOptInLockedPairCells(
    item,
    origin.x + NODE_W + PH_GAP,
    origin.y,
  );
  nodes.value = [...nodes.value, host, partner];
  edges.value = [
    ...edges.value,
    { id: uid('e'), from: originId, to: host.id },
    lockEdge,
  ];
  lockedPairs.value = [
    ...lockedPairs.value,
    { hostId: host.id, partnerId: partner.id, edgeId: lockEdge.id },
  ];
}

function lockedPairForNode(nodeId: string): LockedPair | null {
  return (
    lockedPairs.value.find(
      (p) => p.hostId === nodeId || p.partnerId === nodeId,
    ) ?? null
  );
}
function isLockedEdge(edgeId: string): boolean {
  return lockedPairs.value.some((p) => p.edgeId === edgeId);
}

function onPickDD() {
  if (!picker.value) return;
  const result = insertDecisionDiamondAfter(
    picker.value.originId,
    nodes.value,
    edges.value,
  );
  nodes.value = result.nodes;
  edges.value = result.edges;
  picker.value = null;
  if (result.diamondId) {
    selectedNodeIds.value = new Set([result.diamondId]);
    openDecisionEditor(result.diamondId);
  }
}

function insertAfter(
  originId: string,
  payload: { type: 'action' | 'trigger'; name: string; title: string },
) {
  const origin = nodes.value.find((n) => n.id === originId);
  if (!origin) return;
  const newId = uid('n');
  const newNode: BuilderNode = {
    id: newId,
    type: payload.type,
    name: payload.name,
    title: payload.title,
    x: origin.x + nodeWidth(origin) + PH_GAP,
    y: origin.y,
  };
  // If origin already has outgoing, route through (auto-insert pass will sort it).
  nodes.value = [...nodes.value, newNode];
  edges.value = [
    ...edges.value,
    { id: uid('e'), from: originId, to: newId },
  ];
  // Action-menu workflow: don't auto-pop the trigger config modal on
  // insert. Users open it via "View and edit" from the per-node menu.
  // (Was: maybeOpenTriggerConfig(newNode))
}

// Engine: keep decision diamonds even when they have ≤1 outgoing edge.
// The auto-dissolve pass was removing diamonds when the user re-wired a
// sequence away from one, which surprised users — they expect the
// diamond they placed to stay until they explicitly delete it.
let isApplyingPass = false;
watch(
  [() => edges.value, () => nodes.value],
  () => {
    if (isApplyingPass) return;
    // Decision diamonds are no longer auto-dissolved here. To restore
    // the old behavior, call dissolveCollapsedDiamonds(nodes.value,
    // edges.value) and apply its result.
    void dissolveCollapsedDiamonds; // kept imported for future use

    // Sync any open editor's groups to current outgoing edges.
    if (editorDiamondId.value && decisionConfigs[editorDiamondId.value]) {
      decisionConfigs[editorDiamondId.value] = syncGroupsToEdges(
        decisionConfigs[editorDiamondId.value],
        editorDiamondId.value,
        nodes.value,
        edges.value,
      );
    }
  },
  { deep: true },
);
</script>

<style scoped>
.builder {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f7f8fa;
}
.builder__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid #e7e7e7;
  flex-shrink: 0;
}
.builder__topbar-left,
.builder__topbar-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.builder__status-pill {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--dex-color-gray-100, #f3f4f6);
  color: var(--dex-color-gray-700, #6b7280);
}
.builder__canvas-wrap {
  position: relative;
  flex: 1;
  overflow: hidden;
  min-height: 0;
  background: #fafafa;
  cursor: grab; /* canvas background invites click-and-drag panning */
  /* Prevent trackpad horizontal swipe from triggering browser back when
     the user pans across the canvas. */
  overscroll-behavior: none;
  overscroll-behavior-x: none;
}
.builder__canvas-wrap--pan-mode {
  cursor: grab;
}
.builder__canvas-wrap--panning,
.builder__canvas-wrap--panning .builder__surface {
  cursor: grabbing;
}
/* Drop-target highlight intentionally suppressed — the drop point
 * lands on the canvas under the cursor without any extra chrome. */
.builder__sidebar-item[draggable='true'] {
  cursor: grab;
}
.builder__sidebar-item[draggable='true']:active {
  cursor: grabbing;
}

/* The pan/zoom transformed surface — every node, edge, and inline-add
 * element lives here. Pan/zoom apply to this layer only; the bottom
 * toolbar and floating UI sit outside this transform in canvas-wrapper
 * space (per HANDOFF §4). */
.builder__surface {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: top left;
  will-change: transform;
}
/* Edge interaction states (per funnel connector spec §5) */
.edge-group {
  cursor: pointer;
}
.edge-group--locked {
  cursor: default;
}
/* Default → hover: darker stroke when the hit-stroke or visible
 * line is hovered. Locked + selected states override these. */
.edge-group:not(.edge-group--locked):not(.edge-group--selected):hover
  .edge-line {
  stroke: #9aa3ad;
}

/* Floating "Delete connection" pill at the bezier midpoint.
 * `transform-origin: center` + inline transform from edgeDeletePillStyle
 * keeps the pill centered on the midpoint while inverse-scaling against
 * the canvas zoom so it always renders at native readable size. */
.edge-delete-pill {
  position: absolute;
  transform-origin: center;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: #fff;
  border: 1px solid #e7e7e7;
  border-radius: 999px;
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.12),
    0 2px 4px rgba(0, 0, 0, 0.08);
  font-size: 14px;
  font-weight: 600;
  color: var(--dex-color-red-700, #dc2626);
  cursor: pointer;
  z-index: 6;
  --dex-icon-size: 16px;
  white-space: nowrap;
}
.edge-delete-pill:hover {
  background: rgba(220, 38, 38, 0.06);
}
.edge-delete-pill:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.builder__edges {
  position: absolute;
  /* width/height + viewBox come from `surfaceBounds` so 1 SVG user
   * unit == 1 CSS pixel. Do not hard-code dimensions here. */
  pointer-events: none;
  overflow: visible;
}
.builder__edges path {
  pointer-events: stroke;
}

.node {
  position: absolute;
  cursor: grab;
  user-select: none;
}
.node:active {
  cursor: grabbing;
}
.node--dragging {
  cursor: grabbing;
  z-index: 6;
}
.node--trigger .node__card,
.node--action .node__card {
  width: 100%;
  height: 100%;
  background: #fff;
  border: 2px solid var(--dex-color-gray-200, #e5e7eb);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.node--selected .node__card {
  border-color: #8358f1;
}

/* ---------- New square-tile node visual (matches reference) ---------- */
/* ===================================================================
 * Canvas Sequence Tile — pixel-precise per HANDOFF-CANVAS-SEQUENCE-V1
 * =================================================================== */
.node__tile-wrap,
.node__decision-wrap {
  width: 100%;
  height: 100%;
  position: relative;
  display: block;
}

/* Tile body: 90×90, white, 22-radius, flat drop shadow (no blur). */
.node__tile {
  position: absolute;
  top: 0;
  left: 0;
  width: 90px;
  height: 90px;
  background: #ffffff;
  border-radius: 22px;
  box-shadow:
    0 4px 0 rgba(0, 0, 0, 0.5),
    0 0 0 6px transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: box-shadow 0.12s ease;
}
/* Selection ring — 6 px purple, rendered as outer box-shadow so it
 * composes with the tile drop shadow and never reflows layout. */
.node__tile--selected {
  box-shadow:
    0 4px 0 rgba(0, 0, 0, 0.5),
    0 0 0 6px #8358f1;
}
/* Drop-target ring overrides selection ring during drag-to-connect. */
.node__tile--connect-target {
  box-shadow:
    0 4px 0 rgba(0, 0, 0, 0.5),
    0 0 0 6px #000000;
}

/* Main icon — 48×48 centered, tinted by node-type accent. */
.node__tile-icon {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #22a06b; /* trigger green default */
  --dex-icon-size: 48px;
}
.node--action .node__tile-icon {
  color: #2f6fed; /* action blue */
}
.node__tile-icon :deep(svg),
.node__tile-icon svg {
  width: 48px !important;
  height: 48px !important;
}
.node__tile-icon--fallback {
  font-weight: 700;
  font-size: 30px;
}

/* Status bullseye (top-right corner, overhangs 8 px). */
.node__tile-dot {
  position: absolute;
  width: 30px;
  height: 30px;
  left: 68px;          /* NODE_W - STATUS_SIZE + STATUS_OVERHANG */
  top: -8px;           /* -STATUS_OVERHANG */
  background: #c8f0c8; /* halo — published */
  border: 4px solid #fff;
  border-radius: 50%;
  z-index: 2;
}
.node__tile-dot::after {
  content: '';
  position: absolute;
  inset: 5px;
  background: #36a635; /* inner dot — published */
  border-radius: 50%;
}

/* Decision tile — white card with the same chrome as other tiles, and
 * a small blue rotated-square icon centered inside. The bounding box
 * is still 90×90 so connector anchors stay consistent. */
.node__decision-shape {
  position: absolute;
  top: 0;
  left: 0;
  width: 90px;
  height: 90px;
  background: #ffffff;
  border-radius: 22px;
  box-shadow:
    0 4px 0 rgba(0, 0, 0, 0.5),
    0 0 0 6px transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.node__decision-shape--selected {
  box-shadow:
    0 4px 0 rgba(0, 0, 0, 0.5),
    0 0 0 6px #8358f1;
}
/* Small blue diamond icon inside the tile. */
.node__decision-shape::before {
  content: '';
  width: 32px;
  height: 32px;
  background: #2f6fed;
  border-radius: 4px;
  transform: rotate(45deg);
}
.node__decision-dot {
  position: absolute;
  width: 30px;
  height: 30px;
  left: 68px;
  top: -8px;
  background: #c8f0c8;
  border: 4px solid #fff;
  border-radius: 50%;
  transform: none;
  z-index: 2;
}
.node__decision-dot::after {
  content: '';
  position: absolute;
  inset: 5px;
  background: #36a635;
  border-radius: 50%;
}

/* Title label — 373 px wide block extending past the tile on both
 * sides, sits 122 px below the tile's top edge. 26 px font, max 5
 * wrap lines. */
.node__caption {
  position: absolute;
  width: 373px;
  left: calc(50% - 373px / 2);
  top: 122px;
  font-size: 26px;
  line-height: 1.2;
  color: #000;
  text-align: center;
  white-space: normal;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
  line-clamp: 5;
  overflow: hidden;
  margin: 0;
}
.node--decision .node__caption {
  color: rgba(0, 0, 0, 0.6);
}
.node__caption--button {
  background: transparent;
  border: 0;
  padding: 0;
  cursor: text;
  font-family: inherit;
  pointer-events: auto;
}
.node__caption--button:hover {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 4px;
}
.node__caption--rename {
  width: 373px;
  font-size: 26px;
  line-height: 1.2;
  font-family: inherit;
  color: #000;
  text-align: center;
  background: #fff;
  border: 2px solid #8358f1;
  border-radius: 8px;
  padding: 4px 8px;
  resize: none;
  outline: none;
  box-sizing: border-box;
}
.node__type {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--dex-color-gray-700, #6b7280);
}
.node__title {
  font-size: 14px;
  font-weight: 600;
  color: #272727;
  line-height: 1.3;
}
.node__subtitle {
  font-size: 12px;
  color: var(--dex-color-gray-700, #6b7280);
  line-height: 1.3;
}
.node__diamond {
  width: 100%;
  height: 100%;
  position: relative;
}
.node__decision-label {
  position: absolute;
  bottom: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  font-weight: 600;
  color: var(--dex-color-gray-700, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.node__add {
  position: absolute;
  /* Anchor at the right-middle of the tile (NODE_W, NODE_H/2).
   * Inverse-scale + translate composes a native 36×36 button
   * positioned 8 px past the tile edge, regardless of canvas zoom. */
  left: 90px; /* NODE_W — anchor point */
  top: 45px; /* NODE_H / 2 — vertically centered against tile */
  width: 36px;
  height: 36px;
  margin: 0;
  transform: translateY(-50%)
    translateX(calc(8px * (1 / var(--canvas-zoom, 1))))
    scale(calc(1 / var(--canvas-zoom, 1)));
  transform-origin: left center;
  border-radius: 50%;
  background: #fff;
  border: 1.5px solid var(--dex-color-blue-700, #006ceb);
  color: var(--dex-color-blue-700, #006ceb);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition:
    opacity 0.12s ease,
    background 0.12s ease;
  z-index: 5;
  padding: 0;
  --dex-icon-size: 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}
.node:hover .node__add,
.node--selected .node__add,
.node__add--active {
  opacity: 1;
}
.node__add:hover,
.node__add--active {
  background: var(--dex-color-blue-50, #eff6ff);
}

/* ---------- Node + button tooltips (per spec) ---------- */
/* ---------- Standard hover tooltip — shared by every canvas
 * touch-point (node status, hover "+" tooltip, etc.). One dark pill
 * style at compact native size, inverse-scaled against canvas zoom
 * so it always reads the same regardless of zoom. */
.node__status-tooltip,
.node__add-tooltip {
  position: absolute;
  padding: 6px 10px;
  background: #272727;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
}
.node__status-tooltip {
  left: 45px; /* NODE_W / 2 */
  top: -8px;
  transform: translate(-50%, -100%)
    scale(calc(1 / var(--canvas-zoom, 1)));
  transform-origin: bottom center;
  z-index: 6;
}
.node__status-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: #272727;
}
.node:hover .node__status-tooltip {
  opacity: 1;
}
/* When the user is on the "+" itself, hide the node-level tooltip
 * so the button-level one can take over (no overlap). */
.node__add:hover ~ .node__status-tooltip,
.node:has(.node__add:hover) .node__status-tooltip {
  opacity: 0;
}

.node__add-tooltip {
  /* IMPORTANT: do NOT inverse-scale here. The parent `.node__add` is
   * already inverse-scaled against --canvas-zoom for + button
   * readability. Adding another inverse-scale stacks them and makes
   * this tooltip render ~2× the size of the status tooltip on the
   * node body, which IS a direct child of `.node` and only inverse-
   * scales once. */
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  transform-origin: bottom center;
  z-index: 7;
}
.node__add-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: #272727;
}
.node__add:hover .node__add-tooltip {
  opacity: 1;
}
/* While the picker is open the user has clearly already engaged the
 * + button — keep the tooltip hidden so it doesn't shadow the picker. */
.node__add--active .node__add-tooltip {
  opacity: 0;
}

.node--multi-selected .node__card {
  box-shadow: 0 0 0 2px rgba(131, 88, 241, 0.18),
    0 1px 2px rgba(0, 0, 0, 0.04);
}

/* ---------- NodeActionMenu ---------- */
.node-action-menu {
  position: absolute;
  background: #fff;
  border-radius: 12px;
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.16),
    0 2px 6px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
  padding: 6px;
  min-width: 220px;
  z-index: 8;
  --dex-icon-size: 18px;
  font-size: 14px;
  font-family: inherit;
}
.node-action-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  color: var(--dex-fgColor-default, #272727);
  font-family: inherit;
  font-size: 14px;
}
.node-action-menu__item:hover {
  background: var(--dex-color-gray-100, #f3f4f6);
}
.node-action-menu__item:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: -1px;
}
.node-action-menu__item--danger {
  color: var(--dex-color-red-700, #dc2626);
}
.node-action-menu__item--danger:hover {
  background: rgba(220, 38, 38, 0.08);
}
.node-action-menu__divider {
  height: 1px;
  background: var(--dex-borderColor-alpha-subtle, #e5e7eb);
  margin: 6px 0;
}
.node-action-menu__ready {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  font-weight: 500;
}
.node-action-menu__switch {
  width: 36px;
  height: 20px;
  border-radius: 999px;
  border: 0;
  background: var(--dex-color-gray-300, #d1d5db);
  position: relative;
  cursor: pointer;
  padding: 0;
}
.node-action-menu__switch[aria-checked='true'] {
  background: #3b82f6;
}
.node-action-menu__switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s ease;
}
.node-action-menu__switch-thumb--on {
  transform: translateX(16px);
}

.builder__marquee {
  position: absolute;
  pointer-events: none;
  background: rgba(131, 88, 241, 0.08);
  border: 1px dashed #8358f1;
  border-radius: 4px;
  z-index: 4;
}

.builder__selection-toolbar {
  position: sticky;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid var(--dex-color-gray-200, #e5e7eb);
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 20;
  margin: 0 auto;
  width: max-content;
}

.builder__selection-count {
  font-size: 13px;
  font-weight: 600;
  color: #272727;
  padding: 0 4px;
}
</style>

<style>
/* Teleported modal — unscoped so styles apply at document body. */
.tidy-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
}
.tidy-modal {
  width: 540px;
  max-width: calc(100vw - 32px);
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 24px 38px 3px rgba(0, 0, 0, 0.14),
    0 9px 46px 8px rgba(0, 0, 0, 0.12),
    0 11px 15px -7px rgba(0, 0, 0, 0.2);
  font-family: "Sul Sans", Helvetica, Arial, sans-serif;
  overflow: hidden;
}
.tidy-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.09);
}
.tidy-modal__title {
  font-size: 20px;
  font-weight: 400;
  line-height: 20px;
  color: #444;
  margin: 0;
}
.tidy-modal__close {
  width: 40px;
  height: 40px;
  border: 0;
  background: transparent;
  font-size: 24px;
  line-height: 1;
  color: #444;
  cursor: pointer;
  border-radius: 999px;
}
.tidy-modal__close:hover {
  background: rgba(0, 0, 0, 0.06);
}
.tidy-modal__body {
  padding: 20px 24px 4px;
  color: rgba(0, 0, 0, 0.824);
  font-size: 14px;
  line-height: 20px;
}
.tidy-modal__text {
  margin: 0 0 12px;
}
.tidy-modal__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tidy-modal__list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(131, 88, 241, 0.06);
  border-radius: 8px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.824);
}
.tidy-modal__chip {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 999px;
  background: #8358f1;
  color: #fff;
}
.tidy-modal__summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: #f7f8fa;
  border-radius: 8px;
}
.tidy-modal__summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.tidy-modal__summary-label {
  color: rgba(0, 0, 0, 0.6);
}
.tidy-modal__summary-value {
  color: rgba(0, 0, 0, 0.824);
  font-weight: 600;
}
.tidy-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px 20px;
}

/* ===================== Persistent add-inline affordance ===================== */
.add-inline {
  position: absolute;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.6);
  border: 1.5px dashed var(--dex-color-gray-400, #9ca3af);
  border-radius: 12px;
  width: 50px;
  z-index: 3;
}
.add-inline--single {
  height: 50px;
  justify-content: center;
}
.add-inline--double {
  height: 85px;
  justify-content: space-between;
}
.add-inline__connector {
  position: absolute;
  left: -32px;
  top: 50%;
  width: 32px;
  height: 1.5px;
  background: var(--dex-color-gray-400, #9ca3af);
  transform: translateY(-50%);
}
.add-inline__btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1.5px solid transparent;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s ease;
  padding: 0;
}
.add-inline__btn--when {
  color: #2e7d32;
  border-color: #2e7d32;
}
.add-inline__btn--when:hover {
  background: rgba(46, 125, 50, 0.12);
}
.add-inline__btn--then {
  color: #1976d2;
  border-color: #1976d2;
}
.add-inline__btn--then:hover {
  background: rgba(25, 118, 210, 0.12);
}
.add-inline__btn:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: 2px;
}

/* ===================== New header bar ===================== */
.builder__title-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 4px;
}
.builder__title {
  margin: 0;
  font-weight: 700;
  font-size: 18px;
  line-height: 1.2;
}
.builder__subtitle-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.builder__subtitle {
  font-size: 12px;
  color: var(--dex-fgColor-muted, #6b7280);
}
.builder__status-pill {
  background: var(--dex-color-green-100, #dcfce7);
  color: var(--dex-color-green-800, #166534);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.builder__topbar-right {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.builder__saved {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--dex-fgColor-success, var(--dex-color-green-700, #16a34a));
  --dex-icon-size: 16px;
}
.builder__saved :deep(svg) {
  color: var(--dex-fgColor-success, var(--dex-color-green-700, #16a34a));
}
.builder__divider {
  width: 1px;
  height: 18px;
  background: var(--dex-borderColor-alpha-subtle, #e5e7eb);
}
.builder__features {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}
.builder__switch {
  width: 32px;
  height: 18px;
  border-radius: 999px;
  border: 0;
  background: var(--dex-color-gray-300, #d1d5db);
  position: relative;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease;
}
.builder__switch[aria-checked='true'] {
  background: #3b82f6;
}
.builder__switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s ease;
}
.builder__switch-thumb--on {
  transform: translateX(14px);
}
.builder__reporting-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 0;
  color: #006ceb;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  --dex-icon-size: 16px;
}
.builder__reporting-link:hover {
  text-decoration: underline;
}

/* ===================== Body layout ===================== */
.builder__body {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
}

/* ===================== Left sidebar ===================== */
.builder__sidebar {
  width: 400px;
  background: #fff;
  border-right: 1px solid #e7e7e7;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex-shrink: 0;
}
.builder__sidebar-tabs {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #e7e7e7;
  padding: 0 8px;
  height: 41px;
}
.builder__sidebar-tab {
  background: transparent;
  border: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--dex-fgColor-muted, #6b7280);
  padding: 12px 16px;
  cursor: pointer;
  position: relative;
}
.builder__sidebar-tab--active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 16px;
  right: 16px;
  height: 2px;
  border-radius: 1px;
}

/* Active tab — text always reads dark; only the underline carries the
 * per-tab color (green for When, blue for Then). */
.builder__sidebar-tab--active {
  color: var(--dex-fgColor-default, #272727);
}
.builder__sidebar-tab--when.builder__sidebar-tab--active::after {
  background: var(--dex-fgColor-success, var(--dex-color-green-700, #16a34a));
}
.builder__sidebar-tab--then.builder__sidebar-tab--active::after {
  background: var(--dex-color-blue-700, #006ceb);
}
.builder__sidebar-collapse {
  margin-left: auto;
}
.builder__sidebar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px;
  padding: 8px 12px;
  border: 1px solid #cccccc;
  border-radius: 6px;
  background: #fff;
  --dex-icon-size: 16px;
  color: var(--dex-fgColor-muted, #6b7280);
}
.builder__sidebar-search-input {
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 14px;
  color: var(--dex-fgColor-default, #272727);
}
.builder__sidebar-list {
  list-style: none;
  padding: 4px 0;
  margin: 0;
  overflow-y: auto;
  flex: 1;
}
.builder__sidebar-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  cursor: pointer;
  font-size: 15px;
  border-bottom: 1px solid #eeeeee;
  color: var(--dex-fgColor-default, #272727);
}
.builder__sidebar-item:hover {
  background: var(--dex-color-gray-50, #f9fafb);
}
.builder__sidebar-item-icon {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.builder__sidebar-item-icon :deep(svg) {
  width: 24px;
  height: 24px;
}
.builder__sidebar-item-label {
  flex: 1;
  color: var(--dex-fgColor-default, #272727);
}
.builder__sidebar-item-new {
  background: var(--dex-color-green-100, #dcfce7);
  color: var(--dex-color-green-800, #166534);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}
.builder__sidebar-expand {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
  background: #fff;
  cursor: pointer;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  --dex-icon-size: 18px;
}

/* ===================== Empty state ===================== */
.builder__empty {
  /* Vertically: one third from the top of the visible canvas wrap so
   * the heading + card sit comfortably above the canvas mid-line,
   * leaving room below for the user's nodes to grow toward.
   * Horizontally: dead center. */
  position: absolute;
  top: 33%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-width: 520px;
  pointer-events: none;
}
.builder__empty-title {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.85);
  text-align: center;
}
.builder__empty-sub {
  margin: 0;
  font-size: 14px;
  color: var(--dex-fgColor-muted, #6b7280);
  text-align: center;
  line-height: 1.5;
}
.builder__starting-point {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: #fff;
  border: 1px dashed var(--dex-color-gray-400, #9ca3af);
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  margin-top: 8px;
  transition: border-color 0.12s ease, background 0.12s ease;
}
.builder__starting-point:hover {
  border-color: var(--dex-color-blue-700, #006ceb);
  background: var(--dex-color-blue-50, #eff6ff);
}
.builder__starting-plus {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--dex-color-green-600, #16a34a);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  flex-shrink: 0;
}
.builder__starting-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
.builder__starting-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--dex-fgColor-default, #272727);
}
.builder__starting-sub {
  font-size: 13px;
  color: var(--dex-fgColor-muted, #6b7280);
}

/* ===================== Bottom-left floating toolbar ===================== */
.builder__floating-toolbar {
  position: absolute;
  left: 16px;
  bottom: 16px;
  display: inline-flex;
  gap: 8px;
  background: transparent;
  border: 0;
  box-shadow: none;
  z-index: 5;
}
/* BottomBarIconButton (per HANDOFF §15) — DEX's own button has too-low
 * hover contrast, so re-skin it: clear at rest, sharper on hover. */
.builder__floating-toolbar .builder__floating-btn {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #4a4a4a;
  box-shadow: 0 1px 2px rgba(15, 23, 36, 0.05);
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}
.builder__floating-toolbar .builder__floating-btn:hover {
  background: #f1f2f5;
  border-color: #c9ced5;
  color: #0f1724;
}
.builder__floating-toolbar .builder__floating-btn:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: 2px;
}
.builder__floating-btn {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--dex-fgColor-default, #272727);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  --dex-icon-size: 18px;
}
.builder__floating-btn:hover {
  background: var(--dex-color-gray-100, #f3f4f6);
}
.builder__version {
  position: absolute;
  left: 232px;
  bottom: 2px;
  font-size: 11px;
  color: var(--dex-fgColor-muted, #9ca3af);
  z-index: 5;
  text-align: center;
  width: 96px;
}

/* Zoom controls sit just to the right of the bottom-left icon toolbar */
.builder__zoom {
  position: absolute;
  left: 218px;
  bottom: 16px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: #fff;
  border: 1px solid #e7e7e7;
  border-radius: 999px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  z-index: 5;
  font-size: 13px;
}
.builder__zoom-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  color: #4a4a4a;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s ease, color 0.12s ease;
}
.builder__zoom-btn:hover {
  background: #f1f2f5;
  color: #0f1724;
}
.builder__zoom-value {
  min-width: 36px;
  text-align: center;
  font-weight: 500;
}

/* ===================== Bottom-right help pill ===================== */
.builder__help-pill {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #fff;
  border: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  color: var(--dex-fgColor-default, #272727);
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  z-index: 5;
  --dex-icon-size: 14px;
}
.builder__help-pill:hover {
  background: var(--dex-color-gray-50, #f9fafb);
}
</style>
