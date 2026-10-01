<template>
  <div class="dd-editor-overlay">
    <div
      ref="rootEl"
      class="dd-editor"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dd-editor-title"
      tabindex="-1"
    >
      <!-- ================= Header ================= -->
      <header class="dd-editor__header">
        <DexIconButton
          ref="closeButtonEl"
          name="x"
          label="Close decision diamond editor"
          @click="$emit('close')"
        />
        <DexText
          id="dd-editor-title"
          variant="heading-3"
          as="h2"
          class="dd-editor__title"
        >
          Decision diamond
        </DexText>
        <div class="dd-editor__header-actions">
          <label class="dd-toggle" :for="aiSwitchId">
            <DexSwitch
              v-model="aiOpen"
              :id="aiSwitchId"
              aria-label="Toggle AI assistant"
            />
            <DexText variant="body-2" as="span">AI assistant</DexText>
          </label>
          <!-- Test button — opens a modal that takes user-provided
               sample inputs and runs the saved logic locally, surfacing
               which sequence the record would route to. Replaces the
               legacy tridot menu (which had only Reset diamond). -->
          <DexButton variant="outline" @click="testModalOpen = true">
            Test
          </DexButton>
          <DexButton variant="solid" @click="$emit('save')">
            Save
          </DexButton>
        </div>
      </header>

      <!-- ================= Body ================= -->
      <div
        ref="bodyEl"
        class="dd-editor__body"
        :class="{ 'dd-editor__body--single': !aiOpen }"
        :style="aiOpen ? bodyGridStyle : undefined"
      >
        <!-- ===== Left: AI assistant pane ===== -->
        <aside
          v-if="aiOpen"
          class="dd-ai"
          aria-labelledby="dd-ai-title"
        >
          <header class="dd-ai__header">
            <div class="dd-ai__header-title">
              <span class="dd-diamond dd-diamond--lg" aria-hidden="true" />
              <DexText
                id="dd-ai-title"
                variant="heading-4"
                as="h3"
              >
                AI assistant
              </DexText>
            </div>
            <button
              v-if="transcript.length > 0"
              type="button"
              class="dd-ai__reset-btn"
              aria-label="Start a new conversation"
              @click="confirmNewChat"
            >
              <DexIcon name="rotate-cw" aria-hidden="true" />
              New chat
            </button>
          </header>

          <div
            ref="transcriptEl"
            class="dd-ai__transcript"
            role="log"
            aria-live="polite"
            aria-atomic="false"
            aria-label="Assistant conversation"
          >
            <!-- Welcome / empty state -->
            <div v-if="transcript.length === 0" class="dd-ai__welcome">
              <DexText variant="heading-3" as="h4" class="dd-ai__welcome-title">
                How can I help with your decision logic?
              </DexText>
              <DexText variant="body-1" class="dd-ai__welcome-sub">
                Pick a starter or describe the rules that decide which
                sequence to run.
              </DexText>
              <div
                class="dd-ai__starters"
                role="group"
                aria-label="Starter templates"
              >
                <button
                  v-for="s in inlineSuggestions"
                  :key="s.id"
                  type="button"
                  class="dd-starter-card"
                  @click="applySuggestion(s.id)"
                >
                  <span class="dd-starter-card__title">{{ s.title }}</span>
                  <span class="dd-starter-card__desc">
                    {{ s.description }}
                  </span>
                </button>
              </div>
              <button
                v-if="availableSuggestions.length > inlineSuggestions.length"
                type="button"
                class="dd-ai__browse-all"
                @click="openTemplates"
              >
                Browse all templates
                <span aria-hidden="true">›</span>
              </button>
            </div>

            <!-- Conversation -->
            <template v-else>
              <div
                v-for="(msg, idx) in transcript"
                :key="idx"
                class="dd-ai__message"
                :class="{
                  'dd-ai__message--user': msg.role === 'user',
                  'dd-ai__message--assistant': msg.role === 'assistant',
                }"
              >
                <template v-if="msg.role === 'user'">
                  <div
                    class="dd-ai__user-bubble"
                    role="note"
                    aria-label="You said"
                  >
                    {{ msg.text }}
                  </div>
                </template>

                <template v-else>
                  <div class="dd-ai__assistant-bubble">
                    <div class="dd-ai__assistant-body">
                      <!-- Lightweight note (conversational feedback) -->
                      <template v-if="msg.kind === 'note'">
                        <p class="dd-ai__note-text">{{ msg.text }}</p>
                      </template>

                      <!-- Rich template message -->
                      <template v-else>
                        <div class="dd-ai__assistant-title">
                          Set up "{{ msg.title }}"
                        </div>
                        <ul class="dd-ai__branch-list">
                          <li
                            v-for="(step, sIdx) in msg.thenSteps"
                            :key="sIdx"
                            class="dd-ai__branch-item"
                          >
                            {{ step.decision }}
                          </li>
                        </ul>
                      </template>
                    </div>
                  </div>

                  <!-- Inline notification, broken out of the avatar
                       column so it aligns to the panel's left edge -->
                  <div
                    v-if="msg.kind === 'template'"
                    class="dd-ai__alert-row"
                  >
                    <DexInlineAlert>
                      Add and configure the sequences for this flow on
                      the canvas. This screen only sets the rules that
                      route into them.
                    </DexInlineAlert>
                  </div>
                </template>
              </div>

              <!-- Phase 1: spinning diamond while the AI is "thinking" -->
              <div
                v-if="isThinking"
                class="dd-ai__thinking"
                role="status"
                aria-live="polite"
              >
                <span
                  class="dd-diamond dd-diamond--spinning"
                  aria-hidden="true"
                />
                <span class="visually-hidden">Thinking…</span>
              </div>

              <!-- Phase 2: composing — diamond pulses + a 3-line text
                   shimmer placeholder mimics the response being written. -->
              <div
                v-if="isComposing"
                class="dd-ai__composing"
                role="status"
                aria-live="polite"
              >
                <span
                  class="dd-diamond dd-diamond--pulsing"
                  aria-hidden="true"
                />
                <div class="dd-ai__composing-lines">
                  <span class="dd-ai__composing-line dd-ai__composing-line--w70" />
                  <span class="dd-ai__composing-line dd-ai__composing-line--w90" />
                  <span class="dd-ai__composing-line dd-ai__composing-line--w55" />
                </div>
                <span class="visually-hidden">Composing reply…</span>
              </div>

              <!-- End-of-conversation marker — a static diamond shows
                   the AI has finished and the convo is at rest. -->
              <div
                v-if="!isThinking && !isComposing && hasAssistantTurn"
                class="dd-ai__end-marker"
                aria-hidden="true"
              >
                <span class="dd-diamond" />
              </div>

              <!-- Quick replies after the last assistant message -->
              <div
                v-if="showQuickReplies"
                class="dd-ai__quick-replies"
                role="group"
                aria-label="Quick follow-up actions"
              >
                <section
                  v-for="sec in quickReplySections"
                  :key="sec.id"
                  class="dd-quick-reply-section"
                  :aria-labelledby="`dd-qr-${sec.id}-title`"
                >
                  <h5
                    :id="`dd-qr-${sec.id}-title`"
                    class="dd-quick-reply-title"
                  >
                    {{ sec.title }}
                  </h5>
                  <div class="dd-quick-reply-pills">
                    <button
                      v-for="qr in sec.replies"
                      :key="qr.id"
                      type="button"
                      class="dd-quick-reply"
                      :class="`dd-quick-reply--${qr.kind}`"
                      @click="qr.action"
                    >
                      {{ qr.label }}
                    </button>
                  </div>
                </section>
              </div>
            </template>
          </div>

          <div class="dd-ai__composer">
            <div class="dd-ai__input-row">
              <button
                type="button"
                class="dd-ai__attach"
                aria-label="Open templates"
                aria-haspopup="dialog"
                :aria-expanded="templatesOpen"
                title="Open templates"
                @click="openTemplates"
              >
                <span aria-hidden="true">+</span>
              </button>
              <label :for="composerInputId" class="visually-hidden">
                Describe what you want to automate
              </label>
              <input
                :id="composerInputId"
                v-model="composerText"
                type="text"
                class="dd-ai__input"
                placeholder="Type in what you want to automate…"
                @keydown.enter="sendComposer"
              />
              <DexButton
                variant="solid"
                :disabled="!composerText.trim()"
                :aria-disabled="!composerText.trim()"
                @click="sendComposer"
              >
                Send
              </DexButton>
            </div>

            <!-- Templates portal popover -->
            <div
              v-if="templatesOpen"
              class="dd-templates-backdrop"
              @mousedown.self="closeTemplates"
              @keydown.esc="closeTemplates"
            >
              <div
                ref="templatesPanelEl"
                class="dd-templates"
                role="dialog"
                aria-modal="true"
                aria-labelledby="dd-templates-title"
              >
                <header class="dd-templates__header">
                  <div>
                    <DexText
                      id="dd-templates-title"
                      variant="heading-4"
                      as="h3"
                    >
                      Rule templates
                    </DexText>
                    <DexText variant="body-2" color="subtle">
                      Pick a starting point — you can edit anything after.
                    </DexText>
                  </div>
                  <DexIconButton
                    name="x"
                    label="Close templates"
                    @click="closeTemplates"
                  />
                </header>
                <div class="dd-templates__search">
                  <label class="visually-hidden" for="dd-templates-search">
                    Search templates
                  </label>
                  <input
                    id="dd-templates-search"
                    v-model="templatesQuery"
                    type="search"
                    class="dd-value-input dd-templates__search-input"
                    placeholder="Search templates…"
                  />
                </div>
                <div class="dd-templates__list">
                  <div
                    v-if="groupedTemplates.length === 0"
                    class="dd-templates__empty"
                  >
                    No templates match "{{ templatesQuery }}".
                  </div>
                  <section
                    v-for="grp in groupedTemplates"
                    :key="grp.category"
                    class="dd-templates__group"
                  >
                    <h4 class="dd-templates__group-title">
                      {{ grp.category }}
                    </h4>
                    <ul class="dd-templates__items">
                      <li v-for="t in grp.items" :key="t.id">
                        <button
                          type="button"
                          class="dd-templates__item"
                          :disabled="appliedSuggestionIds.has(t.id)"
                          @click="pickTemplate(t.id)"
                        >
                          <span class="dd-templates__item-title">
                            {{ t.title }}
                            <span
                              v-if="appliedSuggestionIds.has(t.id)"
                              class="dd-templates__applied-tag"
                            >Applied</span>
                          </span>
                          <span class="dd-templates__item-desc">
                            {{ t.description }}
                          </span>
                        </button>
                      </li>
                    </ul>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- Draggable resizer between AI and rules panes -->
        <div
          v-if="aiOpen"
          ref="resizerEl"
          class="dd-resizer"
          :class="{ 'dd-resizer--active': isResizing }"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the AI assistant panel"
          :aria-valuenow="aiWidth"
          :aria-valuemin="MIN_AI_WIDTH"
          :aria-valuemax="maxAiWidth"
          tabindex="0"
          @mousedown="startResize"
          @touchstart.prevent="startResizeTouch"
          @keydown="onResizerKey"
          @dblclick="resetAiWidth"
        >
          <span class="dd-resizer__grip" aria-hidden="true" />
        </div>

        <!-- ===== Right: rule cards + footer ===== -->
        <main
          class="dd-rules"
          :class="{ 'dd-rules--centered': !aiOpen }"
          aria-label="Sequence rules"
        >
          <template
            v-for="(group, gi) in config.groups"
            :key="group.id"
          >
            <!-- Drop indicator above the card -->
            <div
              v-if="dragOverIdx === gi && dragOverPos === 'before'"
              class="dd-drop-indicator"
              aria-hidden="true"
            />

            <section
              class="dd-card"
              :class="{
                'dd-card--dragging': draggingIdx === gi,
                'dd-card--drag-target':
                  dragOverIdx === gi && draggingIdx !== null && draggingIdx !== gi,
                'dd-card--just-updated': recentlyUpdatedGi === gi,
              }"
              :aria-labelledby="`dd-card-title-${group.id}`"
              @dragover.prevent="onCardDragOver(gi, $event)"
              @drop.prevent="onCardDrop(gi)"
              @dragleave="onCardDragLeave(gi, $event)"
            >
              <header class="dd-card__header">
                <button
                  v-if="config.groups.length > 1"
                  type="button"
                  class="dd-card__drag-handle"
                  draggable="true"
                  :aria-label="`Drag to reorder Sequence ${gi + 1}`"
                  title="Drag to reorder"
                  @dragstart="onDragStart(gi, $event)"
                  @dragend="onDragEnd"
                  @keydown="onDragHandleKeydown(gi, $event)"
                >
                  <DexIcon name="more-vertical" aria-hidden="true" />
                  <DexIcon name="more-vertical" aria-hidden="true" />
                </button>
                <div class="dd-card__title">
                  <DexText
                    :id="`dd-card-title-${group.id}`"
                    variant="heading-4"
                    as="h3"
                  >
                    Rules for "Sequence {{ gi + 1 }}"
                  </DexText>
                  <DexText variant="body-2">
                    What rules are allowed into the selected sequence?
                  </DexText>
                </div>
                <DexDropdownMenu align="end">
                  <template #default>
                    <DexIconButton name="more-vertical" label="More options" />
                  </template>
                  <template #content>
                    <DexDropdownMenuItem
                      v-if="config.groups.length > 1 && gi > 0"
                      title="Move up"
                      leading-icon="chevron-up"
                      @select="moveSequence(gi, gi - 1)"
                    />
                    <DexDropdownMenuItem
                      v-if="
                        config.groups.length > 1 &&
                        gi < config.groups.length - 1
                      "
                      title="Move down"
                      leading-icon="chevron-down"
                      @select="moveSequence(gi, gi + 1)"
                    />
                    <DexDropdownMenuItem title="Import rules from…" />
                    <DexDropdownMenuItem
                      title="Clear all rules"
                      @select="confirmDeleteAllRules(gi)"
                    />
                    <DexDropdownMenuItem
                      v-if="config.groups.length > 1"
                      title="Delete this sequence"
                      leading-icon="trash-2"
                      variant="danger"
                      @select="confirmDeleteSequence(gi)"
                    />
                  </template>
                </DexDropdownMenu>
              </header>

            <div class="dd-card__body">
              <template
                v-for="(block, bi) in group.blocks"
                :key="block.id"
              >
                <div class="dd-block">
                  <div
                    v-for="(cond, ci) in block.conditions"
                    :key="cond.id"
                    class="dd-rule"
                  >
                  <!-- ============ FIELD / SUBJECT SELECT ============
                       Flat dropdown listing deal fields plus a single
                       "Contact" entry at the same hierarchy. Picking a
                       deal field continues the deal cascade; picking
                       Contact switches the row to contact mode and the
                       next dropdown becomes the category picker. -->
                  <span class="dd-rule__lead">
                    {{ ci === 0 ? 'If the' : 'And' }}
                  </span>

                  <div class="dd-rule__select">
                    <DropdownSelect
                      :model-value="cond.entity === 'contact' ? 'contact' : cond.field"
                      :options="FIELD_OR_CONTACT_OPTIONS"
                      :aria-label="`Field for rule ${ci + 1} in ${groupDisplayName(gi)}`"
                      @update:model-value="(v) => onFieldOrContactValue(gi, bi, ci, v)"
                    />
                  </div>

                  <!-- ============ CONTACT-SCOPED CASCADE ============
                       Once the field dropdown above resolves to "Contact",
                       the row continues with category → attribute → operator → value. -->
                  <template v-if="cond.entity === 'contact'">
                    <!-- Category -->
                    <div class="dd-rule__select">
                      <DropdownSelect
                        :model-value="cond.category"
                        :options="CONTACT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))"
                        :aria-label="`Contact category for rule ${ci + 1}`"
                        @update:model-value="(v) => onContactCategoryValue(gi, bi, ci, v as ContactCategory)"
                      />
                    </div>

                    <!-- Attribute (skipped for Tags — per spec, Tags IS the attribute) -->
                    <div
                      v-if="cond.category && cond.category !== 'tags'"
                      class="dd-rule__select"
                    >
                      <DropdownSelect
                        :model-value="cond.field"
                        :options="attributesForContactRow(cond).map((a) => ({ value: a.id, label: a.label }))"
                        :aria-label="`Contact attribute for rule ${ci + 1}`"
                        @update:model-value="(v) => onContactAttributeValue(gi, bi, ci, v)"
                      />
                    </div>

                    <!-- Operator (filtered by attribute type) -->
                    <div
                      v-if="cond.category === 'tags' || cond.field"
                      class="dd-rule__select"
                    >
                      <DropdownSelect
                        :model-value="cond.operator"
                        :options="operatorsForContactRow(cond).map((o) => ({ value: o.id, label: o.label }))"
                        :aria-label="`Operator for rule ${ci + 1}`"
                        @update:model-value="(v) => onOperatorValue(gi, bi, ci, v)"
                      />
                    </div>

                    <!-- Value input(s) — varies by operator arity + field type -->
                    <template
                      v-if="cond.operator && operatorArity(cond) > 0"
                    >
                      <template v-if="operatorArity(cond) === 2">
                        <input
                          :value="cond.values[0] ?? ''"
                          :type="contactInputType(cond)"
                          class="dd-value-input"
                          :aria-label="`Lower bound for contact rule ${ci + 1}`"
                          @input="(e) => onValueAt(gi, bi, ci, 0, (e.target as HTMLInputElement).value)"
                        />
                        <span class="dd-rule__and" aria-hidden="true">and</span>
                        <input
                          :value="cond.values[1] ?? ''"
                          :type="contactInputType(cond)"
                          class="dd-value-input"
                          :aria-label="`Upper bound for contact rule ${ci + 1}`"
                          @input="(e) => onValueAt(gi, bi, ci, 1, (e.target as HTMLInputElement).value)"
                        />
                      </template>
                      <template v-else-if="contactValueEnumFor(cond)">
                        <DropdownSelect
                          :model-value="cond.values[0] ?? ''"
                          :options="(contactValueEnumFor(cond) || []).map((opt) => ({ value: opt, label: opt }))"
                          :aria-label="`Value for contact rule ${ci + 1}`"
                          @update:model-value="(v) => onSingleValueValue(gi, bi, ci, v)"
                        />
                      </template>
                      <!-- Tag value picker. Production would extract tags
                           from the upstream sequence connected to this
                           decision diamond; for now we surface a dummy
                           list (see DUMMY_TAG_OPTIONS). -->
                      <template v-else-if="cond.category === 'tags'">
                        <DropdownSelect
                          :model-value="cond.values[0] ?? ''"
                          :options="DUMMY_TAG_OPTIONS"
                          :aria-label="`Tag for contact rule ${ci + 1}`"
                          @update:model-value="(v) => onSingleValueValue(gi, bi, ci, v)"
                        />
                      </template>
                      <template v-else>
                        <input
                          :value="cond.values[0] ?? ''"
                          :type="contactInputType(cond)"
                          class="dd-value-input"
                          :placeholder="'Value'"
                          :aria-label="`Value for contact rule ${ci + 1}`"
                          @input="(e) => onValueAt(gi, bi, ci, 0, (e.target as HTMLInputElement).value)"
                        />
                      </template>
                    </template>
                  </template>

                  <!-- ============ DEAL-SCOPED CASCADE (default) ============
                       The unified field/subject dropdown is above. What
                       remains here is operator → value. -->
                  <template v-else>
                  <div v-if="cond.field" class="dd-rule__select">
                    <DropdownSelect
                      :model-value="cond.operator"
                      :options="SIMPLE_OPERATORS.map((o) => ({ value: o.value, label: o.label }))"
                      :aria-label="`Operator for rule ${ci + 1} in ${groupDisplayName(gi)}`"
                      @update:model-value="(v) => onOperatorValue(gi, bi, ci, v)"
                    />
                  </div>

                  <!-- Value control(s) -->
                  <template v-if="cond.field && cond.operator">
                    <template v-if="cond.operator === 'between'">
                      <input
                        :value="cond.values[0] ?? ''"
                        :type="inputTypeFor(cond.field)"
                        class="dd-value-input"
                        :placeholder="placeholderFor(cond.field, 'min')"
                        :aria-label="`Lower bound for ${fieldLabelFor(cond.field)}`"
                        @input="(e) => onValueAt(gi, bi, ci, 0, (e.target as HTMLInputElement).value)"
                      />
                      <span class="dd-rule__and" aria-hidden="true">and</span>
                      <input
                        :value="cond.values[1] ?? ''"
                        :type="inputTypeFor(cond.field)"
                        class="dd-value-input"
                        :placeholder="placeholderFor(cond.field, 'max')"
                        :aria-label="`Upper bound for ${fieldLabelFor(cond.field)}`"
                        @input="(e) => onValueAt(gi, bi, ci, 1, (e.target as HTMLInputElement).value)"
                      />
                    </template>
                    <template v-else-if="fieldEnumFor(cond.field)">
                      <DropdownSelect
                        :model-value="cond.values[0] ?? ''"
                        :options="(fieldEnumFor(cond.field) || []).map((opt) => ({ value: opt, label: opt }))"
                        :aria-label="`Value for ${fieldLabelFor(cond.field)}`"
                        @update:model-value="(v) => onSingleValueValue(gi, bi, ci, v)"
                      />
                    </template>
                    <template v-else>
                      <span
                        v-if="inputTypeFor(cond.field) === 'number'"
                        class="dd-value-input-wrap"
                      >
                        <span
                          v-if="fieldUnitFor(cond.field) === 'currency'"
                          class="dd-value-input-prefix"
                          aria-hidden="true"
                        >$</span>
                        <input
                          :value="cond.values[0] ?? ''"
                          type="number"
                          class="dd-value-input"
                          :class="{
                            'dd-value-input--currency':
                              fieldUnitFor(cond.field) === 'currency',
                          }"
                          :placeholder="placeholderFor(cond.field)"
                          :aria-label="`Value for ${fieldLabelFor(cond.field)}${fieldUnitFor(cond.field) === 'currency' ? ' in US dollars' : ''}`"
                          @input="(e) => onValueAt(gi, bi, ci, 0, (e.target as HTMLInputElement).value)"
                        />
                      </span>
                      <input
                        v-else
                        :value="cond.values[0] ?? ''"
                        :type="inputTypeFor(cond.field)"
                        class="dd-value-input"
                        :placeholder="placeholderFor(cond.field)"
                        :aria-label="`Value for ${fieldLabelFor(cond.field)}`"
                        @input="(e) => onValueAt(gi, bi, ci, 0, (e.target as HTMLInputElement).value)"
                      />
                    </template>
                  </template>
                  </template>
                  <!-- End deal-row variant -->

                  <div class="dd-rule__actions">
                    <button
                      type="button"
                      class="dd-rule__action-btn"
                      :aria-label="`Duplicate condition ${ci + 1} in rule ${bi + 1}`"
                      title="Duplicate"
                      @click="duplicateCondition(gi, bi, ci)"
                    >
                      <DexIcon name="copy" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      class="dd-rule__action-btn"
                      :aria-label="`Delete condition ${ci + 1} in rule ${bi + 1}`"
                      title="Delete"
                      @click="removeCondition(gi, bi, ci)"
                    >
                      <DexIcon name="trash-2" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                  <button
                    type="button"
                    class="dd-and-btn"
                    @click="addAndCondition(gi, bi)"
                  >
                    <span aria-hidden="true">+</span> And
                  </button>
                </div>

                <div
                  v-if="bi < group.blocks.length - 1"
                  class="dd-or-divider"
                  aria-hidden="true"
                >
                  <span class="dd-or-divider__chip">Or</span>
                  <span class="dd-or-divider__line" />
                </div>
              </template>

              <!-- Bottom Or divider — only meaningful once there's a
                   configured rule above to OR against. Hidden while
                   the user is still picking the first input. -->
              <div
                v-if="hasConfiguredRules(group)"
                class="dd-or-divider dd-or-divider--bottom"
                aria-hidden="true"
              >
                <span class="dd-or-divider__chip">Or</span>
                <span class="dd-or-divider__line" />
              </div>

              <!-- + Add a rule appears in two states:
                   (a) the sequence is empty — primary CTA to create the
                       first block.
                   (b) at least one configured rule exists — the new
                       block becomes an OR-joined alternative.
                   Hidden in the intermediate state (block exists but no
                   field yet) so the user finishes the in-progress row
                   before stacking more. -->
              <button
                v-if="group.blocks.length === 0 || hasConfiguredRules(group)"
                type="button"
                class="dd-add-rule"
                :aria-label="`Add a rule to ${groupDisplayName(gi)}`"
                @click="addBlock(gi)"
              >
                <span class="dd-add-rule__plus" aria-hidden="true">+</span>
                Add a rule
              </button>

              <div
                v-if="!hasRules(group)"
                class="dd-info-banner"
                role="note"
              >
                <DexIcon name="alert-circle" aria-hidden="true" />
                <span>
                  If no rules are added here, everything from the previous
                  sequence will be allowed through.
                </span>
              </div>
            </div>
          </section>

            <!-- Drop indicator below the last card (only when target is the last) -->
            <div
              v-if="
                dragOverIdx === gi &&
                dragOverPos === 'after' &&
                gi === config.groups.length - 1
              "
              class="dd-drop-indicator"
              aria-hidden="true"
            />
          </template>

          <div class="dd-add-sequence-row">
            <DexButton variant="outline" @click="addSequence">
              <span aria-hidden="true" class="dd-add-sequence-plus">+</span>
              Add a new rules set for Sequence {{ config.groups.length + 1 }}
            </DexButton>
          </div>

          <section class="dd-default" aria-labelledby="dd-default-label">
            <DexText
              id="dd-default-label"
              variant="body-2"
              class="dd-default__label"
            >
              If nothing matches, where should it go?
            </DexText>
            <div class="dd-default__select">
              <label
                :for="defaultRoutingId"
                class="dd-default__select-label"
              >
                Select a default
              </label>
              <select
                :id="defaultRoutingId"
                class="dd-select dd-default__control"
                :value="config.defaultRouting"
                @change="onDefaultRouting"
              >
                <option
                  v-for="opt in defaultRoutingOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </section>
        </main>
      </div>
    </div>

    <!-- Test modal — opens from the header Test button. Sits inside
         the editor overlay so its z-index stack stays above the
         editor's own UI without leaking into the canvas behind. -->
    <TestDiamondModal
      v-if="testModalOpen"
      :config="props.config"
      @close="testModalOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';
import {
  DexIconButton,
  DexIcon,
  DexText,
  DexButton,
  DexSwitch,
  DexDropdownMenu,
  DexDropdownMenuItem,
  DexInlineAlert,
} from '@thryvlabs/dex-vue';
import type { EntityId } from '../../decisionDiamond/entities';
import type {
  DDBlock,
  DDCondition,
  DecisionDiamondConfig,
} from '../../decisionDiamond/types';
import { uid } from '../../decisionDiamond/types';
import {
  STANDARD_CONTACT_FIELDS,
  CONSTANT_CONTACT_FIELDS,
  CUSTOM_CONTACT_FIELDS,
  TAGS_ATTRIBUTE,
  attributesForCategory,
  getContactAttribute,
  operatorsForAttribute,
  defaultOperatorForType,
  categoryLabel,
  describeContactCondition,
  type ContactCategory,
  type ContactAttribute,
  type ContactOperator,
} from '../../decisionDiamond/contactAttributes';
import DropdownSelect from './DropdownSelect.vue';
import TestDiamondModal from './TestDiamondModal.vue';
import {
  TRIGGER_FIELDS,
  isKnownTriggerSlug,
  getTriggerField,
  type TriggerField,
} from '../../decisionDiamond/triggerAttributes';
import {
  TRIGGER_SUGGESTIONS,
  TRIGGER_SMART_PILLS,
} from '../../decisionDiamond/triggerSuggestions';
import { streamChat, AI_TRANSPORT } from '../../lib/ai/aiClient';
import type {
  MessageParam as AiMessageParam,
  ToolUseBlock as AiToolUseBlock,
} from '../../lib/ai/aiTypes';

// ===================================================================
// Props / emits
// ===================================================================

const props = defineProps<{
  config: DecisionDiamondConfig;
  relevantEntities: Set<EntityId>;
  /** Slug of the closest upstream trigger node (e.g.
   *  `'product-is-purchased'`, `'quote-status'`,
   *  `'pipeline-stage-is-moved'`, `'appointments'`). When set to a
   *  schema we know about, the field dropdown is scoped to that
   *  trigger's attributes per the Confluence reference. Falls back to
   *  the default Deal field set when null/unknown. */
  triggerSlug?: string | null;
}>();

const emit = defineEmits<{
  'update:config': [next: DecisionDiamondConfig];
  close: [];
  /** Save commits the current config AND tells the parent to reconcile
   *  the diamond's outgoing edges so the canvas shows one branch per
   *  sequence configured here. Parent closes the editor after sync. */
  save: [];
}>();

// ===================================================================
// Simplified field/operator catalogs (match screenshot 4)
// ===================================================================

type SimpleFieldId = 'dealValue' | 'dealCompletionTime' | 'dealStage' | 'dealExpirationTime';

type SimpleField = {
  id: SimpleFieldId;
  label: string;
  inputType: 'number' | 'date' | 'enum';
  unit?: 'currency';
  enum?: string[];
};

const SIMPLE_FIELDS: SimpleField[] = [
  { id: 'dealValue', label: 'Deal value', inputType: 'number', unit: 'currency' },
  { id: 'dealCompletionTime', label: 'Deal completion time', inputType: 'date' },
  {
    id: 'dealStage',
    label: 'Deal stage',
    inputType: 'enum',
    enum: ['New', 'Qualified', 'Estimate Sent', 'Scheduled', 'Won', 'Lost'],
  },
  { id: 'dealExpirationTime', label: 'Deal expiration time', inputType: 'date' },
];

const SIMPLE_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'exceeds', label: 'Exceeds' },
  { value: 'lessThan', label: 'Less than' },
  { value: 'between', label: 'Between' },
];

function fieldDef(id: string): SimpleField | undefined {
  // Try deal fields first (back-compat), then trigger-scoped fields.
  // Trigger fields share the same `{id, label, inputType, enum, unit}`
  // shape so the downstream helpers (label / enum / input type /
  // placeholder) work uniformly without a separate code path.
  const deal = SIMPLE_FIELDS.find((f) => f.id === id);
  if (deal) return deal;
  return getTriggerField(id) as SimpleField | undefined;
}
function fieldLabelFor(id: string): string {
  return fieldDef(id)?.label ?? 'value';
}
function inputTypeFor(id: string): string {
  const f = fieldDef(id);
  if (!f) return 'text';
  if (f.inputType === 'enum') return 'text';
  return f.inputType === 'number' ? 'number' : 'date';
}
function fieldUnitFor(id: string): string | undefined {
  return fieldDef(id)?.unit;
}
function fieldEnumFor(id: string): string[] | undefined {
  return fieldDef(id)?.enum;
}
function placeholderFor(id: string, qualifier?: 'min' | 'max'): string {
  const f = fieldDef(id);
  if (!f) return 'Value';
  if (f.unit === 'currency') {
    return qualifier === 'min'
      ? '0'
      : qualifier === 'max'
        ? '0'
        : 'Amount';
  }
  if (f.inputType === 'date') return 'YYYY-MM-DD';
  return 'Value';
}

// ===================================================================
// AI assistant state
// ===================================================================

// Default to off in empty state — matches the "not yet configured" surface.
const aiOpen = ref(false);

/** Test modal open state — drives the dialog that lets users probe
 *  their saved diamond logic with sample inputs (see TestDiamondModal). */
const testModalOpen = ref(false);
const composerText = ref('');
const transcriptEl = ref<HTMLElement | null>(null);
const rootEl = ref<HTMLElement | null>(null);
const closeButtonEl = ref<{ $el?: HTMLElement } | HTMLElement | null>(null);
const isThinking = ref(false);
const isComposing = ref(false); // transition phase between thinking + posting
const previouslyFocused = ref<HTMLElement | null>(null);

// ===================================================================
// Resizable AI / rules split
// ===================================================================

const bodyEl = ref<HTMLElement | null>(null);
const resizerEl = ref<HTMLElement | null>(null);
const aiWidth = ref(420);
const isResizing = ref(false);
const containerWidth = ref<number>(
  typeof window !== 'undefined' ? window.innerWidth : 1280,
);

const MIN_AI_WIDTH = 300;
const RESIZER_WIDTH = 6;
const MIN_RULES_WIDTH = 360;
const DEFAULT_AI_WIDTH = 420;

const maxAiWidth = computed(() =>
  Math.max(
    MIN_AI_WIDTH,
    containerWidth.value - RESIZER_WIDTH - MIN_RULES_WIDTH,
  ),
);

const bodyGridStyle = computed(() => ({
  gridTemplateColumns: `${clampAiWidth(aiWidth.value)}px ${RESIZER_WIDTH}px 1fr`,
}));

function clampAiWidth(v: number) {
  return Math.max(MIN_AI_WIDTH, Math.min(maxAiWidth.value, v));
}

function setAiWidth(v: number) {
  aiWidth.value = clampAiWidth(v);
}

function resetAiWidth() {
  setAiWidth(DEFAULT_AI_WIDTH);
}

function startResize(e: MouseEvent) {
  e.preventDefault();
  beginDrag(e.clientX);
}

function startResizeTouch(e: TouchEvent) {
  const t = e.touches[0];
  if (!t) return;
  beginDrag(t.clientX);
}

function beginDrag(startX: number) {
  isResizing.value = true;
  const startWidth = clampAiWidth(aiWidth.value);
  const prevCursor = document.body.style.cursor;
  const prevSelect = document.body.style.userSelect;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  const onMove = (clientX: number) => {
    setAiWidth(startWidth + (clientX - startX));
  };
  const onMouseMove = (ev: MouseEvent) => onMove(ev.clientX);
  const onTouchMove = (ev: TouchEvent) => {
    const t = ev.touches[0];
    if (t) onMove(t.clientX);
  };
  const stop = () => {
    isResizing.value = false;
    document.body.style.cursor = prevCursor;
    document.body.style.userSelect = prevSelect;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', stop);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', stop);
    document.removeEventListener('touchcancel', stop);
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', stop);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', stop);
  document.addEventListener('touchcancel', stop);
}

function onResizerKey(e: KeyboardEvent) {
  const STEP = e.shiftKey ? 48 : 16;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    setAiWidth(aiWidth.value - STEP);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    setAiWidth(aiWidth.value + STEP);
  } else if (e.key === 'Home') {
    e.preventDefault();
    setAiWidth(MIN_AI_WIDTH);
  } else if (e.key === 'End') {
    e.preventDefault();
    setAiWidth(maxAiWidth.value);
  }
}

let resizeObserver: ResizeObserver | undefined;

function trackContainerWidth() {
  if (typeof window === 'undefined' || !bodyEl.value) return;
  containerWidth.value = bodyEl.value.getBoundingClientRect().width;
  // Re-clamp current width against new viewport
  setAiWidth(aiWidth.value);
}

// Stable ids for label/aria associations
let idCounter = 0;
const nextId = () => `dd-ed-${++idCounter}-${Math.random().toString(36).slice(2, 8)}`;
const aiSwitchId = nextId();
const composerInputId = nextId();
const defaultRoutingId = nextId();

type BranchStep = {
  /** Branch label, e.g. "High-value branch" */
  title: string;
  /** The decision rule that gets configured on this screen. */
  decision: string;
  /** Optional non-binding suggestion for what to put in the downstream sequence — NOT configured here. */
  suggestedNext?: string;
};

type AssistantMessage = {
  role: 'assistant';
  kind: 'template';
  suggestionId: string;
  title: string;
  lead: string;
  whenTitle: string;
  whenBody: string;
  thenSteps: BranchStep[];
};

type AssistantNote = {
  role: 'assistant';
  kind: 'note';
  text: string;
};

type UserMessage = { role: 'user'; text: string };

type TranscriptItem = AssistantMessage | AssistantNote | UserMessage;

const transcript = ref<TranscriptItem[]>([]);
/** Set while the editor itself is mutating config (e.g. applying a
 *  suggestion). Used to skip feedback for our own writes. */
const isInternalMutation = ref(false);

// ===================================================================
// Suggestion catalog — reasonable if/else flows for "Deal stage moved"
// ===================================================================

type Suggestion = {
  id: string;
  title: string;
  category: 'Deal value' | 'Deal stage' | 'Timing';
  description: string;
  message: Omit<AssistantMessage, 'role' | 'suggestionId'>;
  rules: { sequenceIndex: number; field: SimpleFieldId; operator: string; values: string[] }[];
};

const SUGGESTIONS: Suggestion[] = [
  {
    id: 'dealValueEvaluation',
    title: 'Deal value evaluation',
    category: 'Deal value',
    description: 'Split high-value deals from standard so they get a personal touch.',
    message: {
      title: 'Deal value evaluation',
      lead: 'Branch the flow on whether the deal exceeds your high-value threshold so high deals get a personal touch and the rest stay in the standard cadence.',
      whenTitle: 'When a deal stage is moved',
      whenBody:
        'This starts the automation any time a deal advances to a new pipeline stage.',
      thenSteps: [
        {
          title: 'High-value branch',
          decision: 'If Deal value exceeds $5,000 → Sequence 1.',
          suggestedNext:
            'A high-touch follow-up cadence with an owner notification.',
        },
        {
          title: 'Standard branch',
          decision:
            'If Deal value is less than or equal to $5,000 → Sequence 2.',
          suggestedNext:
            'A standard nurture cadence with a check-in email around day 3.',
        },
      ],
    },
    rules: [
      { sequenceIndex: 0, field: 'dealValue', operator: 'exceeds', values: ['5000'] },
      { sequenceIndex: 1, field: 'dealValue', operator: 'lessThan', values: ['5000'] },
    ],
  },
  {
    id: 'dealCompletionDate',
    title: 'Deal completion date',
    category: 'Timing',
    description: 'Branch fresh closes from older ones — thank-you vs re-engagement.',
    message: {
      title: 'Deal completion date',
      lead: 'Split contacts based on how recently their deal closed so fresh customers get a thank-you and older ones get a re-engagement.',
      whenTitle: 'When a deal stage is moved',
      whenBody:
        'This evaluates the deal each time its stage changes and checks the completion date.',
      thenSteps: [
        {
          title: 'Recently completed branch',
          decision:
            'If Deal completion time is within the last 7 days → Sequence 1.',
          suggestedNext: 'A thank-you email and a review request.',
        },
        {
          title: 'Older deal branch',
          decision:
            'If Deal completion time is at least 30 days old → Sequence 2.',
          suggestedNext: 'A re-engagement cadence with a renewal offer.',
        },
      ],
    },
    rules: [
      {
        sequenceIndex: 0,
        field: 'dealCompletionTime',
        operator: 'between',
        values: [daysAgoIso(7), todayIso()],
      },
      {
        sequenceIndex: 1,
        field: 'dealCompletionTime',
        operator: 'lessThan',
        values: [daysAgoIso(30)],
      },
    ],
  },
  {
    id: 'dealPaymentFailed',
    title: 'Deal payment failed',
    category: 'Deal stage',
    description: 'Catch lost deals into a recovery flow, keep won deals on the success track.',
    message: {
      title: 'Deal payment failed',
      lead: 'Catch lost deals and route them into a recovery flow while keeping won deals on the success track.',
      whenTitle: 'When a deal stage is moved',
      whenBody:
        'Triggers when the deal stage transitions, then checks the resulting stage.',
      thenSteps: [
        {
          title: 'Lost / failed branch',
          decision: 'If Deal stage equals Lost → Sequence 1.',
          suggestedNext:
            'A payment-recovery email plus a follow-up task for the owner.',
        },
        {
          title: 'Won branch',
          decision: 'If Deal stage equals Won → Sequence 2.',
          suggestedNext: 'Fulfillment trigger plus post-purchase onboarding.',
        },
      ],
    },
    rules: [
      { sequenceIndex: 0, field: 'dealStage', operator: 'equals', values: ['Lost'] },
      { sequenceIndex: 1, field: 'dealStage', operator: 'equals', values: ['Won'] },
    ],
  },
  {
    id: 'highValueRouting',
    title: 'High-value routing',
    category: 'Deal value',
    description: 'Tier deals into enterprise vs. SMB cadences.',
    message: {
      title: 'High-value routing',
      lead: 'Route enterprise-sized deals to the high-touch sequence; everything else to the SMB cadence.',
      whenTitle: 'When a deal stage is moved',
      whenBody: 'Re-evaluates the deal each time its pipeline stage advances.',
      thenSteps: [
        {
          title: 'Enterprise branch',
          decision: 'If Deal value exceeds $25,000 → Sequence 1.',
          suggestedNext:
            'Assignment to an account executive plus a high-touch nurture.',
        },
        {
          title: 'SMB branch',
          decision: 'Otherwise → Sequence 2.',
          suggestedNext:
            'A standard SMB nurture with weekly check-ins.',
        },
      ],
    },
    rules: [
      { sequenceIndex: 0, field: 'dealValue', operator: 'exceeds', values: ['25000'] },
      { sequenceIndex: 1, field: 'dealValue', operator: 'lessThan', values: ['25000'] },
    ],
  },
  {
    id: 'wonOnboarding',
    title: 'Won deal → onboarding',
    category: 'Deal stage',
    description: 'Branch newly-won deals into onboarding vs. everything else.',
    message: {
      title: 'Won deal → onboarding',
      lead: 'When a deal becomes Won, push it straight into onboarding; otherwise keep nurturing.',
      whenTitle: 'When a deal stage is moved',
      whenBody: 'Triggers each time the pipeline stage transitions.',
      thenSteps: [
        {
          title: 'Won branch',
          decision: 'If Deal stage equals Won → Sequence 1.',
          suggestedNext:
            'Onboarding kickoff plus a follow-up task for the owner.',
        },
      ],
    },
    rules: [
      { sequenceIndex: 0, field: 'dealStage', operator: 'equals', values: ['Won'] },
    ],
  },
  {
    id: 'estimateExpiring',
    title: 'Estimate expiring soon',
    category: 'Timing',
    description: 'Catch estimates getting close to expiration with a follow-up.',
    message: {
      title: 'Estimate expiring soon',
      lead: "Find deals whose estimate is about to expire and send a nudge before it does.",
      whenTitle: 'When a deal stage is moved',
      whenBody: 'Re-checks the estimate expiration each time the stage changes.',
      thenSteps: [
        {
          title: 'Expiring branch',
          decision:
            'If Deal expiration time is within the next 3 days → Sequence 1.',
          suggestedNext: 'An "estimate expiring" reminder email.',
        },
      ],
    },
    rules: [
      {
        sequenceIndex: 0,
        field: 'dealExpirationTime',
        operator: 'between',
        values: [todayIso(), daysFromNowIso(3)],
      },
    ],
  },
  {
    id: 'lostRecovery',
    title: 'Lost deal recovery',
    category: 'Deal stage',
    description: 'Route lost deals into a win-back sequence.',
    message: {
      title: 'Lost deal recovery',
      lead: 'Pick up lost deals and try to win them back with a tailored offer.',
      whenTitle: 'When a deal stage is moved',
      whenBody: 'Triggers when the deal advances or regresses through pipeline stages.',
      thenSteps: [
        {
          title: 'Lost branch',
          decision: 'If Deal stage equals Lost → Sequence 1.',
          suggestedNext: 'A win-back email with a discount code.',
        },
      ],
    },
    rules: [
      { sequenceIndex: 0, field: 'dealStage', operator: 'equals', values: ['Lost'] },
    ],
  },
];

const appliedSuggestionIds = computed(
  () =>
    new Set(
      transcript.value
        .filter(
          (m): m is AssistantMessage =>
            m.role === 'assistant' && (m as AssistantMessage).kind === 'template',
        )
        .map((m) => m.suggestionId),
    ),
);

/** The set of starter-template suggestions active for this diamond.
 *  When the upstream trigger is one of the four supported entities
 *  (Product / Quote / Pipeline / Appointment), surface CRM-relevant
 *  templates scoped to that trigger's attributes. Otherwise fall back
 *  to the legacy deal-field suggestions so existing flows keep
 *  working. */
const activeSuggestionList = computed(() => {
  if (props.triggerSlug && isKnownTriggerSlug(props.triggerSlug)) {
    // Trigger-scoped suggestions have the same Suggestion shape so
    // they slot into the existing apply pipeline without changes.
    return TRIGGER_SUGGESTIONS[props.triggerSlug] as unknown as Suggestion[];
  }
  return SUGGESTIONS;
});

const availableSuggestions = computed(() =>
  activeSuggestionList.value.filter(
    (s) => !appliedSuggestionIds.value.has(s.id),
  ),
);

/** Inline chips: keep to 2 to respect Hick's Law; rest live behind "Browse all". */
const INLINE_SUGGESTION_LIMIT = 2;
const inlineSuggestions = computed(() =>
  availableSuggestions.value.slice(0, INLINE_SUGGESTION_LIMIT),
);

// ===================================================================
// Templates popover
// ===================================================================

const templatesOpen = ref(false);
const templatesQuery = ref('');
const templatesPanelEl = ref<HTMLElement | null>(null);
const browseAllBtnEl = ref<HTMLElement | null>(null);

const groupedTemplates = computed(() => {
  const q = templatesQuery.value.trim().toLowerCase();
  const filtered = activeSuggestionList.value.filter((s) => {
    if (!q) return true;
    return (
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  });
  const buckets: Record<string, Suggestion[]> = {};
  for (const s of filtered) {
    (buckets[s.category] ??= []).push(s);
  }
  return Object.entries(buckets).map(([category, items]) => ({
    category,
    items,
  }));
});

function openTemplates() {
  templatesOpen.value = true;
  templatesQuery.value = '';
  void nextTick(() => {
    templatesPanelEl.value
      ?.querySelector<HTMLInputElement>('input[type="search"]')
      ?.focus();
  });
}
function closeTemplates() {
  templatesOpen.value = false;
}
function pickTemplate(id: string) {
  applySuggestion(id);
  closeTemplates();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function daysFromNowIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ===================================================================
// Condition recipes (single-field building blocks for + And / + Or)
// ===================================================================

type ConditionRecipe = {
  id: string;
  label: string;
  /** Generic string so trigger-scoped fields (e.g. `appointment.event`,
   *  `pipeline.stage`) can flow through the same recipe pipeline as
   *  legacy Deal fields. The editor's renderers already resolve any
   *  field id via the schema lookups in `triggerAttributes.ts`. */
  field: string;
  operator: string;
  values: string[];
};

const CONDITION_RECIPES: ConditionRecipe[] = [
  {
    id: 'stage-qualified',
    label: 'Deal stage = Qualified',
    field: 'dealStage',
    operator: 'equals',
    values: ['Qualified'],
  },
  {
    id: 'stage-won',
    label: 'Deal stage = Won',
    field: 'dealStage',
    operator: 'equals',
    values: ['Won'],
  },
  {
    id: 'value-large',
    label: 'Deal value > $10,000',
    field: 'dealValue',
    operator: 'exceeds',
    values: ['10000'],
  },
  {
    id: 'value-small',
    label: 'Deal value < $1,000',
    field: 'dealValue',
    operator: 'lessThan',
    values: ['1000'],
  },
  {
    id: 'closed-recent',
    label: 'Closed in the last 30 days',
    field: 'dealCompletionTime',
    operator: 'between',
    values: [daysAgoIso(30), todayIso()],
  },
  {
    id: 'expiring-soon',
    label: 'Expires within 7 days',
    field: 'dealExpirationTime',
    operator: 'between',
    values: [todayIso(), daysFromNowIso(7)],
  },
];

/** Pick up to 3 recipes whose field isn't already used by the sequence.
 *  Trigger-aware: when the diamond is downstream of one of the four
 *  supported triggers (Product / Quote / Pipeline / Appointment), the
 *  recipe pool is sourced from that trigger's `TRIGGER_SMART_PILLS` so
 *  the assistant never offers a Deal field for an Appointment-scoped
 *  diamond. Falls back to the legacy Deal recipes when no trigger is
 *  upstream. */
function recipesForSequence(gi: number): ConditionRecipe[] {
  const used = collectFieldsInUse(props.config.groups[gi]);
  let pool: ConditionRecipe[];
  if (props.triggerSlug && isKnownTriggerSlug(props.triggerSlug)) {
    pool = TRIGGER_SMART_PILLS[props.triggerSlug].map((p) => ({
      id: `${p.field}-${p.values.join('-')}`,
      label: p.label,
      field: p.field,
      operator: p.operator,
      values: [...p.values],
    }));
  } else {
    pool = CONDITION_RECIPES;
  }
  // Legacy Deal pool has unique fields per recipe, so a field-only
  // filter is correct. Trigger pools may reuse a field across multiple
  // value variants (e.g. `Appointment event = Schedules` and
  // `Appointment event = Cancels`), so they need the broader
  // field-only filter to NOT suppress sibling values — only filter out
  // the exact (field, values) pair that's already configured. We track
  // both keys.
  const usedFieldsAndValues = new Set<string>();
  const group = props.config.groups[gi];
  if (group) {
    for (const b of group.blocks) {
      for (const c of b.conditions) {
        if (c.field) {
          usedFieldsAndValues.add(`${c.field}::${JSON.stringify(c.values)}`);
        }
      }
    }
  }
  return pool
    .filter((r) => {
      const exactKey = `${r.field}::${JSON.stringify(r.values)}`;
      if (usedFieldsAndValues.has(exactKey)) return false;
      // Legacy Deal pool: also suppress whole field if already used.
      if (pool === CONDITION_RECIPES && used.has(r.field)) return false;
      return true;
    })
    .slice(0, 3);
}

// ===================================================================
// Suggestion → preview population
// ===================================================================

function applySuggestion(
  suggestionId: string,
  options: { skipUserMessage?: boolean } = {},
) {
  const s =
    activeSuggestionList.value.find((x) => x.id === suggestionId) ??
    SUGGESTIONS.find((x) => x.id === suggestionId);
  if (!s) return;

  // Treat a suggestion-tap as if the user typed it into chat, so the
  // assistant's reply has a corresponding user turn.
  if (!options.skipUserMessage) {
    postUser(`Use the "${s.title}" template`);
  }

  // Number of sequence cards this suggestion actually populates.
  // A single-branch template (e.g. "Won → onboarding") only needs one card.
  const requiredGroups = Math.max(
    ...s.rules.map((r) => r.sequenceIndex + 1),
    1,
  );

  isInternalMutation.value = true;
  ensureGroups(requiredGroups);

  // Phase 1 — "thinking": spinning diamond. Jittered duration so two
  // back-to-back applies don't feel identical.
  isThinking.value = true;
  scrollTranscriptToBottom();

  window.setTimeout(() => {
    // Phase 2 — "composing": diamond pulses + skeleton lines shimmer
    // in the transcript while the response is "being written".
    isThinking.value = false;
    isComposing.value = true;
    scrollTranscriptToBottom();

    window.setTimeout(() => {
      // Phase 3 — commit + post the message.
      const next = cloneConfig();
      if (next.groups.length > requiredGroups) {
        next.groups = next.groups.slice(0, requiredGroups);
      }
      for (const r of s.rules) {
        const group = next.groups[r.sequenceIndex];
        if (!group) continue;
        const conditions = [
          {
            id: uid('c'),
            subject: '',
            category: '',
            field: r.field,
            operator: r.operator,
            values: [...r.values],
          },
        ];
        // Trigger-aware suggestions may carry extra AND-conditions in
        // `additional` (e.g. `Direction equals Into AND Stage equals X`).
        // Legacy SUGGESTIONS don't use this field — undefined is fine.
        const extra = (r as { additional?: Array<{ field: string; operator: string; values: string[] }> }).additional;
        if (extra && extra.length > 0) {
          for (const a of extra) {
            conditions.push({
              id: uid('c'),
              subject: '',
              category: '',
              field: a.field,
              operator: a.operator,
              values: [...a.values],
            });
          }
        }
        group.blocks = [
          {
            id: uid('b'),
            conditions,
          },
        ];
      }
      const validValues = new Set<string>([
        '__drop__',
        ...next.groups.map((g, i) => g.targetFlowId || `__seq-${i}__`),
      ]);
      if (!validValues.has(next.defaultRouting)) {
        next.defaultRouting = '__drop__';
      }

      emit('update:config', next);
      transcript.value = [
        ...transcript.value,
        {
          role: 'assistant',
          kind: 'template',
          suggestionId: s.id,
          ...s.message,
        },
      ];
      isComposing.value = false;
      scrollTranscriptToBottom();
      window.setTimeout(() => {
        isInternalMutation.value = false;
      }, FEEDBACK_DEBOUNCE_MS + 50);
    }, withJitter(AI_TRANSITION_MS));
  }, withJitter(AI_THINKING_MS));
}

/** Reset just the chat transcript (rules on the right are preserved). */
function confirmNewChat() {
  if (transcript.value.length === 0) return;
  if (
    window.confirm(
      'Start a new conversation? Your conversation history will be cleared. The rules on the right will be kept.',
    )
  ) {
    transcript.value = [];
  }
}

/** Quick-reply contextual actions that follow each assistant message.
 *  Hidden while the AI is mid-generation (thinking OR composing). */
const showQuickReplies = computed(() => {
  if (isThinking.value || isComposing.value) return false;
  const last = transcript.value[transcript.value.length - 1];
  return last && last.role === 'assistant';
});

/** True when the transcript contains at least one assistant message. */
const hasAssistantTurn = computed(() =>
  transcript.value.some((m) => m.role === 'assistant'),
);

type QuickReplyKind = 'edit' | 'template';
type QuickReply = {
  id: string;
  label: string;
  kind: QuickReplyKind;
  action: () => void;
};

type QuickReplySection = {
  id: string;
  title: string;
  replies: QuickReply[];
};

/**
 * Pill hierarchy. Earlier branches return EXCLUSIVELY when active so the
 * user is never shown more than 3 pills at once (per spec B7 hard cap).
 *
 *   1. Pending sequence disambiguation (B1)   — must answer first
 *   2. Pending smart-pill question (B7)       — must answer first
 *   3. Pending fill-slot recipe picker        — existing
 *   4. Pending mirror offer                   — existing
 *   5. Continuation pills (B2) — after a successful mutation
 *   6. Generic per-sequence add pills         — existing fallback
 */
const quickReplySections = computed<QuickReplySection[]>(() => {
  // B1: Sequence disambiguation — exclusive section
  if (pendingSequenceChoice.value) {
    const choice = pendingSequenceChoice.value;
    const visible = choice.candidateIndexes.slice(0, 2);
    const replies: QuickReply[] = visible.map((i) => {
      const g = props.config.groups[i];
      const hasRules = g?.blocks.some((b) => b.conditions.length > 0);
      return {
        id: `disambig-seq-${i}`,
        label: `Sequence ${i + 1}${hasRules ? '' : ': empty'}`,
        kind: 'edit' as const,
        action: () => {
          const r = pendingSequenceChoice.value?.resolve;
          pendingSequenceChoice.value = null;
          if (r) void r(i);
        },
      };
    });
    replies.push({
      id: 'disambig-new',
      label: '+ New sequence',
      kind: 'edit',
      action: () => {
        const r = pendingSequenceChoice.value?.resolveNew;
        pendingSequenceChoice.value = null;
        if (r) void r();
      },
    });
    return [{ id: 'disambig', title: 'Which sequence?', replies: replies.slice(0, 3) }];
  }

  // B7: Smart-pill suggestions — exclusive section
  if (pendingSmartPills.value) {
    const sp = pendingSmartPills.value;
    const candidates = pickSmartConditionPills(sp.sequenceIndex);
    const replies: QuickReply[] = candidates.map((c) => ({
      id: `smart-${c.field}`,
      label: c.label,
      kind: 'edit' as const,
      action: () => applySmartPill(c, sp.sequenceIndex, sp.joinAs),
    }));
    if (replies.length === 0) {
      pendingSmartPills.value = null;
      return [];
    }
    return [{ id: 'smart', title: 'Next condition', replies: replies.slice(0, 3) }];
  }

  const sections: QuickReplySection[] = [];

  // ---------- Step deeper: pick a recipe for the just-opened slot ----------
  if (pendingFillSlot.value) {
    const slot = pendingFillSlot.value;
    const recipes = recipesForSequence(slot.gi);
    if (recipes.length > 0) {
      sections.push({
        id: 'fill-recipe',
        title: `Choose a condition for Sequence ${slot.gi + 1}`,
        replies: recipes.map((r) => ({
          id: `recipe-${r.id}`,
          label: r.label,
          kind: 'edit',
          action: () => applyRecipe(r),
        })),
      });
    }
  }

  // ---------- Step deeper: mirror the just-applied recipe ----------
  if (mirrorOffer.value) {
    const { recipe, targetGis } = mirrorOffer.value;
    sections.push({
      id: 'mirror',
      title: `Apply "${recipe.label}" to other sequences?`,
      replies: [
        ...targetGis.map((gi) => ({
          id: `mirror-${gi}`,
          label: `Yes, apply to Sequence ${gi + 1}`,
          kind: 'edit' as const,
          action: () => mirrorRecipeTo(gi),
        })),
        {
          id: 'mirror-no',
          label: 'No thanks',
          kind: 'template',
          action: dismissMirrorOffer,
        },
      ],
    });
  }

  // ---------- B2: Continuation pills (context-specific, max 3) ----------
  // Surface after every successful mutation. Cleared when the user sends
  // a new message OR clicks "Done". Replaces the generic per-sequence
  // pills when active so the user is never shown more than 3 at once.
  if (continuationContext.value) {
    const ctx = continuationContext.value;
    const replies: QuickReply[] = [];

    switch (ctx.kind) {
      case 'added-condition': {
        const idx = ctx.sequenceIndex;
        replies.push({
          id: `cont-and-${idx}`,
          label: '+ Add another condition (AND)',
          kind: 'edit',
          action: () => offerSmartPills(idx, 'and'),
        });
        replies.push({
          id: `cont-or-${idx}`,
          label: '+ Add an OR rule group',
          kind: 'edit',
          action: () => offerSmartPills(idx, 'or'),
        });
        break;
      }
      case 'added-sequence': {
        const idx = ctx.sequenceIndex;
        replies.push({
          id: `cont-rule-${idx}`,
          label: '+ Add a rule to this sequence',
          kind: 'edit',
          action: () => offerSmartPills(idx, 'and'),
        });
        replies.push({
          id: 'cont-new-seq',
          label: '+ Create another sequence',
          kind: 'edit',
          action: () => {
            addSequence();
            const newIdx = props.config.groups.length - 1;
            flashSequenceCard(newIdx);
            markMutation(
              { kind: 'added-sequence', sequenceIndex: newIdx },
              { createdSequence: newIdx },
            );
          },
        });
        break;
      }
      case 'cleared-sequence': {
        const idx = ctx.sequenceIndex;
        replies.push({
          id: `cont-fresh-${idx}`,
          label: '+ Add fresh rules',
          kind: 'edit',
          action: () => offerSmartPills(idx, 'and'),
        });
        if (props.config.groups.length > 1) {
          replies.push({
            id: `cont-delete-${idx}`,
            label: 'Delete this sequence',
            kind: 'edit',
            action: () => {
              deleteSequence(idx);
              markMutation({ kind: 'deleted-sequence' });
            },
          });
        }
        break;
      }
      case 'deleted-sequence': {
        replies.push({
          id: 'cont-add-seq',
          label: '+ Add another sequence',
          kind: 'edit',
          action: () => {
            addSequence();
            const newIdx = props.config.groups.length - 1;
            flashSequenceCard(newIdx);
            markMutation(
              { kind: 'added-sequence', sequenceIndex: newIdx },
              { createdSequence: newIdx },
            );
          },
        });
        break;
      }
      case 'removed-condition': {
        const idx = ctx.sequenceIndex;
        replies.push({
          id: `cont-diff-${idx}`,
          label: '+ Add a different condition',
          kind: 'edit',
          action: () => offerSmartPills(idx, 'and'),
        });
        break;
      }
      case 'mirrored':
      case 'set-routing': {
        // Just the Done escape hatch — nothing context-specific.
        break;
      }
      case 'delete-rejected-last-sequence': {
        // Last-sequence safety per spec — surface "Clear rules" alt.
        replies.push({
          id: 'cont-clear-rules-alt',
          label: 'Clear rules',
          kind: 'edit',
          action: () => {
            deleteAllRules(0);
            flashSequenceCard(0);
            markMutation(
              { kind: 'cleared-sequence', sequenceIndex: 0 },
              { mutatedSequence: 0 },
            );
          },
        });
        replies.push({
          id: 'cont-cancel',
          label: 'Cancel',
          kind: 'template',
          action: () => {
            continuationContext.value = null;
          },
        });
        break;
      }
    }

    // "Done" escape hatch is always rightmost (skip for delete-rejected
    // which uses Cancel as its escape).
    if (ctx.kind !== 'delete-rejected-last-sequence') {
      replies.push({
        id: 'cont-done',
        label: 'Done',
        kind: 'template',
        action: () => {
          continuationContext.value = null;
        },
      });
    }

    if (replies.length > 0) {
      sections.push({
        id: 'continuation',
        title: '',
        replies: replies.slice(0, 3),
      });
      return sections;
    }
  }

  // ---------- Per-sequence Add conditions sections (fallback) ----------
  // Hidden while the user is mid-flow (filling a slot or considering a
  // mirror prompt) so the only pills on screen are the ones relevant to
  // the current step. They reappear once the focused flow is resolved.
  const inFocusedFlow =
    pendingFillSlot.value !== null || mirrorOffer.value !== null;
  if (!inFocusedFlow) {
    props.config.groups.forEach((g, i) => {
      if (!g.blocks.some((b) => b.conditions.length > 0)) return;
      sections.push({
        id: `edit-seq-${i}`,
        title: `Add conditions to Sequence ${i + 1}`,
        replies: [
          {
            id: `add-and-${i}`,
            label: '+ And condition',
            kind: 'edit',
            action: () => onAddAndFromChat(i),
          },
          {
            id: `add-or-${i}`,
            label: '+ Or rule',
            kind: 'edit',
            action: () => onAddOrFromChat(i),
          },
        ],
      });
    });
  }

  return sections;
});


/** Chat shortcut: append an AND condition + open the recipe picker. */
function onAddAndFromChat(gi: number) {
  const group = props.config.groups[gi];
  if (!group) return;
  postUser(`Add an AND condition to Sequence ${gi + 1}`);
  const lastBlockIdx = group.blocks.length - 1;
  if (lastBlockIdx < 0) {
    addBlock(gi);
    pendingFillSlot.value = { gi, bi: 0, ci: 0 };
  } else {
    const newCondIdx = group.blocks[lastBlockIdx].conditions.length;
    addAndCondition(gi, lastBlockIdx);
    pendingFillSlot.value = { gi, bi: lastBlockIdx, ci: newCondIdx };
  }
  // Clear any stale mirror offer
  mirrorOffer.value = null;
  focusPendingSlot();
}

/** Chat shortcut: append a new OR-joined block + open the recipe picker. */
function onAddOrFromChat(gi: number) {
  postUser(`Add an OR rule to Sequence ${gi + 1}`);
  const newBlockIdx = props.config.groups[gi]?.blocks.length ?? 0;
  addBlock(gi);
  pendingFillSlot.value = { gi, bi: newBlockIdx, ci: 0 };
  mirrorOffer.value = null;
  focusPendingSlot();
}

/**
 * Scroll the newly-added rule row into view inside the right-side rules
 * column and move keyboard focus to its field <select>. Called right
 * after a + And / + Or chat pill so the user knows exactly where to
 * continue editing on the right.
 */
function focusPendingSlot() {
  if (pendingFillSlot.value) focusSlot(pendingFillSlot.value);
}

function focusSlot(
  slot: { gi: number; bi: number; ci: number },
  options: { focusField?: boolean } = { focusField: true },
) {
  // Wait two ticks: one for Vue to flush the config update, one for the
  // DOM to render the new <section>/<div> structure.
  void nextTick(() => {
    void nextTick(() => {
      const cards = document.querySelectorAll<HTMLElement>(
        '.dd-rules .dd-card',
      );
      const card = cards[slot.gi];
      if (!card) return;
      const blocks = card.querySelectorAll<HTMLElement>('.dd-block');
      const block = blocks[slot.bi];
      if (!block) return;
      const rules = block.querySelectorAll<HTMLElement>('.dd-rule');
      const rule = rules[slot.ci];
      if (!rule) return;
      // Briefly highlight the row so the user can spot it
      rule.classList.add('dd-rule--just-added');
      window.setTimeout(() => {
        rule.classList.remove('dd-rule--just-added');
      }, 1200);
      rule.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (options.focusField) {
        const firstSelect = rule.querySelector<HTMLSelectElement>('select');
        firstSelect?.focus({ preventScroll: true });
      }
    });
  });
}

/** Drop a recipe into the pending empty slot. */
function applyRecipe(recipe: ConditionRecipe) {
  const slot = pendingFillSlot.value;
  if (!slot) return;
  postUser(`Set this to "${recipe.label}"`);
  isInternalMutation.value = true;
  mutate(slot.gi, slot.bi, slot.ci, (c) => ({
    ...c,
    field: recipe.field,
    operator: recipe.operator,
    values: [...recipe.values],
  }));
  window.setTimeout(() => {
    isInternalMutation.value = false;
  }, FEEDBACK_DEBOUNCE_MS + 50);

  const sourceGi = slot.gi;
  const landedSlot = { ...slot };
  pendingFillSlot.value = null;

  // Highlight & scroll-into-view the row that just got filled
  focusSlot(landedSlot, { focusField: false });

  // Schedule the mirror prompt: any OTHER sequence that already has its
  // own rules but doesn't yet use this recipe's field is a good mirror
  // candidate. Show the spinning diamond during this wait so the user
  // sees the AI is still "thinking about next steps".
  isThinking.value = true;
  window.setTimeout(() => {
    postNote(
      `Applied "${recipe.label}" to Sequence ${sourceGi + 1}.`,
    );
    const targets = props.config.groups
      .map((g, i) => ({ g, i }))
      .filter(
        ({ g, i }) =>
          i !== sourceGi &&
          g.blocks.some((b) => b.conditions.length > 0) &&
          !collectFieldsInUse(g).has(recipe.field),
      )
      .map(({ i }) => i);
    if (targets.length > 0) {
      mirrorOffer.value = {
        recipe,
        sourceGi,
        targetGis: targets,
      };
      const targetLabels = targets
        .map((i) => `Sequence ${i + 1}`)
        .join(' or ');
      postNote(
        `Want to apply "${recipe.label}" to ${targetLabels} too for symmetry?`,
      );
    }
    isThinking.value = false;
  }, withJitter(AI_FOLLOWUP_MS));
}

/** Mirror the most recent recipe to a specific target sequence. */
function mirrorRecipeTo(gi: number) {
  const offer = mirrorOffer.value;
  if (!offer) return;
  const { recipe } = offer;
  postUser(`Apply "${recipe.label}" to Sequence ${gi + 1}`);
  isInternalMutation.value = true;
  const next = cloneConfig();
  const group = next.groups[gi];
  if (!group) return;
  const lastBlockIdx = group.blocks.length - 1;
  let landedSlot: { gi: number; bi: number; ci: number };
  if (lastBlockIdx < 0) {
    group.blocks.push({
      id: uid('b'),
      conditions: [
        {
          id: uid('c'),
          subject: '',
          category: '',
          field: recipe.field,
          operator: recipe.operator,
          values: [...recipe.values],
        },
      ],
    });
    landedSlot = { gi, bi: 0, ci: 0 };
  } else {
    const ci = group.blocks[lastBlockIdx].conditions.length;
    group.blocks[lastBlockIdx].conditions.push({
      id: uid('c'),
      subject: '',
      category: '',
      field: recipe.field,
      operator: recipe.operator,
      values: [...recipe.values],
    });
    landedSlot = { gi, bi: lastBlockIdx, ci };
  }
  emit('update:config', next);
  window.setTimeout(() => {
    isInternalMutation.value = false;
  }, FEEDBACK_DEBOUNCE_MS + 50);

  // Update offer to remove this target; if none left, clear the offer.
  const remaining = offer.targetGis.filter((t) => t !== gi);
  mirrorOffer.value =
    remaining.length > 0
      ? { ...offer, targetGis: remaining }
      : null;

  isThinking.value = true;
  window.setTimeout(() => {
    postNote(`Applied "${recipe.label}" to Sequence ${gi + 1}.`);
    isThinking.value = false;
  }, withJitter(AI_FOLLOWUP_MS));

  // Focus on the row we just landed on so the user can continue editing
  // there if they want — don't auto-focus its field <select> though,
  // since the condition is already fully filled in.
  focusSlot(landedSlot, { focusField: false });
}

function dismissMirrorOffer() {
  const offer = mirrorOffer.value;
  if (!offer) return;
  postUser('No thanks');
  mirrorOffer.value = null;
  postNote('Got it — leaving the other sequences as they are.');
}


function collectFieldsInUse(group: { blocks: { conditions: { field: string }[] }[] } | undefined) {
  const set = new Set<string>();
  if (!group) return set;
  for (const b of group.blocks) {
    for (const c of b.conditions) {
      if (c.field) set.add(c.field);
    }
  }
  return set;
}

/** Undo the most recent suggestion: clear its rules + remove its transcript entry. */
function undoLastSuggestion() {
  const lastIdx = [...transcript.value]
    .reverse()
    .findIndex((m) => m.role === 'assistant');
  if (lastIdx === -1) return;
  const absoluteIdx = transcript.value.length - 1 - lastIdx;
  const msg = transcript.value[absoluteIdx] as AssistantMessage;

  // Reset rule cards
  const next = cloneConfig();
  for (const g of next.groups) g.blocks = [];
  emit('update:config', next);

  // Remove from transcript
  transcript.value = transcript.value.filter((_, i) => i !== absoluteIdx);

  // Re-allow this suggestion to be applied again
  void msg.suggestionId;
}

// ===================================================================
// Ongoing-chat helpers
// ===================================================================

function postNote(text: string) {
  transcript.value = [
    ...transcript.value,
    { role: 'assistant', kind: 'note', text },
  ];
  scrollTranscriptToBottom();
}

function postUser(text: string) {
  transcript.value = [...transcript.value, { role: 'user', text }];
  scrollTranscriptToBottom();
}

/** Map a field id to its human label for chat copy. */
function describeField(fieldId: string): string {
  return fieldDef(fieldId)?.label ?? fieldId;
}

/** Render a one-line summary of a condition for chat feedback. */
function describeCondition(c: DDCondition): string {
  // Contact-scoped rows route to the dedicated formatter (B5).
  if (c.entity === 'contact') {
    return describeContactCondition(c);
  }
  if (!c.field) return 'a new empty rule';
  const field = describeField(c.field);
  if (!c.operator) return `${field}`;
  const opLabel =
    SIMPLE_OPERATORS.find((o) => o.value === c.operator)?.label.toLowerCase() ||
    c.operator;
  const value =
    c.values.length === 0
      ? '…'
      : c.operator === 'between'
        ? `${c.values[0] || '…'} and ${c.values[1] || '…'}`
        : c.values.join(', ');
  if (fieldUnitFor(c.field) === 'currency' && c.values[0]) {
    return `${field} ${opLabel} $${c.values[0]}`;
  }
  return `${field} ${opLabel} ${value}`;
}

// ===================================================================
// Natural-language intent parser (real-AI behavior — no LLM needed
// for a prototype; this resolver covers the common verbs, fields,
// operators, values and sequence references the user might say).
// ===================================================================

type Intent =
  | { kind: 'add-condition'; sequence?: number | 'all'; field?: SimpleFieldId; operator?: string; values?: string[] }
  | { kind: 'remove-condition'; sequence?: number; fieldHint?: SimpleFieldId }
  | { kind: 'clear-sequence'; sequence: number }
  | { kind: 'add-sequence' }
  | { kind: 'delete-sequence'; sequence: number }
  | { kind: 'mirror'; sourceSequence?: number }
  | { kind: 'set-routing'; target: 'drop' | number }
  | { kind: 'apply-template'; templateId: string }
  | { kind: 'undo' }
  | { kind: 'confirm' }
  | { kind: 'decline' }
  | { kind: 'explain'; sequence?: number | 'all' }
  | { kind: 'help' }
  | { kind: 'thanks' }
  | { kind: 'unknown' };

/** Word-number lookup for "first", "second", etc. */
const ORDINAL_TO_INDEX: Record<string, number> = {
  first: 0, '1st': 0,
  second: 1, '2nd': 1,
  third: 2, '3rd': 2,
  fourth: 3, '4th': 3,
  fifth: 4, '5th': 4,
};

const FIELD_KEYWORDS: { keywords: string[]; field: SimpleFieldId }[] = [
  // Order matters — longer/more-specific phrases first.
  { keywords: ['deal value', 'high value', 'high-value', 'big deal', 'small deal', 'value', 'amount', 'price', 'over $', 'above $', 'under $', 'below $'], field: 'dealValue' },
  { keywords: ['deal stage', 'pipeline stage', 'stage'], field: 'dealStage' },
  { keywords: ['completion time', 'completion', 'closed on', 'closed', 'close date', 'won on'], field: 'dealCompletionTime' },
  { keywords: ['expiration time', 'expiration', 'expires', 'expiring', 'expire'], field: 'dealExpirationTime' },
];

/** Stage-name shortcut: a bare stage word implies field=dealStage. */
const STAGE_VALUE_KEYWORDS: { keyword: string; stage: string }[] = [
  { keyword: 'qualified', stage: 'Qualified' },
  { keyword: 'estimate sent', stage: 'Estimate Sent' },
  { keyword: 'scheduled', stage: 'Scheduled' },
  { keyword: 'won', stage: 'Won' },
  { keyword: 'lost', stage: 'Lost' },
  { keyword: 'new lead', stage: 'New' },
];

const OPERATOR_KEYWORDS: { patterns: RegExp[]; operator: string }[] = [
  { patterns: [/\b(equals?|is|=|matches?)\b/], operator: 'equals' },
  { patterns: [/\b(exceeds?|greater than|more than|above|over|>)\b/], operator: 'exceeds' },
  { patterns: [/\b(less than|under|below|<)\b/], operator: 'lessThan' },
  { patterns: [/\b(between|range|from .* to)\b/], operator: 'between' },
];

const STAGE_ENUM = [
  'New', 'Qualified', 'Estimate Sent', 'Scheduled', 'Won', 'Lost',
];

/** Parse currency amounts: "$5000", "5,000", "5k", "10K dollars" → "5000" etc. */
function parseCurrencyValue(text: string): string | null {
  const m = text.match(/\$?\s*([0-9][0-9,]*)\s*(k|K)?(?:\s*(?:usd|dollars?))?/);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ''));
  if (m[2]) n *= 1000;
  return String(n);
}

/** Parse a Deal stage enum out of free text. */
function parseStageValue(text: string): string | null {
  const lower = text.toLowerCase();
  for (const stage of STAGE_ENUM) {
    if (lower.includes(stage.toLowerCase())) return stage;
  }
  return null;
}

function parseSequenceRef(
  text: string,
  groupsCount: number,
): number | 'all' | null {
  const lower = text.toLowerCase();
  // "branch", "path", "track" are user synonyms for "sequence"
  const SEQ_NOUN = '(?:sequence|branch|path|track)';
  if (new RegExp(`\\b(all|every|each)\\s+${SEQ_NOUN}s?\\b`).test(lower))
    return 'all';
  const numMatch = lower.match(new RegExp(`${SEQ_NOUN}\\s+(\\d+)`));
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < groupsCount) return idx;
  }
  for (const [word, idx] of Object.entries(ORDINAL_TO_INDEX)) {
    const re = new RegExp(`\\b${word}\\s+${SEQ_NOUN}\\b`);
    if (re.test(lower) && idx < groupsCount) return idx;
  }
  // "this sequence" — fall back to whatever sequence the user just
  // touched (pendingFillSlot or most-recent edit).
  if (new RegExp(`\\b(this|that|the)\\s+${SEQ_NOUN}\\b`).test(lower)) {
    const slot = pendingFillSlot.value;
    if (slot) return slot.gi;
    if (mirrorOffer.value) return mirrorOffer.value.sourceGi;
  }
  return null;
}

function parseField(text: string): SimpleFieldId | null {
  // When the diamond is downstream of a known trigger (Product / Quote
  // / Pipeline / Appointment), we MUST NOT silently map typed input to
  // Deal fields — that's how phrases like "won" or "scheduled" leak in
  // as `dealStage = Won` for an Appointment-scoped diamond. The
  // dedicated trigger-keyword parser doesn't exist yet, so for now we
  // return null and let the assistant ask the user to use a pill or
  // the dropdowns. Pills, recipes, and templates are all trigger-aware
  // already, so the user still has multiple working entry points.
  if (props.triggerSlug && isKnownTriggerSlug(props.triggerSlug)) {
    return null;
  }
  const lower = text.toLowerCase();
  for (const entry of FIELD_KEYWORDS) {
    if (entry.keywords.some((k) => lower.includes(k))) return entry.field;
  }
  // Bare stage names ("won deals", "qualified leads") imply dealStage.
  if (STAGE_VALUE_KEYWORDS.some(({ keyword }) => lower.includes(keyword))) {
    return 'dealStage';
  }
  // A bare currency amount ("over $5,000", "deals above 10k") implies dealValue.
  if (/\$\s*\d|(?:over|above|under|below|more than|less than)\s+\$?\s*\d/.test(lower)) {
    return 'dealValue';
  }
  return null;
}

function parseOperator(text: string): string | null {
  const lower = text.toLowerCase();
  for (const entry of OPERATOR_KEYWORDS) {
    if (entry.patterns.some((p) => p.test(lower))) return entry.operator;
  }
  return null;
}

function parseValueForField(
  text: string,
  field: SimpleFieldId,
): string[] | null {
  if (field === 'dealValue') {
    const v = parseCurrencyValue(text);
    return v ? [v] : null;
  }
  if (field === 'dealStage') {
    const v = parseStageValue(text);
    return v ? [v] : null;
  }
  // dates: not parsed in this prototype (fall back to UI defaults)
  return null;
}

function parseIntent(text: string): Intent {
  const lower = text.toLowerCase();
  const groupsCount = props.config.groups.length;

  if (/^(yes|yep|yeah|y|do it|confirm|sure|ok(?:ay)?|please|go ahead)\b/.test(lower))
    return { kind: 'confirm' };
  if (/^(no|nope|nah|cancel|stop|don'?t|never mind|nm)\b/.test(lower))
    return { kind: 'decline' };
  if (/\b(undo|revert|roll back|go back|restore)\b/.test(lower))
    return { kind: 'undo' };
  if (/\b(thanks|thank you|got it)\b/.test(lower))
    return { kind: 'thanks' };
  if (/^(help|how do|what can)\b/.test(lower))
    return { kind: 'help' };

  // Template match by suggestion title
  const tpl = activeSuggestionList.value.find(
    (s) =>
      !appliedSuggestionIds.value.has(s.id) &&
      s.title
        .toLowerCase()
        .split(/\s+/)
        .some((tok) => tok.length > 3 && lower.includes(tok)),
  );
  if (tpl && !/\b(add|set|change|remove|clear|delete)\b/.test(lower))
    return { kind: 'apply-template', templateId: tpl.id };

  const seqRef = parseSequenceRef(text, groupsCount);

  // "rule set" / "ruleset" / "set of rules" / "rule group" → a whole new
  // sequence card (the user wants a new logical branch, not a single
  // condition row). Handle this BEFORE the generic sequence-noun match so
  // the literal word "rule" in "rule set" doesn't fall through to
  // add-condition.
  if (
    /\b(add|create|make|build|new|another|set up|i (?:want|need|'?d like)\b.*\b(?:a|an|another)?\s*(?:new\s+)?)\b.*\b(rule\s?set|ruleset|rule group|set of rules)\b/.test(lower) ||
    /^(?:new|another)\s+(?:rule\s?set|ruleset|set of rules)\b/.test(lower)
  ) {
    return { kind: 'add-sequence' };
  }

  // Add a new sequence/branch/path. Accepts:
  //  - "add a new sequence"      - "new sequence"        - "create a branch"
  //  - "make another path"       - "add a sequence for..."
  if (
    /\b(add|create|make|build|new|set up|i (?:want|need) (?:a |an |another )?new)\b.*\b(sequence|branch|path|track)\b/.test(lower) &&
    !/\b(condition|rule|or|set\b)\b/.test(lower)
  ) {
    return { kind: 'add-sequence' };
  }

  if (typeof seqRef === 'number' && /\b(delete|remove|drop|kill)\b.+\b(sequence|branch|path)\b/.test(lower) && !/\b(condition|rules?)\b/.test(lower))
    return { kind: 'delete-sequence', sequence: seqRef };

  if (typeof seqRef === 'number' && /\b(clear|empty|reset|wipe)\b.+\b(rules?|sequence|branch|path)\b/.test(lower))
    return { kind: 'clear-sequence', sequence: seqRef };

  if (/\b(mirror|copy|apply).+(other|all|every|both)\b/.test(lower))
    return { kind: 'mirror', sourceSequence: typeof seqRef === 'number' ? seqRef : undefined };

  // Routing intent
  if (/\b(route|send|default).+(don'?t|drop|nothing|nowhere)\b/.test(lower))
    return { kind: 'set-routing', target: 'drop' };
  if (typeof seqRef === 'number' && /\b(route|default|fallback|else|otherwise).+sequence\s+\d+\b/.test(lower))
    return { kind: 'set-routing', target: seqRef };

  // Explain
  if (/\b(explain|describe|show|what'?s in|tell me about)\b/.test(lower))
    return { kind: 'explain', sequence: seqRef ?? 'all' };

  // Remove condition
  if (/\b(remove|delete|drop)\b/.test(lower) && (parseField(text) || /\b(condition|rules?)\b/.test(lower))) {
    const fieldHint = parseField(text) ?? undefined;
    return {
      kind: 'remove-condition',
      sequence: typeof seqRef === 'number' ? seqRef : undefined,
      fieldHint,
    };
  }

  // Add / set condition (most flexible — works without explicit "add" verb too)
  const field = parseField(text);
  const operator = parseOperator(text);
  const verbHit = /\b(add|set|use|apply|change|update|make|create|build|i (?:want|need|'?d like))\b/.test(lower);
  // Single-rule openers ("a new rule", "another rule"). "rule set" /
  // "ruleset" / "set of rules" / "rule group" were handled earlier as
  // add-sequence (a whole new branch), so they're intentionally NOT here.
  // `rules?` tolerates plural typos.
  const ruleHit = /\b(new rules?|another rules?|a rules?|one more rules?)\b/.test(lower);
  if (field || ruleHit || (verbHit && /\b(condition|rules?)\b/.test(lower))) {
    const values = field ? parseValueForField(text, field) ?? undefined : undefined;
    return {
      kind: 'add-condition',
      sequence: typeof seqRef === 'number' ? seqRef : (seqRef ?? undefined),
      field: field ?? undefined,
      operator: operator ?? undefined,
      values,
    };
  }

  return { kind: 'unknown' };
}

// ===================================================================
// Intent handlers — actually mutate config + reply contextually.
// ===================================================================

function handleIntent(intent: Intent, rawText: string) {
  switch (intent.kind) {
    case 'confirm':
      return handleConfirmation();
    case 'decline':
      return handleDecline();
    case 'undo':
      return handleUndo();
    case 'thanks':
      return postNote("Anytime — let me know if you'd like to tweak anything.");
    case 'help':
      return postNote(
        'I can: add conditions (e.g. "add deal value greater than $5,000 to Sequence 1"), remove rules ("remove deal value from Sequence 1"), clear or delete sequences, mirror a condition across sequences, change routing, undo, or apply any template. Try just describing the routing you want.',
      );
    case 'apply-template':
      postNote(
        `Got it — let me set up the "${
          SUGGESTIONS.find((s) => s.id === intent.templateId)?.title
        }" template for you.`,
      );
      setTimeout(
        () => applySuggestion(intent.templateId, { skipUserMessage: true }),
        200,
      );
      return;
    case 'add-sequence':
      addSequence();
      postNote(
        `Added a new sequence — that's Sequence ${props.config.groups.length}. Tell me which condition to put on it.`,
      );
      return;
    case 'delete-sequence':
      if (props.config.groups.length <= 1) {
        return postNote(
          "Can't remove the last sequence — at least one is required.",
        );
      }
      deleteSequence(intent.sequence);
      return postNote(`Removed Sequence ${intent.sequence + 1}.`);
    case 'clear-sequence':
      deleteAllRules(intent.sequence);
      return postNote(
        `Cleared the rules in Sequence ${intent.sequence + 1}. Anything from the previous step will now pass through.`,
      );
    case 'set-routing':
      return handleSetRouting(intent.target);
    case 'mirror':
      return handleMirrorRequest(intent.sourceSequence);
    case 'explain': {
      if (intent.sequence === 'all') return postNote(explainCurrentRules());
      if (typeof intent.sequence === 'number') {
        const g = props.config.groups[intent.sequence];
        return postNote(summarizeSingleSequence(g, intent.sequence));
      }
      return postNote(explainCurrentRules());
    }
    case 'remove-condition':
      return handleRemoveCondition(intent);
    case 'add-condition':
      return handleAddCondition(intent, rawText);
    case 'unknown':
    default:
      return postNote(
        "I'm not sure what to do with that yet. Try something like \"add deal value above $5,000 to Sequence 1\", \"clear Sequence 2\", \"explain my rules\", or apply a template by name.",
      );
  }
}

// ===================================================================
// Real-time apply pipeline
// -------------------------------------------------------------------
// `applyAndNarrate` runs the intent's state mutation IMMEDIATELY (so the
// rules preview on the right reacts the moment the user hits Enter) and
// returns a thunk that posts the chat narration AFTER the thinking +
// composing animation finishes. This is what makes the AI feel real-time:
// the configuration visibly changes before the assistant's reply lands.
//
// Conversational intents (confirm/decline/mirror/explain/help/thanks/
// apply-template/unknown) stay fully delayed via `handleIntent` because
// their meaning is the reply itself.
// ===================================================================

/** Quiet helper — opens a fresh AND row on a sequence without echoing a
 *  synthetic "Add an AND condition…" user message into the transcript
 *  (the real user already typed their prompt). Self-heals by seeding a
 *  sequence first if the diamond has none yet (fresh diamonds have zero
 *  outgoing edges → zero groups). Returns the gi the row ended up on. */
function addEmptyConditionRow(gi: number): number {
  // If the target sequence doesn't exist (e.g. freshly inserted diamond
  // with no branches yet), create one and target it instead.
  if (!props.config.groups[gi]) {
    addSequence();
    gi = props.config.groups.length - 1;
  }
  const group = props.config.groups[gi];
  if (!group) return gi;
  const lastBlockIdx = group.blocks.length - 1;
  if (lastBlockIdx < 0) {
    addBlock(gi);
    pendingFillSlot.value = { gi, bi: 0, ci: 0 };
  } else {
    const newCondIdx = group.blocks[lastBlockIdx].conditions.length;
    addAndCondition(gi, lastBlockIdx);
    pendingFillSlot.value = { gi, bi: lastBlockIdx, ci: newCondIdx };
  }
  mirrorOffer.value = null;
  // Don't steal focus from the composer — the pulse highlight + scroll
  // already point the user at the new row.
  return gi;
}

function applyAndNarrate(intent: Intent, rawText: string): () => void {
  switch (intent.kind) {
    case 'add-sequence': {
      addSequence();
      const newIdx = props.config.groups.length - 1;
      flashSequenceCard(newIdx);
      return () =>
        postNote(
          `Added a new sequence — that's Sequence ${newIdx + 1}. Tell me which condition to put on it.`,
        );
    }

    case 'add-condition': {
      const allSeqs = intent.sequence === 'all';
      let targetIdxs: number[];
      if (allSeqs) {
        targetIdxs = props.config.groups.map((_, i) => i);
      } else if (typeof intent.sequence === 'number') {
        targetIdxs = [intent.sequence];
      } else {
        const first = props.config.groups.findIndex((g) =>
          g.blocks.some((b) => b.conditions.length > 0),
        );
        targetIdxs = [first === -1 ? 0 : first];
      }

      if (!intent.field) {
        // No field → just open an empty AND row. addEmptyConditionRow
        // self-heals (creates a sequence first if none exist) and returns
        // the resolved index.
        const requestedIdx = targetIdxs[0];
        const idx = addEmptyConditionRow(requestedIdx);
        flashSequenceCard(idx);
        return () =>
          postNote(
            `Opened a new condition row on Sequence ${idx + 1}. Which field should it check? Try "deal value", "deal stage", "deal completion time", or "deal expiration time".`,
          );
      }

      // Field-bearing add: self-heal if there are no sequences yet by
      // seeding one so the condition has somewhere to land.
      if (props.config.groups.length === 0) {
        addSequence();
        targetIdxs = [0];
      }

      const operator = intent.operator || defaultOperatorFor(intent.field);
      const values =
        intent.values && intent.values.length > 0
          ? intent.values
          : defaultValuesFor(intent.field, operator);

      const next = cloneConfig();
      // If `all` was requested but groups were just seeded above,
      // re-resolve targetIdxs against the up-to-date groups.
      if (allSeqs) {
        targetIdxs = next.groups.map((_, i) => i);
      }
      for (const idx of targetIdxs) {
        const g = next.groups[idx];
        if (!g) continue;
        const lastBlockIdx = g.blocks.length - 1;
        const newCond: DDCondition = {
          id: uid('c'),
          subject: '',
          category: '',
          field: intent.field,
          operator,
          values: [...values],
        };
        if (lastBlockIdx < 0) {
          g.blocks.push({ id: uid('b'), conditions: [newCond] });
        } else {
          g.blocks[lastBlockIdx].conditions.push(newCond);
        }
      }
      emit('update:config', next);
      targetIdxs.forEach(flashSequenceCard);

      const condLabel = describeCondition({
        id: '',
        subject: '',
        category: '',
        field: intent.field,
        operator,
        values,
      });
      const where = allSeqs
        ? 'every sequence'
        : `Sequence ${targetIdxs[0] + 1}`;
      return () => postNote(`Added "${condLabel}" to ${where}.`);
    }

    case 'delete-sequence': {
      if (props.config.groups.length <= 1) {
        return () =>
          postNote("Can't remove the last sequence — at least one is required.");
      }
      const removedLabel = intent.sequence + 1;
      deleteSequence(intent.sequence);
      return () => postNote(`Removed Sequence ${removedLabel}.`);
    }

    case 'clear-sequence': {
      deleteAllRules(intent.sequence);
      flashSequenceCard(intent.sequence);
      return () =>
        postNote(
          `Cleared the rules in Sequence ${intent.sequence + 1}. Anything from the previous step will now pass through.`,
        );
    }

    case 'remove-condition': {
      const targetIdx =
        intent.sequence ??
        props.config.groups.findIndex((g) =>
          g.blocks.some((b) => b.conditions.length > 0),
        );
      if (targetIdx === -1 || !props.config.groups[targetIdx]) {
        return () => postNote("I couldn't find a matching condition to remove.");
      }
      const next = cloneConfig();
      let removed: DDCondition | null = null;
      for (let bi = 0; bi < next.groups[targetIdx].blocks.length; bi++) {
        const b = next.groups[targetIdx].blocks[bi];
        const cIdx = intent.fieldHint
          ? b.conditions.findIndex((c) => c.field === intent.fieldHint)
          : b.conditions.length - 1;
        if (cIdx >= 0) {
          removed = b.conditions[cIdx];
          b.conditions.splice(cIdx, 1);
          if (b.conditions.length === 0) {
            next.groups[targetIdx].blocks.splice(bi, 1);
          }
          break;
        }
      }
      if (!removed) {
        return () =>
          postNote(`No matching condition found in Sequence ${targetIdx + 1}.`);
      }
      emit('update:config', next);
      flashSequenceCard(targetIdx);
      const label = describeCondition(removed);
      return () =>
        postNote(`Removed "${label}" from Sequence ${targetIdx + 1}.`);
    }

    // Conversational + complex flows stay fully delayed.
    case 'confirm':
    case 'decline':
    case 'undo':
    case 'set-routing':
    case 'mirror':
    case 'explain':
    case 'help':
    case 'thanks':
    case 'apply-template':
    case 'unknown':
    default:
      return () => handleIntent(intent, rawText);
  }
}

function handleConfirmation() {
  if (pendingUndo.value) {
    const target = pendingUndo.value;
    pendingUndo.value = null;
    applyUndo(target);
    return postNote('Done — restored the previous version.');
  }
  if (mirrorOffer.value && mirrorOffer.value.targetGis.length > 0) {
    const gi = mirrorOffer.value.targetGis[0];
    mirrorRecipeTo(gi);
    return;
  }
  postNote("Got it.");
}

function handleDecline() {
  if (pendingUndo.value) {
    pendingUndo.value = null;
    return postNote('Got it — keeping things as they are.');
  }
  if (mirrorOffer.value) {
    return dismissMirrorOffer();
  }
  postNote('OK, leaving things as they are.');
}

function handleUndo() {
  const previous = undoHistory.value[undoHistory.value.length - 1];
  if (!previous) return postNote("There's nothing to undo yet.");
  pendingUndo.value = previous;
  undoHistory.value = undoHistory.value.slice(0, -1);
  postNote(
    `Want me to revert to the previous version?\n\nThe last state was:\n${summarizeConfig(previous)}\n\nReply "yes" to restore it or "no" to cancel.`,
  );
}

function handleSetRouting(target: 'drop' | number) {
  const next = cloneConfig();
  if (target === 'drop') {
    next.defaultRouting = '__drop__';
    emit('update:config', next);
    return postNote(
      'Routing default is now "Don\'t put them in a sequence" — anything that doesn\'t match a rule will be dropped.',
    );
  }
  const g = next.groups[target];
  if (!g) return postNote(`Sequence ${target + 1} doesn't exist.`);
  next.defaultRouting = g.targetFlowId || `__seq-${target}__`;
  emit('update:config', next);
  postNote(`Routing default is now Sequence ${target + 1}.`);
}

function handleRemoveCondition(intent: {
  sequence?: number;
  fieldHint?: SimpleFieldId;
}) {
  const targetIdx =
    intent.sequence ??
    props.config.groups.findIndex((g) =>
      g.blocks.some((b) => b.conditions.length > 0),
    );
  if (targetIdx === -1 || !props.config.groups[targetIdx]) {
    return postNote("I couldn't find a matching condition to remove.");
  }
  const group = props.config.groups[targetIdx];
  const next = cloneConfig();
  let removed: DDCondition | null = null;
  for (let bi = 0; bi < next.groups[targetIdx].blocks.length; bi++) {
    const b = next.groups[targetIdx].blocks[bi];
    const cIdx = intent.fieldHint
      ? b.conditions.findIndex((c) => c.field === intent.fieldHint)
      : b.conditions.length - 1;
    if (cIdx >= 0) {
      removed = b.conditions[cIdx];
      b.conditions.splice(cIdx, 1);
      if (b.conditions.length === 0) {
        next.groups[targetIdx].blocks.splice(bi, 1);
      }
      break;
    }
  }
  if (!removed) {
    return postNote(
      `No matching condition found in Sequence ${targetIdx + 1}.`,
    );
  }
  emit('update:config', next);
  postNote(
    `Removed "${describeCondition(removed)}" from Sequence ${targetIdx + 1}.`,
  );
  void group;
}

function handleMirrorRequest(sourceSeq?: number) {
  const srcIdx =
    sourceSeq ??
    props.config.groups.findIndex((g) =>
      g.blocks.some((b) => b.conditions.length > 0),
    );
  if (srcIdx === -1) {
    return postNote(
      "I need a condition on at least one sequence before mirroring. Add one first, then ask me to mirror.",
    );
  }
  const src = props.config.groups[srcIdx];
  const firstCond = src.blocks[0]?.conditions[0];
  if (!firstCond?.field) {
    return postNote(
      `Sequence ${srcIdx + 1} doesn't have a complete condition yet.`,
    );
  }
  const recipe: ConditionRecipe = {
    id: `mirror-${Date.now()}`,
    label: describeCondition(firstCond),
    field: firstCond.field as SimpleFieldId,
    operator: firstCond.operator,
    values: [...firstCond.values],
  };
  const targets = props.config.groups
    .map((g, i) => ({ g, i }))
    .filter(
      ({ g, i }) =>
        i !== srcIdx &&
        g.blocks.some((b) => b.conditions.length > 0) &&
        !collectFieldsInUse(g).has(recipe.field),
    )
    .map(({ i }) => i);
  if (targets.length === 0) {
    return postNote(
      `Nowhere to mirror to — the other sequences already have this field or don't have rules of their own.`,
    );
  }
  mirrorOffer.value = { recipe, sourceGi: srcIdx, targetGis: targets };
  const labels = targets.map((i) => `Sequence ${i + 1}`).join(' or ');
  postNote(
    `Mirror "${recipe.label}" from Sequence ${srcIdx + 1} to ${labels}? Reply "yes" to apply or pick a sequence button below.`,
  );
}

function handleAddCondition(
  intent: { sequence?: number | 'all'; field?: SimpleFieldId; operator?: string; values?: string[] },
  rawText: string,
) {
  // Resolve target sequence(s)
  const allSeqs = intent.sequence === 'all';
  let targetIdxs: number[];
  if (allSeqs) {
    targetIdxs = props.config.groups.map((_, i) => i);
  } else if (typeof intent.sequence === 'number') {
    targetIdxs = [intent.sequence];
  } else {
    // Fall back to the first sequence with rules, or sequence 1.
    const first = props.config.groups.findIndex((g) =>
      g.blocks.some((b) => b.conditions.length > 0),
    );
    targetIdxs = [first === -1 ? 0 : first];
  }

  if (!intent.field) {
    // Open an empty AND slot on the first target and ask which field
    const idx = targetIdxs[0];
    onAddAndFromChat(idx);
    return postNote(
      `Opened a new condition row on Sequence ${idx + 1}. Which field should it check? Try "deal value", "deal stage", "deal completion time", or "deal expiration time".`,
    );
  }

  // Build the new condition payload
  const operator = intent.operator || defaultOperatorFor(intent.field);
  const values =
    intent.values && intent.values.length > 0
      ? intent.values
      : defaultValuesFor(intent.field, operator);

  const next = cloneConfig();
  for (const idx of targetIdxs) {
    const g = next.groups[idx];
    if (!g) continue;
    const lastBlockIdx = g.blocks.length - 1;
    const newCond: DDCondition = {
      id: uid('c'),
      subject: '',
      category: '',
      field: intent.field,
      operator,
      values: [...values],
    };
    if (lastBlockIdx < 0) {
      g.blocks.push({ id: uid('b'), conditions: [newCond] });
    } else {
      g.blocks[lastBlockIdx].conditions.push(newCond);
    }
  }
  emit('update:config', next);

  const condLabel = describeCondition({
    id: '',
    subject: '',
    category: '',
    field: intent.field,
    operator,
    values,
  });
  const where = allSeqs
    ? 'every sequence'
    : `Sequence ${targetIdxs[0] + 1}`;
  postNote(`Added "${condLabel}" to ${where}.`);
  void rawText;
}

function defaultOperatorFor(field: SimpleFieldId): string {
  if (field === 'dealStage') return 'equals';
  if (field === 'dealValue') return 'exceeds';
  return 'between';
}

function defaultValuesFor(field: SimpleFieldId, operator: string): string[] {
  if (field === 'dealStage') return ['Qualified'];
  if (field === 'dealValue') return ['1000'];
  if (operator === 'between') {
    if (field === 'dealCompletionTime')
      return [daysAgoIso(7), todayIso()];
    if (field === 'dealExpirationTime')
      return [todayIso(), daysFromNowIso(7)];
  }
  return [todayIso()];
}

// ===================================================================
// Rule-set-for-sequence-N flow with AND/OR clarification.
// -------------------------------------------------------------------
// When the user says "add a new rule set for sequence 2" we want to:
//   1. Check whether Sequence 2 already exists.
//   2a. If yes — don't mutate. Ask whether the new rule should join as
//       AND (extend the existing block) or OR (start a new rule group).
//   2b. If no — create Sequence 2 (and any sequences between), then ask
//       the same AND-or-OR question.
//   3. On the user's AND/OR reply, mutate accordingly.
//
// This is a thin client-side state machine. A real Claude backend would
// achieve the same flow via the system prompt + the `explain_current_rules`
// tool — Claude calls the read tool, sees state, then asks. For the
// in-process stub which has no state access, we orchestrate it here.
// ===================================================================

/** When set, the assistant is waiting for the user to reply "AND" or "OR"
 *  so it can route the next rule into the right slot of Sequence N. */
const pendingAndOrChoice = ref<{
  sequenceIndex: number;
  sequenceJustCreated: boolean;
} | null>(null);

// ===================================================================
// Continuation pills (B2), state-aware refs (B6), smart pills (B7),
// sequence disambiguation (B1), multi-step composition (B3),
// last-sequence safety. All chat-layer enrichment.
// ===================================================================

/** Most recent sequence the assistant mutated. Used to resolve
 *  state-aware references like "that sequence" / "this sequence". */
const lastMutatedSeqIdx = ref<number | null>(null);

/** Most recent sequence the assistant CREATED. Used to resolve
 *  state-aware references like "the new sequence" / "the one I just
 *  added". May equal lastMutatedSeqIdx, or precede it if a creation
 *  was followed by a condition-add. */
const lastCreatedSeqIdx = ref<number | null>(null);

/** Continuation context — set after each successful mutation; surfaces
 *  the appropriate next-step pills (max 3) into the chat. Cleared when
 *  the user sends their next message or clicks "Done". */
type ContinuationContext =
  | { kind: 'added-condition'; sequenceIndex: number }
  | { kind: 'added-sequence'; sequenceIndex: number }
  | { kind: 'cleared-sequence'; sequenceIndex: number }
  | { kind: 'deleted-sequence' }
  | { kind: 'removed-condition'; sequenceIndex: number }
  | { kind: 'set-routing' }
  | { kind: 'mirrored'; sourceIndex: number }
  | { kind: 'delete-rejected-last-sequence' };
const continuationContext = ref<ContinuationContext | null>(null);

/** Sequence disambiguation: assistant is waiting for the user to pick
 *  which sequence a per-sequence command should target. */
const pendingSequenceChoice = ref<{
  /** Closure that completes the action once the index is resolved. */
  resolve: (sequenceIndex: number) => Promise<void> | void;
  /** Closure that handles "+ New sequence" choice. */
  resolveNew: () => Promise<void> | void;
  /** Indexes offered as pills (most-recently-edited first). */
  candidateIndexes: number[];
} | null>(null);

/** Smart pills: assistant has offered concrete one-click condition pills
 *  for the user to pick a next condition. */
const pendingSmartPills = ref<{
  sequenceIndex: number;
  /** AND extends the last existing block; OR creates a new OR-joined block. */
  joinAs: 'and' | 'or';
} | null>(null);

/** Set after every successful mutation. Centralised so we never forget
 *  to update lastMutatedSeqIdx / continuationContext together. */
function markMutation(
  ctx: ContinuationContext,
  options: { mutatedSequence?: number; createdSequence?: number } = {},
) {
  continuationContext.value = ctx;
  if (options.createdSequence != null) {
    lastCreatedSeqIdx.value = options.createdSequence;
    lastMutatedSeqIdx.value = options.createdSequence;
  } else if (options.mutatedSequence != null) {
    lastMutatedSeqIdx.value = options.mutatedSequence;
  }
}

/** Rewrite state-aware references ("that sequence", "the new one",
 *  "the empty one", "the last sequence") into concrete "sequence N"
 *  refs so downstream parsers don't need to know about state. */
function resolveStateAwareRefs(text: string): string {
  let resolved = text;
  const SEQ_NOUN = '(?:sequence|branch|path|track)';

  if (lastMutatedSeqIdx.value != null) {
    const ref = `sequence ${lastMutatedSeqIdx.value + 1}`;
    resolved = resolved.replace(
      new RegExp(`\\b(?:that|this)\\s+${SEQ_NOUN}\\b`, 'gi'),
      ref,
    );
  }
  if (lastCreatedSeqIdx.value != null) {
    const ref = `sequence ${lastCreatedSeqIdx.value + 1}`;
    resolved = resolved.replace(
      new RegExp(
        `\\bthe\\s+(?:new|newly[\\s-]created|just[\\s-]created|one\\s+i\\s+just\\s+(?:added|created))\\s+${SEQ_NOUN}\\b`,
        'gi',
      ),
      ref,
    );
    resolved = resolved.replace(
      /\bthe\s+one\s+i\s+just\s+(?:added|created)\b/gi,
      ref,
    );
  }
  if (props.config.groups.length > 0) {
    resolved = resolved.replace(
      new RegExp(`\\bthe\\s+last\\s+${SEQ_NOUN}\\b`, 'gi'),
      `sequence ${props.config.groups.length}`,
    );
  }
  resolved = resolved.replace(
    new RegExp(`\\bthe\\s+first\\s+${SEQ_NOUN}\\b`, 'gi'),
    'sequence 1',
  );
  const emptyIdxs = props.config.groups.reduce<number[]>((acc, g, i) => {
    if (g.blocks.every((b) => b.conditions.length === 0)) acc.push(i);
    return acc;
  }, []);
  if (emptyIdxs.length === 1) {
    resolved = resolved.replace(
      new RegExp(`\\bthe\\s+empty\\s+(?:one|${SEQ_NOUN})\\b`, 'gi'),
      `sequence ${emptyIdxs[0] + 1}`,
    );
  }
  return resolved;
}

/** Order sequence indexes by most-recently-edited first for
 *  disambiguation pills. */
function rankedSequenceIndexes(): number[] {
  const all = props.config.groups.map((_, i) => i);
  const last = lastMutatedSeqIdx.value;
  if (last == null || !props.config.groups[last]) return all;
  return [last, ...all.filter((i) => i !== last)];
}

interface SmartPillCandidate {
  field: SimpleFieldId;
  operator: string;
  values: string[];
  label: string;
}

/** Ranked, executable, one-click condition pills for a target sequence.
 *  Excludes fields already in use within that sequence so suggestions
 *  add a new axis instead of duplicating existing ones. */
function pickSmartConditionPills(seqIdx: number): SmartPillCandidate[] {
  const seq = props.config.groups[seqIdx];
  // Dedup key tracks field+value pairs so a "Quote status equals Sent"
  // rule in the sequence doesn't suppress an "equals Accepted" pill —
  // different value picks on the same field stay independent
  // suggestions. Legacy deal-field pool still benefits because each
  // deal pill uses a different field anyway.
  const usedKeys = new Set<string>();
  seq?.blocks.forEach((b) =>
    b.conditions.forEach((c) => {
      if (c.field) usedKeys.add(`${c.field}::${JSON.stringify(c.values)}`);
    }),
  );

  // Pick the candidate pool: trigger-scoped if the upstream trigger
  // is one of the four supported entities (Product / Quote / Pipeline
  // / Appointment), otherwise the legacy deal-field pool.
  let pool: SmartPillCandidate[];
  if (props.triggerSlug && isKnownTriggerSlug(props.triggerSlug)) {
    pool = TRIGGER_SMART_PILLS[props.triggerSlug].map((p) => ({
      field: p.field as SimpleFieldId,
      operator: p.operator,
      values: [...p.values],
      label: p.label,
    }));
  } else {
    pool = [
      {
        field: 'dealValue',
        operator: 'exceeds',
        values: ['1000'],
        label: 'Deal Value exceeds $1,000',
      },
      {
        field: 'dealStage',
        operator: 'equals',
        values: ['Qualified'],
        label: 'Deal Stage equals Qualified',
      },
      {
        field: 'dealCompletionTime',
        operator: 'between',
        values: [daysAgoIso(7), todayIso()],
        label: 'Deal Completion Time in last 7 days',
      },
      {
        field: 'dealExpirationTime',
        operator: 'between',
        values: [todayIso(), daysFromNowIso(7)],
        label: 'Deal Expiration Time in next 7 days',
      },
    ];
  }

  // Exclude already-used (field, values) combos so each pill is a
  // distinct suggestion, but still allow multiple values on the same
  // field (essential for triggers like Quote/Appointment that only
  // expose one or two fields with multiple meaningful values each).
  const remaining = pool.filter(
    (c) => !usedKeys.has(`${c.field}::${JSON.stringify(c.values)}`),
  );
  // Cap at 3 per the global pill rule.
  return remaining.slice(0, 3);
}

/** Open the smart-pill picker — assistant asks "What should the next
 *  condition check?" and surfaces 3 concrete one-click pills. */
function offerSmartPills(seqIdx: number, joinAs: 'and' | 'or') {
  pendingSmartPills.value = { sequenceIndex: seqIdx, joinAs };
  // Push a fresh assistant note so the question is visible in the transcript
  postNote('What should the next condition check?');
}

/** Apply a smart-pill candidate. AND extends the last block; OR creates
 *  a new OR-joined block. */
function applySmartPill(
  cand: SmartPillCandidate,
  seqIdx: number,
  joinAs: 'and' | 'or',
) {
  pendingSmartPills.value = null;

  // If 2+ sequences exist, ask which one to apply this pill to first
  // (per AI-assistant spec — pills should respect sequence context, not
  // silently route to a presumed target). Skip the question when only
  // one sequence is configured.
  if (props.config.groups.length >= 2) {
    void disambiguateSequenceIfNeeded(
      (chosenIdx) => doApplySmartPill(cand, chosenIdx, joinAs),
      async () => {
        addSequence();
        const newIdx = props.config.groups.length - 1;
        doApplySmartPill(cand, newIdx, joinAs);
      },
    );
    return;
  }
  doApplySmartPill(cand, seqIdx, joinAs);
}

/** Actual mutation for a smart-pill click. Split out from applySmartPill
 *  so the disambiguation flow can defer the apply until the user picks
 *  a target sequence. */
function doApplySmartPill(
  cand: SmartPillCandidate,
  seqIdx: number,
  joinAs: 'and' | 'or',
) {
  const next = cloneConfig();
  if (!next.groups[seqIdx]) return;
  const g = next.groups[seqIdx];
  const newCond: DDCondition = {
    id: uid('c'),
    subject: '',
    category: '',
    field: cand.field,
    operator: cand.operator,
    values: [...cand.values],
  };
  if (joinAs === 'or' || g.blocks.length === 0) {
    g.blocks.push({ id: uid('b'), conditions: [newCond] });
  } else {
    g.blocks[g.blocks.length - 1].conditions.push(newCond);
  }
  emit('update:config', next);
  flashSequenceCard(seqIdx);
  markMutation(
    { kind: 'added-condition', sequenceIndex: seqIdx },
    { mutatedSequence: seqIdx },
  );
  postNote(`Added ${cand.label} to Sequence ${seqIdx + 1}.`);
}

/** Detect a compound command like "create a new sequence with deal
 *  value > $5,000" or "create a high-value path for deals over $10K".
 *  Returns the two atomic steps to execute, or null. */
function parseCompoundCommand(text: string): {
  newSequence: true;
  condition?: {
    field: SimpleFieldId;
    operator: string;
    values: string[];
  };
} | null {
  const lower = text.toLowerCase();
  // Must combine a "new/another sequence/path" intent with a condition
  const newSeqHit = /\b(?:add|create|make|build|set up|new|another)\b.*\b(?:sequence|branch|path|track)\b/.test(
    lower,
  );
  if (!newSeqHit) return null;
  // Need some form of "with"/"for" linkage plus a condition predicate
  const linkHit = /\b(?:with|for|where|that\s+has|containing|having|matches?|matching)\b/.test(
    lower,
  );
  if (!linkHit) return null;

  // Try to extract a condition predicate
  const field = parseField(text);
  if (!field) return null;
  const operator = parseOperator(text) ?? defaultOperatorFor(field);
  const values = parseValueForField(text, field) ?? defaultValuesFor(field, operator);

  return {
    newSequence: true,
    condition: { field, operator, values },
  };
}

/** Atomically: add a new sequence, then add the condition to it.
 *  One cloneConfig + emit. */
async function executeCompoundNewSequenceWithCondition(
  field: SimpleFieldId,
  operator: string,
  values: string[],
): Promise<void> {
  isThinking.value = true;
  scrollTranscriptToBottom();
  await streamSleep(220);

  const next = cloneConfig();
  next.groups.push({
    id: uid('g'),
    targetFlowId: '',
    targetName: '',
    blocks: [
      {
        id: uid('b'),
        conditions: [
          {
            id: uid('c'),
            subject: '',
            category: '',
            field,
            operator,
            values: [...values],
          },
        ],
      },
    ],
  });
  const newIdx = next.groups.length - 1;
  isInternalMutation.value = true;
  emit('update:config', next);
  window.setTimeout(() => {
    isInternalMutation.value = false;
  }, FEEDBACK_DEBOUNCE_MS + 50);
  flashSequenceCard(newIdx);
  markMutation(
    { kind: 'added-sequence', sequenceIndex: newIdx },
    { createdSequence: newIdx },
  );

  const condLabel = describeCondition({
    id: '',
    subject: '',
    category: '',
    field,
    operator,
    values,
  });
  await streamAssistantText(
    `Created Sequence ${newIdx + 1} and added ${condLabel}.`,
  );
}

/** When a per-sequence command has no explicit ref and >1 sequences
 *  exist, ask which sequence via pills. Returns true if disambiguation
 *  was queued (caller should NOT proceed with the command). */
async function disambiguateSequenceIfNeeded(
  resolve: (sequenceIndex: number) => Promise<void> | void,
  resolveNew: () => Promise<void> | void,
): Promise<boolean> {
  // Zero or one sequence: no need to ask. Caller proceeds normally
  // (self-heal / auto-target).
  if (props.config.groups.length <= 1) return false;
  pendingSequenceChoice.value = {
    resolve,
    resolveNew,
    candidateIndexes: rankedSequenceIndexes(),
  };
  isThinking.value = false;
  isComposing.value = false;
  await streamAssistantText('Which sequence should this rule go into?');
  return true;
}

/** Interpret user's reply to a pending sequence disambiguation. */
async function handleSequenceDisambigReply(text: string): Promise<void> {
  const choice = pendingSequenceChoice.value;
  if (!choice) return;
  const lower = text.trim().toLowerCase();

  // Cancellation
  if (/^(cancel|never\s*mind|nm|stop|forget it)\b/.test(lower)) {
    pendingSequenceChoice.value = null;
    await streamAssistantText(
      'OK — leaving things as they are. Tell me what you\'d like next.',
    );
    return;
  }

  // Explicit "+ new sequence" / "new" / "create new"
  if (/^(?:new|\+?\s*new|create\s+new|another)\b/.test(lower) ||
      /\+\s*new\s+sequence/.test(lower)) {
    pendingSequenceChoice.value = null;
    await choice.resolveNew();
    return;
  }

  // Numeric or ordinal sequence ref
  const numMatch = lower.match(/(\d+)/);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < props.config.groups.length) {
      pendingSequenceChoice.value = null;
      await choice.resolve(idx);
      return;
    }
    if (idx >= 0) {
      // User picked a sequence number that doesn't exist — offer to create
      pendingSequenceChoice.value = null;
      await streamAssistantText(
        `Sequence ${idx + 1} doesn't exist yet. I can create it for you — tell me "yes, create Sequence ${idx + 1}" or pick an existing one.`,
      );
      return;
    }
  }

  // Unrecognised reply — cancel pending state, route as a new command
  pendingSequenceChoice.value = null;
  await routeViaAI(text);
}

/** Interpret user's reply to a pending smart-pill question. */
async function handleSmartPillReply(text: string): Promise<void> {
  const pending = pendingSmartPills.value;
  if (!pending) return;
  pendingSmartPills.value = null;
  // Anything the user types here just routes as a fresh command
  await routeViaAI(text);
}

/** Heuristic — does this prompt look like an "add a condition" command
 *  with no explicit sequence reference? Mirrors the conditions stub's
 *  add-condition branch uses, but only fires when the disambiguation
 *  preconditions hold (≥ 2 sequences, no "sequence N" in text, no
 *  "all sequences" qualifier). */
async function maybeDisambiguateAddCondition(text: string): Promise<boolean> {
  if (props.config.groups.length <= 1) return false;
  const lower = text.toLowerCase();

  // Already explicit? Skip — user told us which sequence.
  if (/\b(?:sequence|branch|path|track)\s+\d+\b/.test(lower)) return false;
  if (/\b(?:first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s+(?:sequence|branch|path|track)\b/.test(lower))
    return false;
  if (/\b(?:all|every|each)\s+(?:sequence|branch|path|track)s?\b/.test(lower))
    return false;
  if (/\bto\s+(?:every\s+)?sequence(?:s)?\b/.test(lower)) return false;

  // Is it an add-condition style command? Need a field hit OR an
  // explicit "add a condition/rule" pattern.
  const field = parseField(text);
  const verbHit = /\b(add|set|use|apply|change|update|make|create|build|route|i (?:want|need|'?d like))\b/.test(
    lower,
  );
  const ruleHit = /\b(condition|rules?)\b/.test(lower);
  if (!field && !(verbHit && ruleHit)) return false;

  // Stash the parsed intent and ask which sequence.
  const operator = parseOperator(text);
  const values = field ? parseValueForField(text, field) ?? undefined : undefined;

  const intent = { field, operator, values, rawText: text };

  const proceed = (sequenceIndex: number) => applyParsedAddCondition(intent, sequenceIndex);
  const proceedNew = async () => {
    addSequence();
    const newIdx = props.config.groups.length - 1;
    lastCreatedSeqIdx.value = newIdx;
    await applyParsedAddCondition(intent, newIdx);
  };

  const queued = await disambiguateSequenceIfNeeded(proceed, proceedNew);
  return queued;
}

/** Apply a parsed add-condition intent to a specific sequence. Same
 *  semantics as the executeToolCall add_condition path, factored so
 *  disambiguation can defer it. */
async function applyParsedAddCondition(
  intent: {
    field: SimpleFieldId | null;
    operator: string | null;
    values: string[] | undefined;
    rawText: string;
  },
  sequenceIndex: number,
): Promise<void> {
  if (!intent.field) {
    // No field — open an empty row on the target sequence
    const placedIdx = addEmptyConditionRow(sequenceIndex);
    flashSequenceCard(placedIdx);
    markMutation(
      { kind: 'added-condition', sequenceIndex: placedIdx },
      { mutatedSequence: placedIdx },
    );
    await streamAssistantText(
      `Opened a new condition row on Sequence ${placedIdx + 1}. Pick a field — try "deal value", "deal stage", or a date field.`,
    );
    return;
  }
  const operator = intent.operator || defaultOperatorFor(intent.field);
  const values =
    intent.values && intent.values.length > 0
      ? intent.values
      : defaultValuesFor(intent.field, operator);
  const next = cloneConfig();
  const g = next.groups[sequenceIndex];
  if (!g) return;
  const lastBlockIdx = g.blocks.length - 1;
  const newCond: DDCondition = {
    id: uid('c'),
    subject: '',
    category: '',
    field: intent.field,
    operator,
    values: [...values],
  };
  if (lastBlockIdx < 0) {
    g.blocks.push({ id: uid('b'), conditions: [newCond] });
  } else {
    g.blocks[lastBlockIdx].conditions.push(newCond);
  }
  emit('update:config', next);
  flashSequenceCard(sequenceIndex);
  markMutation(
    { kind: 'added-condition', sequenceIndex },
    { mutatedSequence: sequenceIndex },
  );
  const condLabel = describeCondition({
    id: '',
    subject: '',
    category: '',
    field: intent.field,
    operator,
    values,
  });
  await streamAssistantText(`Added ${condLabel} to Sequence ${sequenceIndex + 1}.`);
}

/** Parse "rule set for sequence N" / "rules set for sequence N" / "ruleset
 *  for sequence N" (or branch / path / track) out of free text. Returns
 *  the 0-based sequence index, or null if the pattern doesn't apply.
 *  The `rules?` allows the common plural mistype "rules set". */
function parseRuleSetForSequence(text: string): { sequenceIndex: number } | null {
  const lower = text.toLowerCase();
  if (!/\b(rules?\s?set|rulesets?|rules? group|sets? of rules?)\b/.test(lower)) {
    return null;
  }
  const m = lower.match(/(?:sequence|branch|path|track)\s+(\d+)/);
  if (m) {
    const idx = parseInt(m[1], 10) - 1;
    if (idx >= 0) return { sequenceIndex: idx };
  }
  const ord: Record<string, number> = {
    first: 0, '1st': 0,
    second: 1, '2nd': 1,
    third: 2, '3rd': 2,
    fourth: 3, '4th': 3,
    fifth: 4, '5th': 4,
  };
  for (const [word, i] of Object.entries(ord)) {
    if (new RegExp(`\\b${word}\\s+(?:sequence|branch|path|track)\\b`).test(lower)) {
      return { sequenceIndex: i };
    }
  }
  return null;
}

/** Pause briefly — used to chunk the assistant's text into the streaming
 *  bubble at the same ~20ms cadence as the SSE stub backend. */
function streamSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Append an assistant text turn to the transcript with the same
 *  word-by-word streaming UX the AI client produces. Also records the
 *  turn in `aiConversation` so multi-turn history stays coherent if the
 *  user follows up with an AI-routed prompt later. */
async function streamAssistantText(text: string): Promise<void> {
  const note = { role: 'assistant' as const, kind: 'note' as const, text: '' };
  transcript.value.push(note);
  isThinking.value = false;
  isComposing.value = true;
  scrollTranscriptToBottom();

  const CHUNK = 4;
  for (let i = 0; i < text.length; i += CHUNK) {
    note.text += text.slice(i, i + CHUNK);
    await streamSleep(18 + Math.random() * 22);
    scrollTranscriptToBottom();
  }

  isComposing.value = false;
  aiConversation.value.push({
    role: 'assistant',
    content: [{ type: 'text', text }],
  });
}

/** Atomically append empty sequences until index `targetIdx` exists.
 *
 *  CRITICAL: this is ONE cloneConfig + N pushes + ONE emit. Calling
 *  `addSequence()` in a loop does NOT work — Vue propagates the prop
 *  update on the next render tick, so each iteration re-clones the same
 *  stale `props.config` and each emit overwrites the previous. The net
 *  effect is at most one appended sequence (and previously caused an
 *  infinite while-loop here). Batching avoids both problems. */
function ensureSequencesUpTo(targetIdx: number) {
  if (props.config.groups.length > targetIdx) return;
  const next = cloneConfig();
  while (next.groups.length <= targetIdx) {
    next.groups.push({
      id: uid('g'),
      targetFlowId: '',
      targetName: '',
      blocks: [],
    });
  }
  isInternalMutation.value = true;
  emit('update:config', next);
  window.setTimeout(() => {
    isInternalMutation.value = false;
  }, FEEDBACK_DEBOUNCE_MS + 50);
}

/** Step 1 of the flow — parse target sequence, check existence, mutate
 *  only if needed, then queue the AND/OR question. */
async function handleRuleSetForSequence(sequenceIndex: number): Promise<void> {
  const existed = !!props.config.groups[sequenceIndex];

  if (!existed) {
    ensureSequencesUpTo(sequenceIndex);
    flashSequenceCard(sequenceIndex);
    lastCreatedSeqIdx.value = sequenceIndex;
  }
  lastMutatedSeqIdx.value = sequenceIndex;

  pendingAndOrChoice.value = {
    sequenceIndex,
    sequenceJustCreated: !existed,
  };

  const opener = existed
    ? `Sequence ${sequenceIndex + 1} already exists.`
    : `Created Sequence ${sequenceIndex + 1}.`;
  // Chat bubbles render plain text — no markdown — so emphasize AND/OR
  // with caps + parenthetical hints instead of **bold**.
  const question = existed
    ? `Should I add the new rule as AND (joined with the existing rules) or OR (a separate rule group)?`
    : `Would you like the first rule joined as AND (single condition) or OR (lets you add alternative rule groups later)?`;

  await streamAssistantText(`${opener} ${question}`);
}

/** Step 2 of the flow — interpret the user's AND/OR reply and mutate. */
async function handleAndOrResponse(text: string): Promise<void> {
  const choice = pendingAndOrChoice.value;
  if (!choice) return; // defensive — shouldn't reach here
  const lower = text.trim().toLowerCase();
  const idx = choice.sequenceIndex;

  // Cancellation — any of these clears pending state and bows out
  if (/^(cancel|never\s*mind|nm|stop|forget it)\b/.test(lower)) {
    pendingAndOrChoice.value = null;
    await streamAssistantText(
      'OK — leaving things as they are. Tell me what you\'d like next.',
    );
    return;
  }

  const isAnd = /^(and|&|\+|amp)\b/.test(lower) || lower === 'a';
  const isOr = /^(or|\|)\b/.test(lower) || lower === 'o';

  if (!isAnd && !isOr) {
    // Not a recognized answer — pass through to the normal AI flow so
    // the user can naturally redirect (e.g. "add deal value to sequence 1"
    // overrides the pending question).
    pendingAndOrChoice.value = null;
    await routeViaAI(text);
    return;
  }

  pendingAndOrChoice.value = null;

  if (isAnd) {
    // AND mirrors the existing "+ And condition" quick-reply pill in the
    // rules pane (see onAddAndFromChat): extend the last block on this
    // sequence with a new empty condition row, mark it as the pending
    // fill slot, clear any stale mirror offer, then scroll + focus the
    // field <select> so the user can immediately pick from the dropdown.
    const group = props.config.groups[idx];
    if (!group) {
      // Defensive — sequence vanished between turns.
      ensureSequencesUpTo(idx);
    }
    const placedIdx = addEmptyConditionRow(idx); // sets pendingFillSlot
    mirrorOffer.value = null;
    flashSequenceCard(placedIdx);
    focusPendingSlot();
    markMutation(
      { kind: 'added-condition', sequenceIndex: placedIdx },
      { mutatedSequence: placedIdx },
    );
    await streamAssistantText(
      `Added an AND row to Sequence ${placedIdx + 1}. Pick a field — try "deal value", "deal stage", or a date field.`,
    );
  } else {
    // OR mirrors the existing "+ Or rule" quick-reply pill (see
    // onAddOrFromChat): append a brand-new OR-joined block to this
    // sequence containing one empty condition row, mark it as the
    // pending fill slot, clear mirror offer, then scroll + focus the
    // field <select> for that row.
    if (!props.config.groups[idx]) {
      ensureSequencesUpTo(idx);
    }
    const newBlockIdx = props.config.groups[idx].blocks.length;
    addBlock(idx);
    pendingFillSlot.value = { gi: idx, bi: newBlockIdx, ci: 0 };
    mirrorOffer.value = null;
    flashSequenceCard(idx);
    focusPendingSlot();
    markMutation(
      { kind: 'added-condition', sequenceIndex: idx },
      { mutatedSequence: idx },
    );
    await streamAssistantText(
      `Added a new OR rule group to Sequence ${idx + 1}. Pick a field for the first condition.`,
    );
  }
}

// ===================================================================
// AI client wiring — Anthropic Messages API protocol.
// -------------------------------------------------------------------
// Sends each user prompt to the configured backend (in-process stub by
// default, Lambda when VITE_AI_API_URL is set), streams the response into
// the chat bubble token-by-token, and executes any tool_use blocks the
// model returns against the existing mutation helpers below.
//
// The regex-based parseIntent → applyAndNarrate path is retained as an
// offline fallback if the AI request errors (network, malformed stream).
// ===================================================================

/** Anthropic-shape conversation history sent on every turn. The API is
 *  stateless — we replay the whole thing each request. */
const aiConversation = ref<AiMessageParam[]>([]);

/** Dispatch a single tool_use block to the existing mutator helpers.
 *  Returns a short status string the model would see on its next turn
 *  (we don't currently do multi-turn round-trips with the stub, but the
 *  shape is here so the Lambda backend can extend to it without
 *  frontend changes). */
function executeToolCall(toolUse: AiToolUseBlock): string {
  const { name, input } = toolUse;
  try {
    switch (name) {
      case 'add_sequence': {
        addSequence();
        const newIdx = props.config.groups.length - 1;
        flashSequenceCard(newIdx);
        markMutation(
          { kind: 'added-sequence', sequenceIndex: newIdx },
          { createdSequence: newIdx },
        );
        return `Created Sequence ${newIdx + 1}.`;
      }

      case 'delete_sequence': {
        const idx = Number(input.sequence_index);
        if (props.config.groups.length <= 1) {
          // Last-sequence safety per spec — offer "Clear rules" as the
          // alternative via continuation pill.
          markMutation({ kind: 'delete-rejected-last-sequence' });
          return "Can't remove the last sequence — at least one is required. Would you like to clear its rules instead?";
        }
        if (!Number.isInteger(idx) || !props.config.groups[idx]) {
          return `No Sequence ${idx + 1} to delete.`;
        }
        deleteSequence(idx);
        markMutation({ kind: 'deleted-sequence' });
        return `Removed Sequence ${idx + 1}.`;
      }

      case 'clear_sequence': {
        const idx = Number(input.sequence_index);
        if (!Number.isInteger(idx) || !props.config.groups[idx]) {
          return `No Sequence ${idx + 1} to clear.`;
        }
        deleteAllRules(idx);
        flashSequenceCard(idx);
        markMutation(
          { kind: 'cleared-sequence', sequenceIndex: idx },
          { mutatedSequence: idx },
        );
        return `Cleared Sequence ${idx + 1}.`;
      }

      case 'add_condition': {
        const allSeqs = input.all_sequences === true;
        let targetIdxs: number[];
        if (allSeqs) {
          targetIdxs = props.config.groups.map((_, i) => i);
        } else if (Number.isInteger(input.sequence_index as number)) {
          targetIdxs = [input.sequence_index as number];
        } else {
          const first = props.config.groups.findIndex((g) =>
            g.blocks.some((b) => b.conditions.length > 0),
          );
          targetIdxs = [first === -1 ? 0 : first];
        }

        const field = input.field as SimpleFieldId | undefined;

        if (!field) {
          const idx = addEmptyConditionRow(targetIdxs[0]);
          flashSequenceCard(idx);
          markMutation(
            { kind: 'added-condition', sequenceIndex: idx },
            { mutatedSequence: idx },
          );
          return `Opened a new condition row on Sequence ${idx + 1}.`;
        }

        // Self-heal: seed a sequence if none exist
        if (props.config.groups.length === 0) {
          addSequence();
          targetIdxs = [0];
        }

        const operator =
          (input.operator as string | undefined) || defaultOperatorFor(field);
        const values =
          Array.isArray(input.values) && input.values.length > 0
            ? (input.values as string[])
            : defaultValuesFor(field, operator);

        const next = cloneConfig();
        if (allSeqs) targetIdxs = next.groups.map((_, i) => i);
        for (const idx of targetIdxs) {
          const g = next.groups[idx];
          if (!g) continue;
          const lastBlockIdx = g.blocks.length - 1;
          const newCond: DDCondition = {
            id: uid('c'),
            subject: '',
            category: '',
            field,
            operator,
            values: [...values],
          };
          if (lastBlockIdx < 0) {
            g.blocks.push({ id: uid('b'), conditions: [newCond] });
          } else {
            g.blocks[lastBlockIdx].conditions.push(newCond);
          }
        }
        emit('update:config', next);
        targetIdxs.forEach(flashSequenceCard);
        markMutation(
          { kind: 'added-condition', sequenceIndex: targetIdxs[0] },
          { mutatedSequence: targetIdxs[0] },
        );

        const condLabel = describeCondition({
          id: '',
          subject: '',
          category: '',
          field,
          operator,
          values,
        });
        const where = allSeqs ? 'every sequence' : `Sequence ${targetIdxs[0] + 1}`;
        return `Added "${condLabel}" to ${where}.`;
      }

      case 'remove_condition': {
        const targetIdx = Number.isInteger(input.sequence_index as number)
          ? (input.sequence_index as number)
          : props.config.groups.findIndex((g) =>
              g.blocks.some((b) => b.conditions.length > 0),
            );
        if (targetIdx === -1 || !props.config.groups[targetIdx]) {
          return "No matching condition to remove.";
        }
        const fieldHint = input.field as SimpleFieldId | undefined;
        const next = cloneConfig();
        let removed: DDCondition | null = null;
        for (let bi = 0; bi < next.groups[targetIdx].blocks.length; bi++) {
          const b = next.groups[targetIdx].blocks[bi];
          const cIdx = fieldHint
            ? b.conditions.findIndex((c) => c.field === fieldHint)
            : b.conditions.length - 1;
          if (cIdx >= 0) {
            removed = b.conditions[cIdx];
            b.conditions.splice(cIdx, 1);
            if (b.conditions.length === 0) {
              next.groups[targetIdx].blocks.splice(bi, 1);
            }
            break;
          }
        }
        if (!removed) return `No matching condition in Sequence ${targetIdx + 1}.`;
        emit('update:config', next);
        flashSequenceCard(targetIdx);
        markMutation(
          { kind: 'removed-condition', sequenceIndex: targetIdx },
          { mutatedSequence: targetIdx },
        );
        return `Removed "${describeCondition(removed)}" from Sequence ${targetIdx + 1}.`;
      }

      case 'set_default_routing': {
        const target = String(input.target);
        const next = cloneConfig();
        if (target === 'drop') {
          next.defaultRouting = '__drop__';
        } else {
          const i = parseInt(target, 10);
          if (!Number.isInteger(i) || !next.groups[i]) {
            return `Sequence ${i + 1} doesn't exist.`;
          }
          next.defaultRouting = next.groups[i].targetFlowId || `__seq-${i}__`;
        }
        emit('update:config', next);
        markMutation({ kind: 'set-routing' });
        return target === 'drop'
          ? 'Default routing set to drop.'
          : `Default routing set to Sequence ${parseInt(target, 10) + 1}.`;
      }

      case 'mirror_condition': {
        // Currently surfaced via the existing mirror offer flow — the
        // model can call this once we add the target_sequences UI loop.
        return 'Mirror tool call received — please use the in-pane mirror picker for now.';
      }

      case 'explain_current_rules': {
        if (Number.isInteger(input.sequence_index as number)) {
          const i = input.sequence_index as number;
          const g = props.config.groups[i];
          if (!g) return `No Sequence ${i + 1}.`;
          return summarizeSingleSequence(g, i);
        }
        return explainCurrentRules();
      }

      case 'list_available_fields': {
        return (
          'Fields: dealValue (operators: equals, exceeds, lessThan, between), ' +
          'dealStage (equals; values New, Qualified, Estimate Sent, Scheduled, Won, Lost), ' +
          'dealCompletionTime / dealExpirationTime (between, with ISO date values).'
        );
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    // Defensive — surface errors back rather than throwing through the stream loop
    return `Tool ${name} failed: ${(err as Error).message}`;
  }
}

/** Type guard for the streaming-note we mutate during a stream. */
type StreamingNote = { role: 'assistant'; kind: 'note'; text: string };

/** Send a user prompt through the AI client. Streams the assistant's
 *  text into a chat bubble in real time and executes returned tool calls
 *  against the existing mutators. Falls back to the regex parser if the
 *  AI request errors out. */
async function sendComposerAI(rawText: string) {
  // Pre-resolve state-aware references ("that sequence", "the new one",
  // etc.) so downstream parsers see concrete "sequence N" refs (B6).
  // The user's transcript bubble preserves what they typed; the AI
  // conversation history gets the resolved version so the stub parser
  // and (later) real Claude both work against concrete refs.
  const text = resolveStateAwareRefs(rawText);
  postUser(rawText);
  aiConversation.value.push({ role: 'user', content: text });

  // Sending a new message clears any non-blocking continuation pills
  // per spec ("pills disappear when the user sends their next message").
  continuationContext.value = null;

  // Highest priority: pending AND/OR question.
  if (pendingAndOrChoice.value) {
    await handleAndOrResponse(text);
    return;
  }
  // Next: pending sequence disambiguation.
  if (pendingSequenceChoice.value) {
    await handleSequenceDisambigReply(text);
    return;
  }
  // Next: pending smart-pill question — any typed reply routes normally.
  if (pendingSmartPills.value) {
    await handleSmartPillReply(text);
    return;
  }

  // Specialised "rule set for sequence N" flow.
  const ruleSetMatch = parseRuleSetForSequence(text);
  if (ruleSetMatch) {
    isThinking.value = true;
    scrollTranscriptToBottom();
    await streamSleep(220);
    await handleRuleSetForSequence(ruleSetMatch.sequenceIndex);
    return;
  }

  // Multi-step composition (B3): "create a high-value path for deals
  // over $10K" → addSequence + addCondition as one atomic emit.
  const compound = parseCompoundCommand(text);
  if (compound?.condition) {
    await executeCompoundNewSequenceWithCondition(
      compound.condition.field,
      compound.condition.operator,
      compound.condition.values,
    );
    return;
  }

  // Sequence disambiguation (B1): if this is a per-sequence command
  // without an explicit sequence ref and >1 sequence exists, ask first.
  if (await maybeDisambiguateAddCondition(text)) return;

  // Default path — route through the AI client.
  await routeViaAI(text);
}

/** Internal: the AI-routed send path. Pulled out of sendComposerAI so the
 *  AND/OR state machine can call it for non-AND/OR replies that should
 *  fall through to normal interpretation. */
async function routeViaAI(text: string) {
  // Push a streaming bubble we'll mutate in-place as deltas arrive.
  isThinking.value = true;
  scrollTranscriptToBottom();
  const streamingNote: StreamingNote = { role: 'assistant', kind: 'note', text: '' };
  transcript.value.push(streamingNote);

  // Partial tool inputs assembled across input_json_delta events
  const partialToolInputs = new Map<number, { id: string; name: string; json: string }>();
  const completedToolUses: AiToolUseBlock[] = [];

  try {
    for await (const event of streamChat({ messages: aiConversation.value })) {
      switch (event.type) {
        case 'content_block_start':
          if (event.content_block.type === 'tool_use') {
            partialToolInputs.set(event.index, {
              id: event.content_block.id,
              name: event.content_block.name,
              json: '',
            });
          }
          break;
        case 'content_block_delta':
          if (event.delta.type === 'text_delta') {
            isThinking.value = false;
            isComposing.value = true;
            streamingNote.text += event.delta.text;
            scrollTranscriptToBottom();
          } else if (event.delta.type === 'input_json_delta') {
            const partial = partialToolInputs.get(event.index);
            if (partial) partial.json += event.delta.partial_json;
          }
          break;
        case 'content_block_stop': {
          const partial = partialToolInputs.get(event.index);
          if (partial) {
            let parsed: Record<string, unknown> = {};
            try {
              parsed = partial.json ? JSON.parse(partial.json) : {};
            } catch {
              parsed = {};
            }
            completedToolUses.push({
              type: 'tool_use',
              id: partial.id,
              name: partial.name,
              input: parsed,
            });
            partialToolInputs.delete(event.index);
          }
          break;
        }
        case 'message_stop':
          isThinking.value = false;
          isComposing.value = false;
          break;
        case 'error':
          throw new Error(`${event.error.type}: ${event.error.message}`);
        default:
          break;
      }
    }

    // Execute the model's tool calls against the live config. Each call
    // mutates state and flashes the affected card.
    for (const tu of completedToolUses) {
      executeToolCall(tu);
    }

    // If the model didn't narrate anything, drop the empty streaming
    // bubble so the transcript doesn't show a phantom empty assistant
    // message.
    if (streamingNote.text === '') {
      const lastIdx = transcript.value.length - 1;
      if (transcript.value[lastIdx] === streamingNote) {
        transcript.value.splice(lastIdx, 1);
      }
    }

    // Record the assistant turn in the conversation history so the next
    // turn has full context.
    const assistantBlocks: { type: 'text'; text: string }[] = [];
    if (streamingNote.text) {
      assistantBlocks.push({ type: 'text', text: streamingNote.text });
    }
    if (assistantBlocks.length > 0 || completedToolUses.length > 0) {
      aiConversation.value.push({
        role: 'assistant',
        content: [...assistantBlocks, ...completedToolUses],
      });
    }
  } catch (err) {
    // Network / parsing failure → fall back to the offline regex path
    // so the user still gets a response.
    isThinking.value = false;
    isComposing.value = false;
    if (streamingNote.text === '') {
      const lastIdx = transcript.value.length - 1;
      if (transcript.value[lastIdx] === streamingNote) {
        transcript.value.splice(lastIdx, 1);
      }
    }
    // eslint-disable-next-line no-console
    console.warn('AI stream failed, falling back to regex parser:', err);
    const intent = parseIntent(text);
    applyAndNarrate(intent, text)();
  }
}

function sendComposer() {
  const text = composerText.value.trim();
  if (!text) return;
  composerText.value = '';
  void sendComposerAI(text);
}

// Surface the active AI transport in dev console so the user knows
// whether they're hitting the stub or a real backend.
// eslint-disable-next-line no-console
console.info(`[DecisionDiamond] AI transport: ${AI_TRANSPORT}`);

/** Plain-English explainer for a single sequence by index. */
function summarizeSingleSequence(
  g: { blocks: DDBlock[] },
  gi: number,
): string {
  const seqLabel = `Sequence ${gi + 1}`;
  if (g.blocks.length === 0) {
    return `${seqLabel} has no rules yet — anything coming in will pass through. Tap "+ And condition" on the right to start a rule, or tell me the condition (e.g. "add Deal value to Sequence ${gi + 1}").`;
  }
  const summaries: string[] = [];
  g.blocks.forEach((b) => {
    const conds = b.conditions
      .filter((c) => c.field)
      .map(describeCondition);
    if (conds.length > 0) summaries.push(conds.join(' AND '));
  });
  if (summaries.length === 0) {
    return `${seqLabel} has empty rule rows — pick a field on each to finish them.`;
  }
  return `${seqLabel}: ${summaries.join(' OR ')}.`;
}

/** Same shape as explainCurrentRules but operates on any config snapshot. */
function summarizeConfig(cfg: DecisionDiamondConfig): string {
  const lines: string[] = [];
  cfg.groups.forEach((g, i) => {
    const seqName = `Sequence ${i + 1}`;
    if (g.blocks.length === 0) {
      lines.push(`• ${seqName}: no rules`);
      return;
    }
    const summaries: string[] = [];
    g.blocks.forEach((b) => {
      const conds = b.conditions
        .filter((c) => c.field)
        .map(describeCondition);
      if (conds.length > 0) summaries.push(conds.join(' AND '));
    });
    lines.push(
      summaries.length === 0
        ? `• ${seqName}: empty rules`
        : `• ${seqName}: ${summaries.join(' OR ')}`,
    );
  });
  return lines.join('\n');
}

/** Apply a previously-snapshotted config as an undo. */
function applyUndo(target: DecisionDiamondConfig) {
  // Mark as internal so the watcher doesn't re-narrate the diff
  isInternalMutation.value = true;
  emit('update:config', JSON.parse(JSON.stringify(target)));
  window.setTimeout(() => {
    isInternalMutation.value = false;
  }, FEEDBACK_DEBOUNCE_MS + 50);
}

/** Summarize the currently-configured rules in plain English. */
function explainCurrentRules(): string {
  const lines: string[] = [];
  props.config.groups.forEach((g, i) => {
    const seqName = `Sequence ${i + 1}`;
    if (g.blocks.length === 0) {
      lines.push(`${seqName} has no rules — everything passes through.`);
      return;
    }
    const summaries: string[] = [];
    g.blocks.forEach((b) => {
      const conds = b.conditions
        .filter((c) => c.field)
        .map(describeCondition);
      if (conds.length > 0) summaries.push(conds.join(' AND '));
    });
    if (summaries.length === 0) {
      lines.push(`${seqName} has empty rules — nothing will match.`);
    } else {
      lines.push(`${seqName}: ${summaries.join(' OR ')}.`);
    }
  });
  return lines.join('\n');
}

function scrollTranscriptToBottom() {
  void nextTick(() => {
    const el = transcriptEl.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

// ===================================================================
// Group/condition mutation
// ===================================================================

function ensureGroups(n: number) {
  if (props.config.groups.length >= n) return;
  const next = cloneConfig();
  while (next.groups.length < n) {
    next.groups.push({
      id: uid('g'),
      // Empty targetFlowId / targetName flags this group as not yet
      // connected to a downstream sequence on the canvas.
      targetFlowId: '',
      targetName: '',
      blocks: [],
    });
  }
  // System-driven, not user-initiated — don't chat about it.
  const wasInternal = isInternalMutation.value;
  isInternalMutation.value = true;
  emit('update:config', next);
  // Restore the flag past the watcher's debounce so the deferred callback
  // still sees this change as internal.
  if (!wasInternal) {
    window.setTimeout(() => {
      isInternalMutation.value = false;
    }, FEEDBACK_DEBOUNCE_MS + 50);
  }
}

function isPlaceholderGroup(group: { targetFlowId: string; targetName: string }) {
  return !group.targetFlowId || !group.targetName;
}

// ===================================================================
// Drag-and-drop reordering for sequence cards
// ===================================================================

const draggingIdx = ref<number | null>(null);
const dragOverIdx = ref<number | null>(null);
const dragOverPos = ref<'before' | 'after' | null>(null);

function onDragStart(gi: number, e: DragEvent) {
  draggingIdx.value = gi;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(gi));
    const handle = e.currentTarget as HTMLElement;
    const card = handle.closest('.dd-card') as HTMLElement | null;
    if (card) {
      // Use the whole card as the drag preview so the user sees what
      // they're moving instead of just the handle icon.
      e.dataTransfer.setDragImage(card, 16, 16);
    }
  }
}

function onCardDragOver(gi: number, e: DragEvent) {
  if (draggingIdx.value === null) return;
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const isAfter = e.clientY - rect.top > rect.height / 2;

  // Normalize "after card N" into "before card N+1" so a single
  // before-indicator covers the gap between any two cards.
  const total = props.config.groups.length;
  if (isAfter && gi < total - 1) {
    dragOverIdx.value = gi + 1;
    dragOverPos.value = 'before';
  } else {
    dragOverIdx.value = gi;
    dragOverPos.value = isAfter ? 'after' : 'before';
  }
}

function onCardDragLeave(gi: number, e: DragEvent) {
  const related = e.relatedTarget as Node | null;
  const target = e.currentTarget as Node;
  // Only clear when the cursor truly leaves this card (not when entering
  // a child element like a select).
  if (!related || !target.contains(related)) {
    if (dragOverIdx.value === gi) {
      dragOverIdx.value = null;
      dragOverPos.value = null;
    }
  }
}

function onCardDrop(_gi: number) {
  if (draggingIdx.value === null || dragOverIdx.value === null) {
    onDragEnd();
    return;
  }
  const from = draggingIdx.value;
  let to = dragOverIdx.value;
  if (dragOverPos.value === 'after') to += 1;
  // Splicing out `from` first shifts later indices down by one.
  if (from < to) to -= 1;
  if (from !== to) moveSequence(from, to);
  onDragEnd();
}

function onDragEnd() {
  draggingIdx.value = null;
  dragOverIdx.value = null;
  dragOverPos.value = null;
}

/** Reorder a sequence card from one index to another. */
function moveSequence(from: number, to: number) {
  if (from === to) return;
  if (from < 0 || from >= props.config.groups.length) return;
  if (to < 0 || to >= props.config.groups.length) return;
  const next = cloneConfig();
  const [moved] = next.groups.splice(from, 1);
  next.groups.splice(to, 0, moved);
  emit('update:config', next);
}

/** Keyboard fallback: Arrow Up/Down on the drag handle reorders. */
function onDragHandleKeydown(gi: number, e: KeyboardEvent) {
  if (e.key === 'ArrowUp' && gi > 0) {
    e.preventDefault();
    moveSequence(gi, gi - 1);
  } else if (
    e.key === 'ArrowDown' &&
    gi < props.config.groups.length - 1
  ) {
    e.preventDefault();
    moveSequence(gi, gi + 1);
  }
}

/** Append a fresh, unconnected sequence (placeholder) to the diamond.
 *  The AI assistant tracks this via its config watcher but stays silent —
 *  no automatic chat note clutters the transcript. The user can ask
 *  about the new sequence in the composer to engage the assistant. */
function addSequence() {
  isInternalMutation.value = true;
  const next = cloneConfig();
  next.groups.push({
    id: uid('g'),
    targetFlowId: '',
    targetName: '',
    blocks: [],
  });
  emit('update:config', next);
  window.setTimeout(() => {
    isInternalMutation.value = false;
  }, FEEDBACK_DEBOUNCE_MS + 50);
}

function hasRules(group: { blocks: DDBlock[] }) {
  return group.blocks.some((b) => b.conditions.length > 0);
}

/** True only when at least one condition in this sequence has its FIRST
 *  input (the unified field/Contact dropdown) actually picked. An empty
 *  row with placeholder selects doesn't count — OR-joining only makes
 *  sense once there's a configured rule to OR against.
 *
 *  Counts as configured when:
 *   - `field` is set (a deal field was picked), OR
 *   - `category` is set (a contact category was picked), OR
 *   - `entity === 'contact'` (Contact was picked from the unified
 *     dropdown; the user committed to contact mode even if they
 *     haven't drilled into a category yet). */
function hasConfiguredRules(group: { blocks: DDBlock[] }) {
  return group.blocks.some((b) =>
    b.conditions.some(
      (c) => !!(c.field || c.category || c.entity === 'contact'),
    ),
  );
}

function emptyCondition(): DDCondition {
  return {
    id: uid('c'),
    subject: '',
    category: '',
    field: '',
    operator: '',
    values: [],
  };
}

/** "+ Add a rule" — append a new OR-joined block to the sequence. */
function addBlock(gi: number) {
  const next = cloneConfig();
  const group = next.groups[gi];
  if (!group) return;
  group.blocks.push({ id: uid('b'), conditions: [emptyCondition()] });
  emit('update:config', next);
}

/** "+ And" — append a new AND-joined condition inside an existing block. */
function addAndCondition(gi: number, bi: number) {
  const next = cloneConfig();
  const block = next.groups[gi]?.blocks[bi];
  if (!block) return;
  block.conditions.push(emptyCondition());
  emit('update:config', next);
}

/** Duplicate a single AND-joined condition inside its block. */
function duplicateCondition(gi: number, bi: number, ci: number) {
  const next = cloneConfig();
  const block = next.groups[gi]?.blocks[bi];
  const source = block?.conditions[ci];
  if (!block || !source) return;
  const copy: DDCondition = {
    ...source,
    id: uid('c'),
    values: [...source.values],
  };
  block.conditions.splice(ci + 1, 0, copy);
  emit('update:config', next);
}

/** Duplicate an entire OR-joined block. */
function duplicateBlock(gi: number, bi: number) {
  const next = cloneConfig();
  const original = next.groups[gi]?.blocks[bi];
  if (!original) return;
  const copy = {
    id: uid('b'),
    conditions: original.conditions.map((c) => ({
      ...c,
      id: uid('c'),
      values: [...c.values],
    })),
  };
  next.groups[gi].blocks.splice(bi + 1, 0, copy);
  emit('update:config', next);
}

/** Delete an entire OR-joined block. */
function deleteBlock(gi: number, bi: number) {
  const next = cloneConfig();
  if (!next.groups[gi]) return;
  next.groups[gi].blocks.splice(bi, 1);
  emit('update:config', next);
}

function removeCondition(gi: number, bi: number, ci: number) {
  const next = cloneConfig();
  const block = next.groups[gi]?.blocks[bi];
  if (!block) return;
  block.conditions.splice(ci, 1);
  if (block.conditions.length === 0) {
    next.groups[gi].blocks.splice(bi, 1);
  }
  emit('update:config', next);
}

function deleteAllRules(gi: number) {
  const next = cloneConfig();
  if (!next.groups[gi]) return;
  next.groups[gi].blocks = [];
  emit('update:config', next);
}

function groupDisplayName(gi: number): string {
  const g = props.config.groups[gi];
  if (!g) return `Branch ${gi + 1}`;
  return isPlaceholderGroup(g) ? `unconnected branch ${gi + 1}` : g.targetName;
}

function confirmDeleteAllRules(gi: number) {
  if (window.confirm(`Delete all rules for "${groupDisplayName(gi)}"?`)) {
    deleteAllRules(gi);
  }
}

/** Remove an entire sequence card. Patches default routing if needed.
 *  Enforces a minimum of one sequence — the last card can't be deleted. */
function deleteSequence(gi: number) {
  if (props.config.groups.length <= 1) return;
  const target = props.config.groups[gi];
  if (!target) return;
  const next = cloneConfig();
  next.groups.splice(gi, 1);

  // If the removed sequence was the default-routing target, fall back to drop.
  if (
    target.targetFlowId &&
    next.defaultRouting === target.targetFlowId
  ) {
    next.defaultRouting = '__drop__';
  }

  emit('update:config', next);
}

function confirmDeleteSequence(gi: number) {
  const hasContent = hasRules(props.config.groups[gi]);
  const name = `Sequence ${gi + 1}`;
  const msg = hasContent
    ? `Delete "${name}" and all of its rules? This can't be undone.`
    : `Delete "${name}"?`;
  if (window.confirm(msg)) {
    deleteSequence(gi);
  }
}

function resetAll() {
  const next = cloneConfig();
  next.groups = next.groups.map((g) => ({ ...g, blocks: [] }));
  emit('update:config', next);
  transcript.value = [];
}

function confirmReset() {
  if (
    window.confirm(
      'Reset this decision diamond? All rules and the conversation will be cleared.',
    )
  ) {
    resetAll();
  }
}

function onField(gi: number, bi: number, ci: number, e: Event) {
  onFieldValue(gi, bi, ci, (e.target as HTMLSelectElement).value);
}
function onOperator(gi: number, bi: number, ci: number, e: Event) {
  onOperatorValue(gi, bi, ci, (e.target as HTMLSelectElement).value);
}
function onSingleValue(gi: number, bi: number, ci: number, e: Event) {
  onSingleValueValue(gi, bi, ci, (e.target as HTMLSelectElement).value);
}
/* Value-based variants — bound by DropdownSelect's `@update:model-value`
 * which emits the chosen value directly (no DOM event wrapper). */
function onFieldValue(gi: number, bi: number, ci: number, v: string) {
  mutate(gi, bi, ci, (c) => ({ ...c, field: v, operator: '', values: [] }));
}

/** Unified handler for the merged field/Contact dropdown. The picked
 *  value is either a deal field id ("dealValue", etc.) or the literal
 *  string "contact". The latter flips the row to contact mode and
 *  clears the cascade so the user starts the category picker fresh. */
function onFieldOrContactValue(
  gi: number,
  bi: number,
  ci: number,
  v: string,
) {
  if (v === 'contact') {
    mutate(gi, bi, ci, (c) => ({
      ...c,
      entity: 'contact',
      category: '',
      field: '',
      operator: '',
      values: [],
    }));
  } else {
    mutate(gi, bi, ci, (c) => ({
      ...c,
      entity: 'deal',
      category: '',
      field: v,
      operator: '',
      values: [],
    }));
  }
}
function onOperatorValue(gi: number, bi: number, ci: number, v: string) {
  mutate(gi, bi, ci, (c) => ({ ...c, operator: v, values: [] }));
}
function onSingleValueValue(gi: number, bi: number, ci: number, v: string) {
  mutate(gi, bi, ci, (c) => ({ ...c, values: [v] }));
}
function onValueAt(gi: number, bi: number, ci: number, idx: number, v: string) {
  mutate(gi, bi, ci, (c) => {
    const arr = [...c.values];
    while (arr.length <= idx) arr.push('');
    arr[idx] = v;
    return { ...c, values: arr };
  });
}

function mutate(
  gi: number,
  bi: number,
  ci: number,
  mut: (c: DDCondition) => DDCondition,
) {
  const next = cloneConfig();
  const cond = next.groups[gi]?.blocks[bi]?.conditions[ci];
  if (!cond) return;
  next.groups[gi].blocks[bi].conditions[ci] = mut(cond);
  emit('update:config', next);
}

// ===================================================================
// Contact-scoped rule row handlers (B5).
// -------------------------------------------------------------------
// When a condition's `entity` is 'contact', the row renders with a
// "Contact's [Category] [Attribute] [Operator] [Value]" shape. These
// handlers map the corresponding <select> changes onto the condition.
// ===================================================================

/** Add a fresh contact-scoped rule row to a sequence as a new OR-block.
 *  Mirrors `addBlock` but seeds the condition with entity='contact'.
 *  Kept for the AI-assistant flow ("add a contact rule via chat"). The
 *  user-facing UI no longer exposes a separate button — the unified
 *  scope select on every row lets a normal "+ Add a rule" become a
 *  contact rule with one extra pick. */
function addContactBlock(gi: number) {
  const next = cloneConfig();
  const group = next.groups[gi];
  if (!group) return;
  group.blocks.push({
    id: uid('b'),
    conditions: [emptyContactCondition()],
  });
  emit('update:config', next);
}

/** Switch a rule's scope between Deal and Contact. Clears the row's
 *  downstream state (field / operator / values) since the new scope
 *  has different fields and operators. Triggered by the scope select
 *  that appears as the first dropdown in every rule row.
 *
 *  Two entry points: `onScope` handles a native-`<select>` change event
 *  (kept for any tests / older callers); `onScopeValue` takes the value
 *  directly (used by DropdownSelect's `@update:model-value`). */
function onScopeValue(gi: number, bi: number, ci: number, value: string) {
  const scope = value as 'deal' | 'contact';
  mutate(gi, bi, ci, (c) => ({
    ...c,
    entity: scope,
    category: '',
    field: '',
    operator: '',
    values: [],
  }));
}
function onScope(gi: number, bi: number, ci: number, e: Event) {
  onScopeValue(gi, bi, ci, (e.target as HTMLSelectElement).value);
}

/** Append an AND-joined contact condition to an existing block. */
function addAndContactCondition(gi: number, bi: number) {
  const next = cloneConfig();
  const block = next.groups[gi]?.blocks[bi];
  if (!block) return;
  block.conditions.push(emptyContactCondition());
  emit('update:config', next);
}

function emptyContactCondition(): DDCondition {
  return {
    id: uid('c'),
    entity: 'contact',
    subject: '',
    category: '',
    field: '',
    operator: '',
    values: [],
  };
}

function onContactCategory(
  gi: number,
  bi: number,
  ci: number,
  e: Event,
) {
  onContactCategoryValue(
    gi,
    bi,
    ci,
    (e.target as HTMLSelectElement).value as ContactCategory,
  );
}
function onContactCategoryValue(
  gi: number,
  bi: number,
  ci: number,
  cat: ContactCategory,
) {
  mutate(gi, bi, ci, (c) => {
    if (cat === 'tags') {
      // Tags is its own attribute — skip the Attribute step entirely.
      return {
        ...c,
        category: 'tags',
        field: TAGS_ATTRIBUTE.id,
        operator: defaultOperatorForType('tags'),
        values: [],
      };
    }
    return {
      ...c,
      category: cat,
      field: '',
      operator: '',
      values: [],
    };
  });
}

function onContactAttribute(
  gi: number,
  bi: number,
  ci: number,
  e: Event,
) {
  onContactAttributeValue(gi, bi, ci, (e.target as HTMLSelectElement).value);
}
function onContactAttributeValue(
  gi: number,
  bi: number,
  ci: number,
  attrId: string,
) {
  mutate(gi, bi, ci, (c) => {
    const attr = getContactAttribute(attrId);
    return {
      ...c,
      field: attrId,
      operator: attr ? defaultOperatorForType(attr.type) : '',
      values: [],
    };
  });
}

/** Template helper — currently-allowed operators for a contact row. */
function operatorsForContactRow(c: DDCondition): ContactOperator[] {
  if (c.category === 'tags') {
    return operatorsForAttribute(TAGS_ATTRIBUTE);
  }
  const attr = getContactAttribute(c.field);
  if (!attr) return [];
  return operatorsForAttribute(attr);
}

/** Template helper — currently-allowed attributes for a contact row. */
function attributesForContactRow(c: DDCondition): ContactAttribute[] {
  const cat = c.category as ContactCategory;
  if (!cat || cat === 'tags') return [];
  return attributesForCategory(cat);
}

/** Template helper — the operator's arity (0 = no value, 1 = one value,
 *  2 = range). Drives which value inputs render. */
function operatorArity(c: DDCondition): 0 | 1 | 2 {
  const ops = operatorsForContactRow(c);
  return ops.find((o) => o.id === c.operator)?.arity ?? 1;
}

/** Template helper — should we render the enum <select> for the value
 *  input? True only when the attribute has enumValues. */
function contactValueEnumFor(c: DDCondition): string[] | null {
  const attr = getContactAttribute(c.field);
  return attr?.enumValues ?? null;
}

/** Template helper — input type for free-text/date/numeric value inputs. */
function contactInputType(c: DDCondition): string {
  const attr = getContactAttribute(c.field);
  if (!attr) return 'text';
  if (attr.type === 'date') return 'date';
  if (attr.type === 'numeric') return 'number';
  return 'text';
}

/** Static lists exposed to the template. */
const CONTACT_CATEGORIES: { id: ContactCategory; label: string }[] = [
  { id: 'tags', label: categoryLabel('tags') },
  { id: 'standard', label: categoryLabel('standard') },
  { id: 'constant', label: categoryLabel('constant') },
  { id: 'custom', label: categoryLabel('custom') },
];

/** Scope options — kept for backward compat with the AI-assistant
 *  conversational scope picks. The UI no longer renders this as a
 *  separate dropdown (Contact lives as a sibling inside the field
 *  dropdown instead). */
const SCOPE_OPTIONS = [
  { value: 'deal', label: 'Deal' },
  { value: 'contact', label: 'Contact’s' },
];

/** Field list active for this diamond — scoped to the closest upstream
 *  trigger's attributes when one of the known triggers
 *  (Product is purchased / Quote status / Pipeline stage is moved /
 *  Appointment) feeds this diamond. Falls back to the default Deal
 *  field set otherwise. Filters out conditionally-hidden fields
 *  (e.g. Products only appears when Purchase type = "Product"). */
const activeTriggerFields = computed<SimpleField[] | TriggerField[]>(() => {
  if (props.triggerSlug && isKnownTriggerSlug(props.triggerSlug)) {
    const schema = TRIGGER_FIELDS[props.triggerSlug];
    // Apply conditional show/hide rules. A field with
    // `conditionalOn: { fieldId, equals }` only appears when at least
    // one configured rule on this diamond has that fieldId set to the
    // matching value.
    return schema.filter((f) => {
      if (!f.conditionalOn) return true;
      const required = f.conditionalOn;
      return props.config.groups.some((g) =>
        g.blocks.some((b) =>
          b.conditions.some(
            (c) =>
              c.field === required.fieldId &&
              c.values.includes(required.equals),
          ),
        ),
      );
    });
  }
  return SIMPLE_FIELDS;
});

/** The unified "field or Contact" options shown in the first dropdown
 *  of every rule row. Recomputes when the upstream trigger changes
 *  (e.g. user reconnects the diamond to a different trigger). */
const FIELD_OR_CONTACT_OPTIONS = computed(() => [
  ...activeTriggerFields.value.map((f) => ({ value: f.id, label: f.label })),
  { value: 'contact', label: 'Contact' },
]);

/** Dummy tag list for the Tag value picker. Production would extract
 *  tags from the upstream sequence connected to this decision diamond
 *  (so the user can only pick tags actually applied by earlier steps).
 *  For the prototype we hand-pick a representative sample matching the
 *  common SMB CRM tagging patterns. */
const DUMMY_TAG_OPTIONS = [
  { value: 'vip', label: 'VIP' },
  { value: 'newsletter-subscriber', label: 'Newsletter Subscriber' },
  { value: 'webinar-attendee', label: 'Webinar Attendee' },
  { value: 'demo-requested', label: 'Demo Requested' },
  { value: 'high-value-lead', label: 'High-Value Lead' },
  { value: 'past-customer', label: 'Past Customer' },
  { value: 'cold-lead', label: 'Cold Lead' },
  { value: 'referral', label: 'Referral' },
  { value: 'partner', label: 'Partner' },
  { value: 'opted-out', label: 'Opted Out' },
];

// Re-exports to keep the template's bindings clean
void STANDARD_CONTACT_FIELDS;
void CONSTANT_CONTACT_FIELDS;
void CUSTOM_CONTACT_FIELDS;

function cloneConfig(): DecisionDiamondConfig {
  return {
    ...props.config,
    groups: props.config.groups.map((g) => ({
      ...g,
      blocks: g.blocks.map((b) => ({
        ...b,
        conditions: b.conditions.map((c) => ({ ...c, values: [...c.values] })),
      })),
    })),
  };
}

// ===================================================================
// Default routing
// ===================================================================

const defaultRoutingOptions = computed(() => {
  const seqOpts = props.config.groups.map((g, i) => ({
    value: g.targetFlowId || `__seq-${i}__`,
    label: `Sequence ${i + 1}`,
  }));
  return [
    { value: '__drop__', label: "Don't put them in a sequence" },
    ...seqOpts,
  ];
});

function onDefaultRouting(e: Event) {
  const v = (e.target as HTMLSelectElement).value;
  emit('update:config', { ...props.config, defaultRouting: v });
}

function onDefaultRoutingValue(v: string) {
  emit('update:config', { ...props.config, defaultRouting: v });
}

// ===================================================================
// Init: ensure two sequence cards always exist (matches screenshots).
// ===================================================================

// Guarantee at least one sequence card exists on first open, but allow the
// user to delete back down to exactly one — never below.
watch(
  () => props.config.groups.length,
  (n) => {
    if (n < 1) ensureGroups(1);
  },
  { immediate: true },
);

// ===================================================================
// Chat feedback on user-driven config changes
// ===================================================================

let lastConfigSnapshot = serializeConfig(props.config);
let chatGreeted = false;

function serializeConfig(cfg: DecisionDiamondConfig): string {
  return JSON.stringify({
    groups: cfg.groups.map((g) => ({
      id: g.id,
      flow: g.targetFlowId,
      blocks: g.blocks.map((b) => ({
        id: b.id,
        conds: b.conditions.map((c) => ({
          f: c.field,
          o: c.operator,
          v: c.values,
        })),
      })),
    })),
    routing: cfg.defaultRouting,
  });
}

function summarizeConfigChange(
  prev: DecisionDiamondConfig,
  next: DecisionDiamondConfig,
): string | null {
  // Sequence count changed
  if (next.groups.length > prev.groups.length) {
    return `Added Sequence ${next.groups.length}. Pick a field to start its rule.`;
  }
  if (next.groups.length < prev.groups.length) {
    return `Removed a sequence. You now have ${next.groups.length} sequence${next.groups.length === 1 ? '' : 's'}.`;
  }

  // Default routing changed
  if (next.defaultRouting !== prev.defaultRouting) {
    if (next.defaultRouting === '__drop__') {
      return 'Default routing set to "Don\'t put them in a sequence". Anything that doesn\'t match a rule will be dropped.';
    }
    const idx = next.groups.findIndex(
      (g) => (g.targetFlowId || `__seq-${next.groups.indexOf(g)}__`) === next.defaultRouting,
    );
    if (idx >= 0) {
      return `Default routing now goes to Sequence ${idx + 1}.`;
    }
  }

  // Look for the first changed condition
  for (let gi = 0; gi < next.groups.length; gi++) {
    const ng = next.groups[gi];
    const pg = prev.groups[gi];
    if (!pg) continue;

    if (ng.blocks.length > pg.blocks.length) {
      return `Added a new OR-joined rule to Sequence ${gi + 1}.`;
    }
    if (ng.blocks.length < pg.blocks.length) {
      return `Removed a rule from Sequence ${gi + 1}.`;
    }

    for (let bi = 0; bi < ng.blocks.length; bi++) {
      const nb = ng.blocks[bi];
      const pb = pg.blocks[bi];
      if (!pb) continue;
      if (nb.conditions.length > pb.conditions.length) {
        return `Added an AND condition to Sequence ${gi + 1}.`;
      }
      if (nb.conditions.length < pb.conditions.length) {
        return `Removed a condition from Sequence ${gi + 1}.`;
      }
      for (let ci = 0; ci < nb.conditions.length; ci++) {
        const nc = nb.conditions[ci];
        const pc = pb.conditions[ci];
        if (!pc) continue;
        if (nc.field !== pc.field) {
          if (!nc.field) {
            return `Cleared the field for a rule in Sequence ${gi + 1}.`;
          }
          return `Now reading "${describeField(nc.field)}" in Sequence ${gi + 1}. Pick an operator next.`;
        }
        if (nc.operator !== pc.operator) {
          const opLabel =
            SIMPLE_OPERATORS.find((o) => o.value === nc.operator)?.label ||
            nc.operator;
          return `Sequence ${gi + 1}: comparing ${describeField(nc.field)} with "${opLabel}". Add a value to finish.`;
        }
        if (JSON.stringify(nc.values) !== JSON.stringify(pc.values)) {
          if (nc.field && nc.operator && nc.values.some((v) => v !== '')) {
            return `Sequence ${gi + 1} rule complete: ${describeCondition(nc)}.`;
          }
        }
      }
    }
  }
  return null;
}

// Live mirror of props.config used by the diff so we can describe changes
// in natural language. Stored as a shallowRef + plain deep-clone so Vue
// doesn't traverse the whole config tree on every snapshot.
const lastFullSnapshot = shallowRef<DecisionDiamondConfig>(
  JSON.parse(JSON.stringify(props.config)),
);

// Undo stack: snapshots of prior config states (most recent at the end).
// shallowRef avoids deep-reactivity overhead across 10 cloned configs.
const MAX_UNDO_HISTORY = 10;
const undoHistory = shallowRef<DecisionDiamondConfig[]>([]);

/** Snapshot the assistant has offered to restore but hasn't confirmed yet. */
const pendingUndo = shallowRef<DecisionDiamondConfig | null>(null);

/** Newly-opened empty rule slot the assistant is helping the user fill. */
const pendingFillSlot = shallowRef<{
  gi: number;
  bi: number;
  ci: number;
} | null>(null);

/** Sequence card the AI just mutated — drives a brief pulse highlight so
 *  the user can see where the preview just changed. Cleared after ~1.2s. */
const recentlyUpdatedGi = ref<number | null>(null);
let flashTimer: number | undefined;

function flashSequenceCard(gi: number) {
  if (gi < 0) return;
  recentlyUpdatedGi.value = gi;
  // Scroll the affected card into view on the next tick (so the DOM has
  // the new row rendered before we measure it).
  void nextTick(() => {
    const cards = document.querySelectorAll<HTMLElement>('.dd-rules .dd-card');
    cards[gi]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  if (flashTimer) window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => {
    recentlyUpdatedGi.value = null;
  }, 1200);
}

/** A recipe the user just placed that we can offer to mirror elsewhere. */
const mirrorOffer = shallowRef<{
  recipe: ConditionRecipe;
  sourceGi: number;
  targetGis: number[];
} | null>(null);

// Debounce so rapid keystrokes (e.g. typing into a number input) coalesce
// into a single feedback note rather than spamming the chat one char at a
// time. Also avoids deep-cloning the config on every keystroke.
let feedbackTimer: number | undefined;
const FEEDBACK_DEBOUNCE_MS = 350;

/** Length of the AI "thinking" indicator before a generation/apply
 *  resolves. Long enough that the spinning diamond reads as real
 *  data processing (~doubled from a snappy 350ms feel). */
/* AI pacing — longer + jittered + with a transition (composing) phase
 * so responses feel like real generation rather than canned delays. */
const AI_THINKING_MS = 1600;      // spinning-diamond phase (was 800)
const AI_TRANSITION_MS = 900;     // composing-shimmer phase (new)
const AI_FOLLOWUP_MS = 2000;      // followup notes (was 1200)
const AI_JITTER_MS = 500;         // ± half this added per phase

/** Add organic ± random jitter to a base duration so two consecutive
 *  AI replies don't have identical timing. */
function withJitter(base: number) {
  return Math.max(150, base + (Math.random() - 0.5) * AI_JITTER_MS);
}

watch(
  () => props.config,
  (next) => {
    const snapshot = serializeConfig(next);
    if (snapshot === lastConfigSnapshot) return;
    lastConfigSnapshot = snapshot;
    const wasInternal = isInternalMutation.value;

    if (feedbackTimer) window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => {
      feedbackTimer = undefined;

      // Snapshot the previous state, advance the live mirror, and push
      // the previous state onto the undo stack.
      const prev = lastFullSnapshot.value;
      lastFullSnapshot.value = JSON.parse(JSON.stringify(next));
      undoHistory.value = [
        ...undoHistory.value,
        prev,
      ].slice(-MAX_UNDO_HISTORY);

      if (wasInternal) return;
      if (!aiOpen.value || !chatGreeted) return;

      const summary = summarizeConfigChange(prev, next);
      if (summary) postNote(summary);
    }, FEEDBACK_DEBOUNCE_MS);
  },
  { deep: true },
);

// Enable chat feedback once the AI pane is open. If the diamond was
// configured manually before the user enabled the assistant, the welcome
// is state-aware — the assistant reads the live config and offers to
// help against it instead of showing the empty-state template starters.
watch(
  aiOpen,
  (open) => {
    if (open && !chatGreeted) {
      chatGreeted = true;
      // Defer one microtask so the chat panel transition starts first.
      void nextTick(() => {
        void maybePostStateAwareWelcome();
      });
    }
  },
  { immediate: true },
);

/** True when any sequence has at least one fully-specified condition
 *  (field set). Empty sequences or sequences with placeholder rows
 *  don't count — they wouldn't read well in a summary. */
function hasAnyConfiguredRules(): boolean {
  return props.config.groups.some((g) =>
    g.blocks.some((b) => b.conditions.some((c) => c.field)),
  );
}

/** State-aware greeting. Runs once, only when:
 *  - The user just toggled AI on
 *  - The transcript is empty (so we're at the welcome state)
 *  - The config already has at least one configured rule
 *
 *  Streams a summary of the current state and queues continuation
 *  pills tied to the first sequence with rules so the user gets a
 *  one-click way to keep building. */
async function maybePostStateAwareWelcome() {
  if (transcript.value.length > 0) return;
  if (!hasAnyConfiguredRules()) return; // empty config → keep template welcome

  const summary = summarizeConfig(props.config);
  const intro = "I see your decision diamond is already set up:\n";
  const closer =
    "\n\nHow can I help? Ask me to add or remove rules, mirror conditions across sequences, change the default routing, or explain what's set up.";

  await streamAssistantText(intro + summary + closer);

  // Surface helpful next-step pills tied to the first sequence with
  // configured rules. Reuses the 'added-condition' continuation shape
  // because its pill set ("+ Add another condition (AND)" / "+ Add an
  // OR rule group" / "Done") is exactly the right "what next?" menu.
  const firstWithRules = props.config.groups.findIndex((g) =>
    g.blocks.some((b) => b.conditions.some((c) => c.field)),
  );
  if (firstWithRules !== -1) {
    lastMutatedSeqIdx.value = firstWithRules;
    continuationContext.value = {
      kind: 'added-condition',
      sequenceIndex: firstWithRules,
    };
  }
}

// When the user finishes filling the slot they just opened (field + op +
// value all set), follow up: offer to mirror this exact condition to any
// other sequence that already has rules but doesn't yet use this field.
watch(
  () => {
    const slot = pendingFillSlot.value;
    if (!slot) return null;
    const cond =
      props.config.groups[slot.gi]?.blocks[slot.bi]?.conditions[slot.ci];
    if (!cond) return null;
    const hasValueAndOp =
      cond.operator === 'between'
        ? (cond.values[0] || '') !== '' && (cond.values[1] || '') !== ''
        : (cond.values[0] || '') !== '';
    return { cond, complete: Boolean(cond.field && cond.operator && hasValueAndOp) };
  },
  (state) => {
    if (!state || !state.complete) return;
    const slot = pendingFillSlot.value;
    if (!slot) return;
    const c = state.cond;
    const recipe: ConditionRecipe = {
      id: `inferred-${slot.gi}-${slot.bi}-${slot.ci}`,
      label: describeCondition(c),
      field: c.field as SimpleFieldId,
      operator: c.operator,
      values: [...c.values],
    };
    const sourceGi = slot.gi;
    pendingFillSlot.value = null;

    const targets = props.config.groups
      .map((g, i) => ({ g, i }))
      .filter(
        ({ g, i }) =>
          i !== sourceGi &&
          g.blocks.some((b) => b.conditions.length > 0) &&
          !collectFieldsInUse(g).has(recipe.field),
      )
      .map(({ i }) => i);

    if (targets.length === 0) return;

    isThinking.value = true;
    window.setTimeout(() => {
      isThinking.value = false;
      mirrorOffer.value = { recipe, sourceGi, targetGis: targets };
      const labels = targets.map((i) => `Sequence ${i + 1}`).join(' or ');
      postNote(
        `Sequence ${sourceGi + 1} is set. Want to apply "${recipe.label}" to ${labels} too for symmetry?`,
      );
    }, withJitter(AI_FOLLOWUP_MS));
  },
);

// ===================================================================
// Focus management & keyboard handling
// ===================================================================

function trapFocus(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !rootEl.value) return;
  const focusables = rootEl.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

function onKeydown(e: KeyboardEvent) {
  // The decision-diamond editor only closes through the explicit
  // Close (✕) or Save button — never via ESC or backdrop click, so
  // user mid-edit can't lose work to an accidental keystroke.
  trapFocus(e);
}

onMounted(() => {
  previouslyFocused.value = document.activeElement as HTMLElement | null;
  document.addEventListener('keydown', onKeydown);
  void nextTick(() => {
    // Move focus into the modal so screen readers and keyboard users land
    // inside the dialog rather than on the trigger behind it.
    rootEl.value?.focus();
    // Track the body width so the resizer's max clamp scales with viewport.
    trackContainerWidth();
    if (bodyEl.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => trackContainerWidth());
      resizeObserver.observe(bodyEl.value);
    }
  });
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = undefined;
  }
  if (feedbackTimer) {
    window.clearTimeout(feedbackTimer);
    feedbackTimer = undefined;
  }
  // Return focus to the element that opened the dialog.
  const prev = previouslyFocused.value;
  if (prev && typeof prev.focus === 'function') {
    prev.focus();
  }
});
</script>

<style scoped>
/* Screen-reader-only utility */
.visually-hidden {
  position: absolute !important;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Honor user reduced-motion preference */
@media (prefers-reduced-motion: reduce) {
  .dd-suggest-chip,
  .dd-add-rule,
  .dd-rule__remove,
  .dd-ai__thinking-dot {
    transition: none !important;
    animation: none !important;
  }
}

/* ===================== Overlay & shell ===================== */
.dd-editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 36, 0.4);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  /* Block the macOS trackpad two-finger swipe-to-go-back so the user
     can't accidentally navigate away mid-edit. */
  overscroll-behavior: none;
}
.dd-editor {
  background: var(--dex-color-white, #fff);
  width: 100%;
  max-width: 1280px;
  height: 100%;
  max-height: min(900px, calc(100vh - 64px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.3);
  font-family: var(--dex-fontFamily-sans, 'Inter', system-ui, sans-serif);
}

/* ===================== Header ===================== */
.dd-editor__header {
  display: flex;
  align-items: center;
  gap: var(--dex-spacing-100, 12px);
  padding: var(--dex-spacing-100, 12px) var(--dex-spacing-200, 20px);
  border-bottom: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
  background: #fff;
  flex-shrink: 0;
}
.dd-editor__title {
  margin: 0;
  font-weight: 600;
}
.dd-editor__header-actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: var(--dex-spacing-150, 16px);
}
.dd-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--dex-spacing-075, 8px);
  cursor: pointer;
  user-select: none;
}
.dd-toggle :deep(button[role='switch']) {
  background: var(--dex-color-gray-300, #d1d5db);
}
.dd-toggle :deep(button[role='switch'][data-state='checked']) {
  background: var(--dex-color-blue-700, #006ceb);
}

/* ===================== Body layout ===================== */
.dd-editor__body {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(360px, 480px) 1fr;
  overflow: hidden;
  background: var(--dex-page-bgColor, #f9fafb);
}
.dd-editor__body--single {
  grid-template-columns: 1fr;
}

/* ---------- Draggable resizer ---------- */
.dd-resizer {
  position: relative;
  cursor: col-resize;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  z-index: 1;
}
.dd-resizer::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 1px;
  background: var(--dex-borderColor-alpha-subtle, #e5e7eb);
  transition: background 0.15s ease, width 0.15s ease;
}
.dd-resizer:hover::before,
.dd-resizer:focus-visible::before,
.dd-resizer--active::before {
  width: 3px;
  background: var(--dex-color-blue-700, #006ceb);
}
.dd-resizer:focus-visible {
  outline: none;
}
.dd-resizer__grip {
  position: relative;
  width: 4px;
  height: 32px;
  border-radius: 2px;
  background: var(--dex-color-gray-300, #d1d5db);
  opacity: 0;
  transition: opacity 0.12s ease, background 0.12s ease;
}
.dd-resizer:hover .dd-resizer__grip,
.dd-resizer:focus-visible .dd-resizer__grip,
.dd-resizer--active .dd-resizer__grip {
  opacity: 1;
  background: var(--dex-color-blue-700, #006ceb);
}

@media (prefers-reduced-motion: reduce) {
  .dd-resizer::before,
  .dd-resizer__grip {
    transition: none;
  }
}

/* ===================== Left: AI assistant ===================== */
.dd-ai {
  display: flex;
  flex-direction: column;
  background: #fff;
  min-height: 0;
  min-width: 0;
}

.dd-ai__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
  flex-shrink: 0;
}
.dd-ai__header-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.dd-ai__header-title :deep(h3) {
  margin: 0;
  font-weight: 600;
}
.dd-ai__reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--dex-borderColor-default, #d1d5db);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--dex-fgColor-default, #272727);
  cursor: pointer;
  --dex-icon-size: 14px;
}
.dd-ai__reset-btn:hover {
  background: var(--dex-color-gray-100, #f3f4f6);
  border-color: var(--dex-color-gray-400, #9ca3af);
}
.dd-ai__reset-btn:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: 2px;
}
.dd-diamond--lg {
  width: 14px;
  height: 14px;
}
.dd-ai__transcript {
  flex: 1;
  overflow-y: auto;
  padding: var(--dex-spacing-150, 16px) var(--dex-spacing-200, 20px);
  display: flex;
  flex-direction: column;
  gap: var(--dex-spacing-150, 16px);
}

/* ---------- Welcome / empty state ---------- */
.dd-ai__welcome {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding-top: 32px;
}
.dd-ai__welcome-title {
  margin: 0;
  font-weight: 600;
  text-align: center;
}
.dd-ai__welcome-sub {
  margin: 0;
  text-align: center;
  color: var(--dex-fgColor-muted, #6b7280);
}
.dd-ai__starters {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.dd-starter-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: border-color 0.12s ease, background 0.12s ease;
  /* Cap the card at its default width — never grows past this even
     when the AI assistant pane is resized wider. */
  width: 100%;
  max-width: 380px;
  align-self: center;
  box-sizing: border-box;
}
.dd-starter-card:hover {
  border-color: var(--dex-color-blue-700, #006ceb);
  background: var(--dex-color-blue-50, #eff6ff);
}
.dd-starter-card:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: 2px;
}
.dd-starter-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dex-fgColor-default, #272727);
}
.dd-starter-card__desc {
  font-size: 13px;
  color: var(--dex-fgColor-muted, #6b7280);
}

/* ---------- Assistant chat bubble (no avatar) ---------- */
.dd-ai__assistant-bubble {
  display: flex;
  max-width: 100%;
}
.dd-ai__assistant-body {
  flex: 1;
  min-width: 0;
  text-align: left;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.dd-ai__assistant-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dex-fgColor-default, #272727);
  margin-bottom: 4px;
}
.dd-ai__note-text {
  margin: 0;
  padding: 2px 0;
  background: transparent;
  font-size: 14px;
  color: var(--dex-fgColor-default, #272727);
  line-height: 1.5;
  white-space: pre-wrap;
  max-width: 100%;
}
.dd-ai__branch-list {
  list-style: none;
  padding: 0;
  margin: 6px 0 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dd-ai__branch-item {
  font-size: 14px;
  color: var(--dex-fgColor-default, #272727);
  padding-left: 12px;
  position: relative;
  line-height: 1.5;
}
.dd-ai__branch-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--dex-color-blue-700, #006ceb);
}

/* ---------- Quick replies ---------- */
.dd-ai__quick-replies {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: -4px;
}
.dd-quick-reply-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dd-quick-reply-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--dex-fgColor-default, #272727);
  letter-spacing: normal;
  text-transform: none;
}
.dd-quick-reply-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  /* Allow children to shrink below their content width without growing */
  min-width: 0;
}
.dd-quick-reply {
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  /* Fixed content-width — pills never grow with the panel. They stay
     at their natural label width regardless of available space. */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: max-content;
  max-width: 100%;
  flex: 0 0 auto;
  line-height: 1.3;
  box-sizing: border-box;
}
.dd-quick-reply:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: 2px;
}

/* Both edit and template pills share the outlined style — the section
 * headings ("Edit rules" / "Suggestions on other logic starter")
 * carry the differentiation. */
.dd-quick-reply--edit,
.dd-quick-reply--template {
  background: #fff;
  color: var(--dex-color-blue-700, #006ceb);
  border-color: var(--dex-color-blue-700, #006ceb);
}
.dd-quick-reply--edit:hover,
.dd-quick-reply--template:hover {
  background: var(--dex-color-blue-50, #eff6ff);
}
.dd-ai__message {
  display: flex;
  flex-direction: column;
  gap: var(--dex-spacing-075, 8px);
}
.dd-ai__message--user {
  align-items: flex-end;
}
.dd-ai__user-bubble {
  background: var(--dex-color-blue-100, #dbeafe);
  color: var(--dex-color-blue-900, #1e3a8a);
  padding: 8px 12px;
  border-radius: 14px 14px 4px 14px;
  font-size: 13px;
  max-width: 80%;
}
.dd-ai__chip-row {
  display: flex;
  justify-content: flex-end;
}
.dd-ai__lead {
  margin: 0;
  color: var(--dex-fgColor-default, #272727);
  font-size: 14px;
  line-height: 1.5;
}
.dd-ai__plan {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
  color: var(--dex-fgColor-default, #272727);
}
.dd-ai__plan-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 0;
  font-weight: 600;
}
.dd-ai__plan-title {
  margin: 0 0 0 18px;
  font-weight: 600;
}
.dd-ai__plan-body {
  margin: 0 0 0 18px;
  color: var(--dex-fgColor-muted, #4b5563);
}
.dd-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.dd-dot--green {
  background: #16a34a;
}
.dd-dot--blue {
  background: #006ceb;
}
.dd-diamond {
  width: 10px;
  height: 10px;
  background: var(--dex-color-blue-700, #006ceb);
  display: inline-block;
  transform: rotate(45deg);
  margin: 0 1px;
}
.dd-ai__steps {
  margin: 4px 0 0 18px;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dd-ai__steps li {
  font-size: 14px;
}
.dd-ai__step-decision {
  margin-top: 2px;
  color: var(--dex-fgColor-default, #272727);
  font-weight: 400;
}
.dd-ai__step-next {
  margin-top: 4px;
  color: var(--dex-fgColor-muted, #4b5563);
  font-weight: 400;
  font-size: 13px;
}
.dd-ai__step-next-label {
  font-weight: 600;
  color: var(--dex-fgColor-muted, #4b5563);
}
.dd-ai__alert-row {
  margin-top: 4px;
  align-self: stretch;
}
.dd-ai__alert-row :deep(.dex-inline-alert) {
  width: 100%;
}

/* ===================== Composer ===================== */
.dd-ai__composer {
  border-top: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
  padding: var(--dex-spacing-150, 16px) var(--dex-spacing-200, 20px);
  display: flex;
  flex-direction: column;
  gap: var(--dex-spacing-100, 12px);
  background: #fff;
  flex-shrink: 0;
}
.dd-ai__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dd-ai__browse-all {
  background: transparent;
  border: 0;
  color: var(--dex-color-blue-700, #006ceb);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  align-self: center;
}
.dd-ai__browse-all:hover {
  background: var(--dex-color-blue-50, #eff6ff);
  text-decoration: underline;
}
.dd-ai__browse-all:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: 2px;
}
.dd-suggest-chip {
  border: 1px solid var(--dex-color-blue-700, #006ceb);
  color: var(--dex-color-blue-700, #006ceb);
  background: #fff;
  padding: 8px 16px;
  min-height: 36px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s ease;
}
.dd-suggest-chip:hover {
  background: var(--dex-color-blue-50, #eff6ff);
}
.dd-suggest-chip:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: 2px;
}
.dd-suggest-chip--applied {
  cursor: default;
  background: #fff;
  font-weight: 500;
}
.dd-ai__input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--dex-borderColor-alpha-subtle, #d1d5db);
  border-radius: 10px;
  padding: 4px 4px 4px 8px;
  background: #fff;
}
.dd-ai__input-row:focus-within {
  border-color: var(--dex-color-blue-700, #006ceb);
}
.dd-ai__attach {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 0;
  background: transparent;
  color: var(--dex-fgColor-default, #272727);
  font-size: 18px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dd-ai__attach:hover {
  background: var(--dex-color-gray-100, #f3f4f6);
}
.dd-ai__attach:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: 2px;
}
.dd-ai__input {
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: var(--dex-fgColor-default, #272727);
  height: 32px;
}
.dd-ai__input::placeholder {
  color: var(--dex-color-gray-500, #9ca3af);
}

/* ===================== Right: rule cards ===================== */
.dd-rules {
  overflow-y: auto;
  padding: var(--dex-spacing-200, 20px) var(--dex-spacing-200, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--dex-spacing-150, 16px);
}
.dd-rules--centered {
  align-items: center;
}
.dd-rules--centered > .dd-card,
.dd-rules--centered > .dd-add-sequence-row,
.dd-rules--centered > .dd-default {
  width: 100%;
  max-width: 720px;
}

.dd-card {
  background: #fff;
  border: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  transition: opacity 0.12s ease, box-shadow 0.12s ease;
}
.dd-card--dragging {
  opacity: 0.4;
}
.dd-card--drag-target {
  box-shadow: inset 0 0 0 2px var(--dex-color-blue-700, #006ceb);
}

/* Brief pulse on the sequence card the AI just mutated. Tells the user
 * where to look so a chat prompt visibly lands in the preview. */
.dd-card--just-updated {
  animation: dd-card-pulse 1.1s ease-out 1;
}
@keyframes dd-card-pulse {
  0% {
    box-shadow:
      0 0 0 0 rgba(131, 88, 241, 0.55),
      inset 0 0 0 2px rgba(131, 88, 241, 0.85);
    background: #f8f5ff;
  }
  60% {
    box-shadow:
      0 0 0 8px rgba(131, 88, 241, 0),
      inset 0 0 0 2px rgba(131, 88, 241, 0.45);
    background: #fcfaff;
  }
  100% {
    box-shadow:
      0 0 0 0 rgba(131, 88, 241, 0),
      inset 0 0 0 0 rgba(131, 88, 241, 0);
    background: #fff;
  }
}
@media (prefers-reduced-motion: reduce) {
  .dd-card--just-updated {
    animation: none;
    box-shadow: inset 0 0 0 2px rgba(131, 88, 241, 0.6);
  }
}

/* ---------- Drop indicator (snap line between cards) ---------- */
.dd-drop-indicator {
  height: 3px;
  border-radius: 999px;
  background: var(--dex-color-blue-700, #006ceb);
  margin: -8px 0;
  position: relative;
  z-index: 1;
}
.dd-drop-indicator::before,
.dd-drop-indicator::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dex-color-blue-700, #006ceb);
  transform: translateY(-50%);
}
.dd-drop-indicator::before {
  left: -4px;
}
.dd-drop-indicator::after {
  right: -4px;
}

/* ---------- Drag handle ---------- */
.dd-card__drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 32px;
  margin-right: 4px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: var(--dex-color-gray-500, #9ca3af);
  cursor: grab;
  --dex-icon-size: 16px;
  flex-shrink: 0;
  position: relative;
  align-self: flex-start;
  margin-top: 2px;
}
.dd-card__drag-handle :deep(svg) {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}
.dd-card__drag-handle :deep(svg:first-child) {
  left: 2px;
}
.dd-card__drag-handle :deep(svg:last-child) {
  right: 2px;
}
.dd-card__drag-handle:hover {
  color: var(--dex-fgColor-default, #272727);
  background: var(--dex-color-gray-100, #f3f4f6);
}
.dd-card__drag-handle:active {
  cursor: grabbing;
}
.dd-card__drag-handle:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: 2px;
}
.dd-card__header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: var(--dex-spacing-150, 16px) var(--dex-spacing-200, 20px);
  border-bottom: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
}
.dd-card__title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dd-card__title :deep(h4) {
  margin: 0;
  font-weight: 600;
}
.dd-card__body {
  padding: var(--dex-spacing-150, 16px) var(--dex-spacing-200, 20px);
  display: flex;
  flex-direction: column;
  gap: var(--dex-spacing-100, 12px);
}

.dd-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}
.dd-rule__actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  --dex-icon-size: 18px;
}
.dd-rule__action-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 0;
  background: transparent;
  color: var(--dex-fgColor-muted, #6b7280);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.dd-rule__action-btn:hover {
  background: var(--dex-color-gray-100, #f3f4f6);
  color: var(--dex-fgColor-default, #272727);
}
.dd-rule__action-btn:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: 1px;
}

.dd-and-btn {
  align-self: flex-start;
  background: transparent;
  border: 0;
  color: var(--dex-color-blue-700, #006ceb);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0;
  margin-left: 0;
}
.dd-and-btn:hover {
  text-decoration: underline;
}
.dd-and-btn:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: 2px;
  border-radius: 4px;
}

.dd-or-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
}
.dd-or-divider__line {
  flex: 1;
  height: 1px;
  background: var(--dex-borderColor-alpha-subtle, #e5e7eb);
}
.dd-or-divider__chip {
  background: var(--dex-color-gray-100, #f3f4f6);
  color: var(--dex-fgColor-default, #272727);
  font-size: 13px;
  font-weight: 500;
  padding: 2px 10px;
  border-radius: 4px;
  flex-shrink: 0;
}
.dd-or-divider--bottom {
  margin-top: 12px;
}
.dd-rule {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
  font-size: 14px;
  min-width: 0;
}
.dd-rule__lead {
  color: var(--dex-fgColor-default, #272727);
  font-weight: 500;
  flex-shrink: 0;
  min-width: 28px;
}
/* Brief pulse highlight on a freshly-added rule row so the user can
   spot where to continue editing. */
.dd-rule--just-added {
  animation: dd-rule-highlight 1.2s ease-out;
  border-radius: 8px;
}
@keyframes dd-rule-highlight {
  0%   { background: var(--dex-color-blue-50, #eff6ff); }
  60%  { background: var(--dex-color-blue-50, #eff6ff); }
  100% { background: transparent; }
}
@media (prefers-reduced-motion: reduce) {
  .dd-rule--just-added {
    animation: none;
  }
}
.dd-rule__select {
  flex-shrink: 0;
  min-width: 0;
}
.dd-rule__and {
  color: var(--dex-fgColor-muted, #6b7280);
  font-size: 13px;
}
.dd-select {
  height: 36px;
  padding: 0 28px 0 12px;
  border: 1px solid var(--dex-borderColor-default, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  background-color: #fff;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23272727' stroke-width='2'><path d='M6 9l6 6 6-6'/></svg>");
  background-repeat: no-repeat;
  background-position: right 8px center;
  appearance: none;
  -webkit-appearance: none;
  min-width: 140px;
  max-width: 180px;
  color: var(--dex-fgColor-default, #272727);
  flex-shrink: 0;
}
.dd-select:focus {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: -1px;
  border-color: transparent;
}
.dd-value-input {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--dex-borderColor-default, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  min-width: 0;
  max-width: 180px;
  flex: 1 1 140px;
  box-sizing: border-box;
}
.dd-value-input:focus {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: -1px;
  border-color: transparent;
}
.dd-value-input-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: 1 1 140px;
  min-width: 0;
  max-width: 180px;
}
.dd-value-input-wrap .dd-value-input {
  flex: 1 1 auto;
  max-width: none;
}
.dd-value-input-prefix {
  position: absolute;
  left: 12px;
  font-size: 14px;
  color: var(--dex-fgColor-muted, #6b7280);
  pointer-events: none;
}
.dd-value-input--currency {
  padding-left: 22px;
}

.dd-add-rule {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 0;
  color: var(--dex-color-blue-700, #006ceb);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0;
}
.dd-add-rule__plus {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--dex-color-blue-700, #006ceb);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
}
.dd-add-rule:hover {
  text-decoration: underline;
}

.dd-add-sequence-row {
  display: flex;
  justify-content: center;
  padding: 4px 0;
  flex-shrink: 0;
}
.dd-add-sequence-plus {
  margin-right: 0;
  font-weight: 600;
}

.dd-info-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--dex-color-gray-100, #f3f4f6);
  color: var(--dex-fgColor-muted, #6b7280);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  --dex-icon-size: 16px;
}
.dd-info-banner :deep(svg) {
  flex-shrink: 0;
}

/* ===================== Default routing ===================== */
.dd-default {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: var(--dex-spacing-200, 20px);
  background: transparent;
  flex-shrink: 0;
}
.dd-default__label {
  text-align: center;
  color: var(--dex-fgColor-default, #272727);
}
.dd-default__select {
  position: relative;
  display: inline-block;
  width: 420px;
  max-width: 100%;
  border: 1px solid var(--dex-borderColor-default, #d1d5db);
  border-radius: 6px;
  background: #fff;
  padding: 14px 16px 10px;
  margin-top: 8px;
}
.dd-default__select:focus-within {
  border-color: var(--dex-color-blue-700, #006ceb);
}
.dd-default__select-label {
  position: absolute;
  top: -8px;
  left: 12px;
  padding: 0 6px;
  background: #fff;
  font-size: 12px;
  color: var(--dex-fgColor-muted, #6b7280);
  line-height: 1;
}
.dd-default__select:focus-within .dd-default__select-label {
  color: var(--dex-color-blue-700, #006ceb);
}
.dd-default__control {
  border: 0 !important;
  width: 100%;
  max-width: none;
  min-width: 0;
  height: 24px;
  padding: 0 32px 0 0;
  font-size: 16px;
  font-weight: 400;
  color: var(--dex-fgColor-default, #272727);
  background-position: right 8px center;
  background-color: transparent;
}
.dd-default__control:focus {
  outline: none;
}
.dd-default__control:focus-visible {
  outline: none;
}

/* ===================== Thinking indicator ===================== */
.dd-ai__thinking {
  display: inline-flex;
  align-items: center;
  padding: 6px 0;
  align-self: flex-start;
}
.dd-diamond--spinning {
  width: 12px;
  height: 12px;
  animation: dd-diamond-spin 1.8s ease-in-out infinite;
}
.dd-diamond--pulsing {
  width: 12px;
  height: 12px;
  animation: dd-diamond-pulse 1.4s ease-in-out infinite;
}
@keyframes dd-diamond-pulse {
  0%,
  100% {
    opacity: 0.55;
    transform: rotate(45deg) scale(1);
  }
  50% {
    opacity: 1;
    transform: rotate(45deg) scale(1.18);
  }
}

/* ---------- Composing (transition) state ---------- */
.dd-ai__composing {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 0;
  align-self: stretch;
}
.dd-ai__composing-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dd-ai__composing-line {
  height: 10px;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.06) 0%,
    rgba(0, 0, 0, 0.12) 50%,
    rgba(0, 0, 0, 0.06) 100%
  );
  background-size: 200% 100%;
  animation: dd-ai-shimmer 1.4s ease-in-out infinite;
}
.dd-ai__composing-line--w55 { width: 55%; }
.dd-ai__composing-line--w70 { width: 70%; }
.dd-ai__composing-line--w90 { width: 90%; }
@keyframes dd-ai-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .dd-diamond--spinning,
  .dd-diamond--pulsing,
  .dd-ai__composing-line {
    animation: none;
  }
}
/* Quarter-turn animation that pauses between each step — gives the
 * sense of "thinking" rather than continuous busy-spinning. */
@keyframes dd-diamond-spin {
  0%,  20% { transform: rotate(45deg); }
  35%, 50% { transform: rotate(135deg); }
  65%, 80% { transform: rotate(225deg); }
  95%, 100% { transform: rotate(315deg); }
}
@media (prefers-reduced-motion: reduce) {
  .dd-diamond--spinning {
    animation: none;
  }
}

/* End-of-conversation marker — a tiny static diamond after the last
 * assistant message signals "I'm done responding". */
.dd-ai__end-marker {
  display: flex;
  align-items: center;
  padding-top: 4px;
}
.dd-ai__end-marker .dd-diamond {
  width: 8px;
  height: 8px;
  opacity: 0.7;
}

/* ===================== Generic focus visibility ===================== */
.dd-select:focus-visible,
.dd-value-input:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: -1px;
  border-color: transparent;
}
.dd-add-rule:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: 2px;
  border-radius: 4px;
}
.dd-editor:focus {
  outline: none;
}

/* ===================== Templates portal popover ===================== */
.dd-templates-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 36, 0.4);
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}
.dd-templates {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 560px;
  max-height: min(640px, 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
}
.dd-templates__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
}
.dd-templates__header :deep(h3) {
  margin: 0;
  font-weight: 600;
}
.dd-templates__search {
  padding: 12px 20px;
  border-bottom: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
}
.dd-templates__search-input {
  width: 100%;
  max-width: none;
  flex: 1 1 auto;
}
.dd-templates__list {
  overflow-y: auto;
  padding: 8px 12px 16px;
}
.dd-templates__empty {
  padding: 24px 12px;
  color: var(--dex-fgColor-muted, #6b7280);
  text-align: center;
  font-size: 14px;
}
.dd-templates__group {
  margin-top: 12px;
}
.dd-templates__group-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--dex-fgColor-muted, #6b7280);
  margin: 0 0 6px 8px;
}
.dd-templates__items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dd-templates__item {
  width: 100%;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-family: inherit;
}
.dd-templates__item:hover:not(:disabled) {
  background: var(--dex-color-blue-50, #eff6ff);
}
.dd-templates__item:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: -1px;
}
.dd-templates__item:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.dd-templates__item-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--dex-fgColor-default, #272727);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.dd-templates__item-desc {
  font-size: 13px;
  color: var(--dex-fgColor-muted, #6b7280);
}
.dd-templates__applied-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: var(--dex-color-gray-200, #e5e7eb);
  color: var(--dex-fgColor-muted, #6b7280);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
