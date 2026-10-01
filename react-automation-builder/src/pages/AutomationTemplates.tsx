import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Megaphone,
  TrendingUp,
  HandHeart,
  Settings2,
  Download,
  Check,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react'
import { Button, IconButton } from '../components/ui'
import { cn } from '../components/ui/cn'

/**
 * Automation Templates page — `/my-automations/templates`.
 *
 * Matches the production layout:
 *   - Page header "Automation Templates" with no right-side actions.
 *   - Four category sections in fixed order: Marketing, Sales,
 *     Service, Operations.
 *   - Each section has three template cards in a wrapping inline
 *     layout (~311 × 170 px tiles, 3 per row at the captured 1114 px
 *     viewport).
 *   - Cards have a tinted category chip + a small `+` icon button
 *     in the top-right. The card body is NOT clickable; only the
 *     `+` button opens the bundle-installation modal.
 *   - Modal step 1: bundle details with author, edition badge,
 *     "Install" CTA, and a Bundle Items accordion.
 *   - Modal step 2 (after Install): inline Terms & Conditions block
 *     with "Accept and continue" / "Decline" actions.
 */

type Category = 'marketing' | 'sales' | 'service' | 'operations'

const CATEGORY_ORDER: Category[] = ['marketing', 'sales', 'service', 'operations']

const CATEGORY_LABEL: Record<Category, string> = {
  marketing: 'Marketing',
  sales: 'Sales',
  service: 'Service',
  operations: 'Operations',
}

const CATEGORY_ICON: Record<Category, React.ReactNode> = {
  marketing: <Megaphone size={14} strokeWidth={2} aria-hidden="true" />,
  sales: <TrendingUp size={14} strokeWidth={2} aria-hidden="true" />,
  service: <HandHeart size={14} strokeWidth={2} aria-hidden="true" />,
  operations: <Settings2 size={14} strokeWidth={2} aria-hidden="true" />,
}

/** Chip palette per category — pastel surface, deeper ink for the
 *  caption. Tuned to read as a "tinted pill" matching the spec. */
const CATEGORY_CHIP: Record<Category, { bg: string; fg: string }> = {
  marketing: { bg: '#FDECEF', fg: '#B42955' },
  sales: { bg: '#E4F1FF', fg: '#1F5DBA' },
  service: { bg: '#E7F6EC', fg: '#1F7A47' },
  operations: { bg: '#FFF1DD', fg: '#9A5A12' },
}

type TemplateCard = {
  id: string
  title: string
  description: string
  bundle: BundleMeta
}

type BundleMeta = {
  title: string
  author: string
  edition: 'All' | 'Pro' | 'Max'
  items: { kind: string; entries: string[] }[]
}

const TEMPLATES: Record<Category, TemplateCard[]> = {
  marketing: [
    {
      id: 'm-contact-us',
      title: 'Contact Us',
      description:
        'Automatically follow up with anyone who reaches out through your Contact Us form, with templated replies + internal task.',
      bundle: {
        title: 'Contact US Integration',
        author: 'Footer - Ultimate (KWAB)',
        edition: 'All',
        items: [
          {
            kind: 'Automation Builder',
            entries: ['Contact US Integration'],
          },
        ],
      },
    },
    {
      id: 'm-lead-magnet',
      title: 'Lead Magnet Offer',
      description:
        'Deliver a gated lead magnet and add the contact to your nurture sequence in one flow.',
      bundle: {
        title: 'Lead Magnet Offer',
        author: 'Keap Marketplace',
        edition: 'All',
        items: [
          {
            kind: 'Automation Builder',
            entries: ['Lead Magnet Offer'],
          },
        ],
      },
    },
    {
      id: 'm-newsletter',
      title: 'Newsletter Sign Up',
      description:
        'Welcome new newsletter subscribers and confirm their opt-in before adding them to your broadcast list.',
      bundle: {
        title: 'Newsletter Sign Up',
        author: 'Keap Marketplace',
        edition: 'All',
        items: [
          {
            kind: 'Automation Builder',
            entries: ['Newsletter Sign Up'],
          },
        ],
      },
    },
  ],
  sales: [
    {
      id: 's-bonus',
      title: 'Bonus Content Offer',
      description:
        'Send a thank-you with a bonus asset after a contact purchases a specific product.',
      bundle: {
        title: 'Bonus Content Offer',
        author: 'Keap Marketplace',
        edition: 'All',
        items: [{ kind: 'Automation Builder', entries: ['Bonus Content Offer'] }],
      },
    },
    {
      id: 's-upgrade',
      title: 'Free Upgrade',
      description:
        'Reward existing customers with a one-click free upgrade promo and notify the assigned rep.',
      bundle: {
        title: 'Free Upgrade Campaign',
        author: 'Keap Marketplace',
        edition: 'All',
        items: [{ kind: 'Automation Builder', entries: ['Free Upgrade'] }],
      },
    },
    {
      id: 's-loyalty',
      title: 'Loyalty Coupon',
      description:
        'Send a loyalty coupon when a contact crosses a purchase-count threshold.',
      bundle: {
        title: 'Loyalty Coupon',
        author: 'Keap Marketplace',
        edition: 'All',
        items: [{ kind: 'Automation Builder', entries: ['Loyalty Coupon'] }],
      },
    },
  ],
  service: [
    {
      id: 'sv-referral',
      title: 'Referral Request',
      description:
        'Ask for a referral 30 days after a successful purchase, with a templated email and tracking tag.',
      bundle: {
        title: 'Referral Request',
        author: 'Keap Marketplace',
        edition: 'All',
        items: [{ kind: 'Automation Builder', entries: ['Referral Request'] }],
      },
    },
    {
      id: 'sv-holiday',
      title: 'Holiday Greeting',
      description:
        'Schedule a seasonal greeting + offer for all active customers, with timezone-aware send windows.',
      bundle: {
        title: 'Holiday Greeting',
        author: 'Keap Marketplace',
        edition: 'All',
        items: [{ kind: 'Automation Builder', entries: ['Holiday Greeting'] }],
      },
    },
    {
      id: 'sv-bring-friend',
      title: 'Bring a Friend',
      description:
        'Invite customers to bring a friend with a shareable referral link and reward both sides.',
      bundle: {
        title: 'Bring a Friend',
        author: 'Keap Marketplace',
        edition: 'All',
        items: [{ kind: 'Automation Builder', entries: ['Bring a Friend'] }],
      },
    },
  ],
  operations: [
    {
      id: 'op-staff-bday',
      title: 'Staff Birthday Campaign',
      description:
        'Automate internal birthday greetings for staff and notify the team lead the day before.',
      bundle: {
        title: 'Staff Birthday Campaign',
        author: 'Keap Marketplace',
        edition: 'All',
        items: [
          { kind: 'Automation Builder', entries: ['Staff Birthday Campaign'] },
        ],
      },
    },
    {
      id: 'op-failed-payment',
      title: 'Failed Payment Follow Up',
      description:
        'Retry a failed payment, notify the customer, and escalate to a CSM if unresolved in 72 hours.',
      bundle: {
        title: 'Failed Payment Follow Up',
        author: 'Keap Marketplace',
        edition: 'All',
        items: [
          { kind: 'Automation Builder', entries: ['Failed Payment Follow Up'] },
        ],
      },
    },
    {
      id: 'op-employee-month',
      title: 'Employee Of The Month',
      description:
        'Coordinate nominations, voting, and an announcement broadcast for Employee of the Month.',
      bundle: {
        title: 'Employee Of The Month',
        author: 'Keap Marketplace',
        edition: 'All',
        items: [
          { kind: 'Automation Builder', entries: ['Employee Of The Month'] },
        ],
      },
    },
  ],
}

export default function AutomationTemplates() {
  const navigate = useNavigate()
  const [activeBundle, setActiveBundle] = useState<{
    bundle: BundleMeta
    category: Category
    templateId: string
  } | null>(null)

  return (
    <div className="min-h-full w-full min-w-0 bg-canvas">
      <div className="mx-auto w-full min-w-0 max-w-[1400px] px-4 py-3 sm:px-6 sm:py-4">
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <IconButton
            aria-label="Back to My automations"
            onClick={() => navigate('/my-automations/list/advanced')}
          >
            <ArrowLeft size={20} strokeWidth={2} className="text-ink" aria-hidden="true" />
          </IconButton>
          <h1 className="text-2xl leading-tight font-normal text-ink sm:text-[28px] sm:leading-[40px]">
            Automation Templates
          </h1>
        </header>

        <div className="flex flex-col gap-8">
          {CATEGORY_ORDER.map((cat) => (
            <CategorySection
              key={cat}
              category={cat}
              templates={TEMPLATES[cat]}
              onPick={(template) =>
                setActiveBundle({
                  bundle: template.bundle,
                  category: cat,
                  templateId: template.id,
                })
              }
            />
          ))}
        </div>
      </div>

      {activeBundle ? (
        <BundleInstallModal
          bundle={activeBundle.bundle}
          category={activeBundle.category}
          onClose={() => setActiveBundle(null)}
          onAccepted={() => {
            setActiveBundle(null)
            // Mock: installing a bundle drops a new Advanced
            // automation in the user's list. Route into the
            // Advanced builder so the user can immediately edit it.
            const id = 3000 + Math.floor(Math.random() * 1000)
            navigate(`/my-automations/list/advanced/${id}`, {
              state: { fromTemplate: activeBundle.templateId },
            })
          }}
        />
      ) : null}
    </div>
  )
}

/* ─── Sections + cards ────────────────────────────────────────────── */

function CategorySection({
  category,
  templates,
  onPick,
}: {
  category: Category
  templates: TemplateCard[]
  onPick: (template: TemplateCard) => void
}) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-ink">
        {CATEGORY_LABEL[category]}
      </h2>
      <ul className="flex flex-wrap items-start gap-4">
        {templates.map((t) => (
          <TemplateCardView
            key={t.id}
            template={t}
            category={category}
            onPlus={() => onPick(t)}
          />
        ))}
      </ul>
    </section>
  )
}

function TemplateCardView({
  template,
  category,
  onPlus,
}: {
  template: TemplateCard
  category: Category
  onPlus: () => void
}) {
  const chip = CATEGORY_CHIP[category]
  return (
    <li
      className="flex w-[311px] flex-col rounded-[12px] bg-white p-4"
      style={{
        // Match the production elevation-z1 shadow stack.
        boxShadow:
          '0 1px 1px rgba(0,0,0,.14), 0 2px 1px -1px rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.2)',
        height: 170,
      }}
    >
      {/* Top row: tinted category chip + "+" icon button */}
      <div className="flex items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide"
          style={{ background: chip.bg, color: chip.fg }}
        >
          {CATEGORY_LABEL[category]}
          <span aria-hidden="true" className="inline-flex">
            {CATEGORY_ICON[category]}
          </span>
        </span>
        <button
          type="button"
          aria-label={`Install "${template.title}"`}
          onClick={onPlus}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-accent hover:bg-canvas focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
        >
          <Plus size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {/* Body: title + line-clamped description. NOT clickable. */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <p className="text-sm font-medium text-ink">{template.title}</p>
        <p
          className="mt-1 text-xs text-ink-muted"
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 3,
            overflow: 'hidden',
          }}
        >
          {template.description}
        </p>
      </div>
    </li>
  )
}

/* ─── Bundle Installation Modal ───────────────────────────────────── */

function BundleInstallModal({
  bundle,
  category,
  onClose,
  onAccepted,
}: {
  bundle: BundleMeta
  category: Category
  onClose: () => void
  onAccepted: () => void
}) {
  const [step, setStep] = useState<'details' | 'terms'>('details')

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bundle installation"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] overflow-hidden rounded-card bg-surface shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <header className="sticky top-0 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-btn text-ink hover:bg-hover-overlay"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <h2 className="flex-1 text-base font-medium text-ink">
            Bundle installation
          </h2>
          {/* Trailing slot reserved per the spec — empty for now. */}
          <span className="w-9" aria-hidden="true" />
        </header>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Bundle title */}
          <p className="text-xl font-semibold text-ink">{bundle.title}</p>

          {/* Logo */}
          <div className="mt-4 flex h-24 w-24 items-center justify-center rounded-card bg-canvas">
            <span aria-hidden="true" className="text-ink-muted">
              {CATEGORY_ICON[category]}
            </span>
          </div>

          {/* Author */}
          <p className="mt-4 text-xs text-ink-muted">Created by</p>
          <p className="text-sm font-medium text-ink">{bundle.author}</p>

          {/* Edition compatibility */}
          <p className="mt-4 text-xs text-ink-muted">Edition compatibility</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#E7F6EC] px-2 py-0.5 text-xs font-semibold text-[#1F7A47]">
            <Check size={12} strokeWidth={2.5} aria-hidden="true" />
            {bundle.edition}
          </span>

          {/* Divider */}
          <div className="my-5 h-px bg-border" />

          {/* Primary CTA — step 1 only */}
          {step === 'details' ? (
            <Button
              variant="primary"
              leftIcon={<Download size={16} strokeWidth={2} aria-hidden="true" />}
              onClick={() => setStep('terms')}
            >
              Install
            </Button>
          ) : null}

          {/* Bundle items section */}
          <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Bundle items
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {bundle.items.map((group, i) => (
              <BundleItemGroup key={i} kind={group.kind} entries={group.entries} />
            ))}
          </div>

          {/* Step 2 — Terms & Conditions, appears inline below */}
          {step === 'terms' ? (
            <div className="mt-6 rounded-card border border-border bg-canvas px-4 py-4">
              <h3 className="text-sm font-semibold text-ink">
                Terms and conditions
              </h3>
              <p className="mt-2 text-xs text-ink-muted">
                By installing this bundle you agree to the partner's terms,
                including access to the listed automation contents and any
                emails, tags, or templates they create. You can uninstall the
                bundle at any time from My Automations.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={onAccepted}>
                  Accept and continue
                </Button>
                <Button variant="secondary" onClick={onClose}>
                  Decline
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function BundleItemGroup({
  kind,
  entries,
}: {
  kind: string
  entries: string[]
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-card border border-border bg-canvas">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span aria-hidden="true" className="text-ink-muted">
          {open ? (
            <ChevronDown size={16} strokeWidth={2} />
          ) : (
            <ChevronRight size={16} strokeWidth={2} />
          )}
        </span>
        <span className="flex-1 text-sm font-medium text-ink">{kind}</span>
        <span className="text-xs text-ink-muted">
          {entries.length} selected
        </span>
      </button>
      {open ? (
        <ul className="border-t border-border px-3 py-2">
          {entries.map((entry, i) => (
            <li key={i} className="flex items-center gap-2 py-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full bg-[#E7F6EC] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1F7A47]',
                )}
              >
                All
              </span>
              <span className="text-sm text-ink">{entry}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
