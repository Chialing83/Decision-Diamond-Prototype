<template>
  <div class="tpl-page">
    <header class="tpl-page__header">
      <button
        type="button"
        class="tpl-page__back"
        aria-label="Back to automations"
        @click="router.push('/automations')"
      >
        <DexIcon name="arrow-left" aria-hidden="true" />
        <span>Automations</span>
      </button>
      <DexText variant="display-2" as="h1" class="tpl-page__title">
        Automation Templates
      </DexText>
      <DexText variant="body-1" class="tpl-page__sub">
        Start fast with a pre-built automation, then customize it for your
        business.
      </DexText>
    </header>

    <main class="tpl-page__main" aria-label="Templates">
      <section
        v-for="cat in CATEGORIES"
        :key="cat.id"
        class="tpl-category"
        :aria-labelledby="`tpl-cat-${cat.id}`"
      >
        <h2 :id="`tpl-cat-${cat.id}`" class="tpl-category__title">
          {{ cat.label }}
        </h2>

        <div class="tpl-grid">
          <article
            v-for="t in templatesByCategory(cat.id)"
            :key="t.id"
            class="tpl-card"
            :class="`tpl-card--${cat.id}`"
          >
            <div class="tpl-card__top">
              <span
                class="tpl-chip"
                :style="{ background: cat.chipBg, color: cat.chipFg }"
              >
                <span class="tpl-chip__label">{{ cat.label }}</span>
                <DexIcon :name="cat.icon" aria-hidden="true" />
              </span>
              <button
                type="button"
                class="tpl-card__plus"
                :aria-label="`Install ${t.title}`"
                @click="openInstall(t)"
              >
                <DexIcon name="add-circle" aria-hidden="true" />
              </button>
            </div>
            <div class="tpl-card__body">
              <span class="tpl-card__title">{{ t.title }}</span>
              <span class="tpl-card__desc">{{ t.description }}</span>
            </div>
          </article>
        </div>
      </section>
    </main>

    <!-- Bundle install modal (lg) -->
    <div
      v-if="activeTemplate"
      class="tpl-modal-overlay"
      role="presentation"
      @mousedown.self="closeInstall"
      @keydown.esc="closeInstall"
    >
      <div
        ref="modalEl"
        class="tpl-modal tpl-modal--lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tpl-modal-title"
        tabindex="-1"
      >
        <header class="tpl-modal__header">
          <DexIconButton
            name="x"
            label="Close install dialog"
            @click="closeInstall"
          />
          <DexText
            id="tpl-modal-title"
            variant="heading-4"
            as="h2"
            class="tpl-modal__title"
          >
            Bundle installation
          </DexText>
        </header>

        <div class="tpl-modal__body">
          <div v-if="isLoading" class="tpl-skeleton-stack" aria-busy="true">
            <div class="tpl-skeleton tpl-skeleton--lg" />
            <div class="tpl-skeleton tpl-skeleton--md" />
            <div class="tpl-skeleton tpl-skeleton--sm" />
            <div class="tpl-skeleton tpl-skeleton--lg" />
            <div class="tpl-skeleton tpl-skeleton--md" />
            <span class="visually-hidden">Loading bundle details…</span>
          </div>

          <div v-else class="tpl-install">
            <!-- Bundle title -->
            <span class="tpl-install__bundle-title">
              {{ bundleTitle(activeTemplate) }}
            </span>

            <!-- Partner logo placeholder -->
            <div class="tpl-install__logo-wrapper" aria-hidden="true">
              <div class="tpl-install__logo">
                {{ activeTemplate.title.charAt(0) }}
              </div>
            </div>

            <span class="tpl-install__meta-label">Created by</span>
            <span class="tpl-install__author">Pebble Partner</span>

            <span class="tpl-install__meta-label">Edition compatibility</span>
            <div class="tpl-install__status">
              <span class="tpl-install__status-dot" aria-hidden="true" />
              <span class="tpl-install__status-text">All</span>
            </div>

            <div class="tpl-install__divider" role="separator" />

            <!-- Step 1: Install button -->
            <DexButton
              v-if="installStep === 'details'"
              variant="solid"
              class="tpl-install__install-btn"
              @click="goToTerms"
            >
              <DexIcon name="download" aria-hidden="true" />
              Install
            </DexButton>

            <!-- Step 2: Terms + Accept / Decline -->
            <section
              v-else
              class="tpl-install__terms"
              aria-labelledby="tpl-terms-title"
            >
              <h3
                id="tpl-terms-title"
                class="tpl-install__terms-title"
              >
                Terms and conditions
              </h3>
              <p class="tpl-install__terms-body">
                By installing this bundle you agree to the partner's terms of
                use. Bundle content is provided as-is and may be updated by
                its author. You can review what's included below and remove
                the bundle from your account at any time.
              </p>
              <div class="tpl-install__terms-actions">
                <DexButton variant="solid" @click="acceptInstall">
                  Accept and continue
                </DexButton>
                <DexButton variant="outline" @click="installStep = 'details'">
                  Decline
                </DexButton>
              </div>
            </section>

            <!-- Bundle items accordion -->
            <span class="tpl-install__bundle-items-label">Bundle items</span>
            <div class="tpl-install__accordion">
              <button
                type="button"
                class="tpl-install__accordion-header"
                :aria-expanded="accordionOpen"
                @click="accordionOpen = !accordionOpen"
              >
                <DexIcon
                  :name="accordionOpen ? 'chevron-down' : 'chevron-right'"
                  aria-hidden="true"
                />
                <span class="tpl-install__accordion-title">
                  Automation Builder
                </span>
                <span class="tpl-install__accordion-count">
                  {{ activeTemplate.includes.length }} selected
                </span>
              </button>
              <div v-if="accordionOpen" class="tpl-install__accordion-body">
                <div
                  v-for="(item, i) in activeTemplate.includes"
                  :key="i"
                  class="tpl-install__accordion-item"
                >
                  <span class="tpl-install__status-dot" aria-hidden="true" />
                  <span class="tpl-install__status-text">All</span>
                  <span class="tpl-install__accordion-item-name">
                    {{ item }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  DexIcon,
  DexIconButton,
  DexText,
  DexButton,
  DexInlineAlert,
} from '@thryvlabs/dex-vue';

const router = useRouter();

// ===================================================================
// Data
// ===================================================================

type CategoryId = 'marketing' | 'sales' | 'service' | 'operations';

type Category = {
  id: CategoryId;
  label: string;
  icon: string;
  chipBg: string;
  chipFg: string;
};

const CATEGORIES: Category[] = [
  {
    id: 'marketing',
    label: 'Marketing',
    icon: 'send',
    chipBg: 'rgb(232, 246, 232)',
    chipFg: 'rgba(0, 0, 0, 0.824)',
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: 'trending-up',
    chipBg: 'rgb(214, 240, 255)',
    chipFg: 'rgba(0, 0, 0, 0.824)',
  },
  {
    id: 'service',
    label: 'Service',
    icon: 'package',
    chipBg: 'rgb(255, 248, 228)',
    chipFg: 'rgba(0, 0, 0, 0.824)',
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: 'settings',
    chipBg: 'rgb(240, 240, 240)',
    chipFg: 'rgba(0, 0, 0, 0.824)',
  },
];

type Template = {
  id: string;
  category: CategoryId;
  title: string;
  description: string;
  includes: string[];
};

const TEMPLATES: Template[] = [
  // ---------- Marketing ----------
  {
    id: 'contact-us',
    category: 'marketing',
    title: 'Contact Us',
    description: 'Standard "Contact Us" form for any site visitor.',
    includes: [
      'Public Contact Us web form',
      'Auto-reply confirmation email',
      'New-contact notification to your team',
    ],
  },
  {
    id: 'lead-magnet-offer',
    category: 'marketing',
    title: 'Lead Magnet Offer',
    description:
      'Landing page that offers a freebie in exchange for an opt-in.',
    includes: [
      'Lead-magnet landing page',
      'Asset delivery email',
      'Nurture sequence over 7 days',
    ],
  },
  {
    id: 'newsletter-sign-up',
    category: 'marketing',
    title: 'Newsletter Sign Up',
    description: 'Capture newsletter subscribers and send a welcome email.',
    includes: [
      'Newsletter opt-in form',
      'Welcome email',
      'Add contact to newsletter tag',
    ],
  },

  // ---------- Sales ----------
  {
    id: 'bonus-content-offer',
    category: 'sales',
    title: 'Bonus Content Offer',
    description: 'Offer bonus upsell content to seal the deal.',
    includes: [
      'Bonus-content landing page',
      'Upsell email triggered after first purchase',
      'Owner notification on conversion',
    ],
  },
  {
    id: 'free-upgrade',
    category: 'sales',
    title: 'Free Upgrade',
    description:
      'Limited promo that upgrades a purchase to the next tier.',
    includes: [
      'Upgrade-offer email',
      'Time-limited promo code',
      'Sales team alert when redeemed',
    ],
  },
  {
    id: 'loyalty-coupon',
    category: 'sales',
    title: 'Loyalty Coupon',
    description: 'Encourages repeat purchases via an automated coupon.',
    includes: [
      'Coupon email after Nth purchase',
      'Personalized discount code',
      'Reminder email after 7 days',
    ],
  },

  // ---------- Service ----------
  {
    id: 'referral-request',
    category: 'service',
    title: 'Referral Request',
    description: 'Asks happy customers for referrals after purchase.',
    includes: [
      'Post-purchase delay timer',
      'Referral-request email with sharable link',
      'Owner task for warm referrals',
    ],
  },
  {
    id: 'holiday-greeting',
    category: 'service',
    title: 'Holiday Greeting',
    description: 'Periodic holiday touch-points for clients.',
    includes: [
      'Annual holiday email schedule',
      'Personalized greeting templates',
      'Optional discount code',
    ],
  },
  {
    id: 'bring-a-friend',
    category: 'service',
    title: 'Bring a Friend',
    description:
      'Special deal for clients who bring new friends/family.',
    includes: [
      'Bring-a-friend offer email',
      'New-friend opt-in form',
      'Reward fulfillment task',
    ],
  },

  // ---------- Operations ----------
  {
    id: 'staff-birthday-campaign',
    category: 'operations',
    title: 'Staff Birthday Campaign',
    description: 'Notifies admins before each employee birthday.',
    includes: [
      'Birthday reminder for admins (7 days out)',
      'Birthday card email to employee',
      'Optional shared celebration task',
    ],
  },
  {
    id: 'failed-payment-follow-up',
    category: 'operations',
    title: 'Failed Payment Follow Up',
    description: 'Creates a task + email on failed payment.',
    includes: [
      'Failed-payment trigger',
      'Customer recovery email',
      'Owner task to call the customer',
    ],
  },
  {
    id: 'employee-of-the-month',
    category: 'operations',
    title: 'Employee Of The Month',
    description: 'Monthly nomination survey to staff.',
    includes: [
      'Monthly survey email to staff',
      'Form for submitting nominations',
      'Reminder before survey closes',
    ],
  },
];

function templatesByCategory(catId: CategoryId): Template[] {
  return TEMPLATES.filter((t) => t.category === catId);
}

// ===================================================================
// Install modal
// ===================================================================

const activeTemplate = ref<Template | null>(null);
const isLoading = ref(false);
const modalEl = ref<HTMLElement | null>(null);
const previouslyFocused = ref<HTMLElement | null>(null);
const installStep = ref<'details' | 'terms'>('details');
const accordionOpen = ref(true);
let loadingTimer: number | undefined;

function openInstall(t: Template) {
  activeTemplate.value = t;
  isLoading.value = true;
  installStep.value = 'details';
  accordionOpen.value = true;
  previouslyFocused.value = document.activeElement as HTMLElement | null;

  // Simulate the bundle fetch
  if (loadingTimer) window.clearTimeout(loadingTimer);
  loadingTimer = window.setTimeout(() => {
    isLoading.value = false;
  }, 700);

  void nextTick(() => modalEl.value?.focus());
}

function closeInstall() {
  activeTemplate.value = null;
  isLoading.value = false;
  installStep.value = 'details';
  if (loadingTimer) {
    window.clearTimeout(loadingTimer);
    loadingTimer = undefined;
  }
  previouslyFocused.value?.focus();
}

function goToTerms() {
  installStep.value = 'terms';
}

function acceptInstall() {
  const t = activeTemplate.value;
  closeInstall();
  if (t) {
    router.push('/automations/builder/1');
  }
}

/** Map a template to a marketplace-style "Bundle title", since the modal
 *  framing positions the install as a bundle (per the spec). */
function bundleTitle(t: Template): string {
  return `${t.title} Integration`;
}

// ===================================================================
// ESC handler
// ===================================================================

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && activeTemplate.value) {
    closeInstall();
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  if (loadingTimer) window.clearTimeout(loadingTimer);
});

// Unused but lint-quiet
void computed;
</script>

<style scoped>
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

/* ===================== Page shell ===================== */
.tpl-page {
  background: #fff;
  min-height: 100%;
  padding: 0 0 48px;
  font-family: 'Sul Sans', 'Inter', system-ui, sans-serif;
  color: rgba(0, 0, 0, 0.824);
}
.tpl-page__header {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 24px 16px;
}
.tpl-page__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 0;
  color: var(--dex-fgColor-muted, #6b7280);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 0;
  margin-bottom: 8px;
  --dex-icon-size: 16px;
}
.tpl-page__back:hover {
  color: var(--dex-color-blue-700, #006ceb);
}
.tpl-page__back:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: 2px;
  border-radius: 4px;
}
.tpl-page__title {
  margin: 0;
  font-size: 32px;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.8);
  line-height: 1.2;
}
.tpl-page__sub {
  margin: 4px 0 0;
  color: var(--dex-fgColor-muted, #6b7280);
}

/* ===================== Main / categories ===================== */
.tpl-page__main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 8px 24px 0;
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.tpl-category {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tpl-category__title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.8);
  letter-spacing: -0.01em;
}

/* ===================== Card grid ===================== */
.tpl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(311px, 1fr));
  gap: 16px;
}
.tpl-card {
  background: #fff;
  border: 0;
  border-radius: 12px;
  padding: 16px;
  text-align: left;
  font-family: inherit;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 311px;
  height: 170px;
  box-sizing: border-box;
  box-shadow:
    0 1px 1px rgba(0, 0, 0, 0.14),
    0 2px 1px -1px rgba(0, 0, 0, 0.12),
    0 1px 3px rgba(0, 0, 0, 0.2);
}
.tpl-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.tpl-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px 0 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  text-transform: capitalize;
  --dex-icon-size: 16px;
}
.tpl-chip__label {
  font-weight: 500;
}
.tpl-card__plus {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.7);
  --dex-icon-size: 22px;
  flex-shrink: 0;
}
.tpl-card__plus:hover {
  background: var(--dex-color-blue-50, #eff6ff);
  color: var(--dex-color-blue-700, #006ceb);
}
.tpl-card__plus:focus-visible {
  outline: 2px solid var(--dex-color-blue-700, #006ceb);
  outline-offset: 2px;
}
.tpl-card__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tpl-card__title {
  font-size: 18px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.85);
  line-height: 1.2;
}
.tpl-card__desc {
  font-size: 14px;
  color: var(--dex-fgColor-muted, #6b7280);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ===================== Bundle install modal ===================== */
.tpl-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 36, 0.5);
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.tpl-modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 560px;
  max-height: min(720px, 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
}
.tpl-modal__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
}
.tpl-modal__title {
  margin: 0;
  font-weight: 600;
}
.tpl-modal__body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}
.tpl-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
}

/* Skeleton loader */
.tpl-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tpl-skeleton {
  height: 14px;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--dex-color-gray-100, #f3f4f6) 0%,
    var(--dex-color-gray-200, #e5e7eb) 50%,
    var(--dex-color-gray-100, #f3f4f6) 100%
  );
  background-size: 200% 100%;
  animation: tpl-shimmer 1.5s ease-in-out infinite;
}
.tpl-skeleton--lg {
  width: 80%;
  height: 18px;
}
.tpl-skeleton--md {
  width: 60%;
}
.tpl-skeleton--sm {
  width: 40%;
}
@keyframes tpl-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tpl-skeleton {
    animation: none;
  }
  .tpl-card,
  .tpl-card:hover {
    transition: none;
    transform: none;
  }
}

/* Install body */
.tpl-install {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tpl-install__bundle-title {
  font-size: 22px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
}
.tpl-install__logo-wrapper {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}
.tpl-install__logo {
  width: 96px;
  height: 96px;
  border-radius: 16px;
  background: var(--dex-color-gray-100, #f3f4f6);
  color: rgba(0, 0, 0, 0.5);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 700;
}
.tpl-install__meta-label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
}
.tpl-install__author {
  font-size: 16px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
}
.tpl-install__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(22, 163, 74, 0.1);
  border-radius: 999px;
  align-self: flex-start;
}
.tpl-install__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dex-color-green-700, #16a34a);
}
.tpl-install__status-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--dex-color-green-800, #166534);
}
.tpl-install__divider {
  height: 1px;
  background: var(--dex-borderColor-alpha-subtle, #e5e7eb);
  margin: 6px 0;
}
.tpl-install__install-btn {
  align-self: flex-start;
  --dex-icon-size: 16px;
}
.tpl-install__bundle-items-label {
  margin-top: 12px;
  font-size: 18px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
}
.tpl-install__accordion {
  border: 1px solid var(--dex-borderColor-alpha-subtle, #e5e7eb);
  border-radius: 8px;
  overflow: hidden;
}
.tpl-install__accordion-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  background: var(--dex-color-gray-50, #f9fafb);
  border: 0;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  --dex-icon-size: 16px;
}
.tpl-install__accordion-title {
  flex: 1;
  text-align: left;
}
.tpl-install__accordion-count {
  font-size: 12px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.6);
}
.tpl-install__accordion-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 16px 12px;
  background: #fff;
}
.tpl-install__accordion-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.tpl-install__accordion-item-name {
  color: var(--dex-fgColor-default, #272727);
}

/* Terms & conditions step */
.tpl-install__terms {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--dex-color-gray-50, #f9fafb);
  border-radius: 8px;
}
.tpl-install__terms-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}
.tpl-install__terms-body {
  margin: 0;
  font-size: 13px;
  color: var(--dex-fgColor-muted, #6b7280);
  line-height: 1.5;
}
.tpl-install__terms-actions {
  display: inline-flex;
  gap: 8px;
  margin-top: 4px;
}
</style>
