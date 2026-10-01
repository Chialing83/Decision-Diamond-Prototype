import React from 'react'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Star,
  Tag,
  ThumbsUp,
} from 'lucide-react'
import {
  Button,
  Card,
  DashboardGrid,
  GridItem,
  IconButton,
  KeapArrowRight,
  KeapPlusCircle,
} from '../components/ui'
import { recentActivity, tasks } from '../data/mockData'

/**
 * Dashboard — refactored to the new Tailwind v4 + primitives system.
 *
 * Strictly UI-layer: no business logic, routing, or data-fetching changes.
 * The page renders inside the existing <AppShell /> (dex-based sidebar) — the
 * new <Sidebar /> / <MobileTabBar /> responsive primitives are previewed in
 * /dev/ui but are intentionally NOT wired into production routing yet; see
 * MIGRATION.md for the rationale.
 */
export default function Dashboard() {
  return (
    <div className="min-h-screen bg-canvas">
      <DashboardGrid>
        <GridItem span={{ base: 12 }}>
          <h1 className="text-2xl font-semibold text-ink">Home</h1>
        </GridItem>

        {/* ─── KPI row ─────────────────────────────────────────────────── */}
        <KpiCard title="Contacts" meta="All time" value="660" />
        <KpiCard title="New leads" meta="Last 30 days" value="0" />
        <KpiCard title="New clients" meta="Last 30 days" value="0" />
        <KpiCard title="Repeat clients" meta="Last 30 days" value="0" />
        <KpiCard title="Sales" meta="Last 30 days" value="$0" />
        <KpiCard title="Quotes" meta="Last 30 days" value="0" />
        <KpiCard title="Invoices" meta="Last 30 days" value="$0" />
        <KpiCard
          title="Broadcast"
          meta="Last 30 days"
          value="100%"
          valueSuffix={
            <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-medium text-success">
              <ThumbsUp className="h-3 w-3" aria-hidden="true" />
              clicked
            </span>
          }
        />

        {/* ─── Tasks ──────────────────────────────────────────────────── */}
        <GridItem span={{ base: 12, lg: 6, xl: 4 }}>
          <Card variant="list">
            <Card.Header
              title="Tasks"
              menu={[
                { label: 'Mark all done', onSelect: () => {} },
                { label: 'Clear completed', onSelect: () => {} },
              ]}
            />
            <Card.Meta>Past due</Card.Meta>
            <Card.Body>
              <ul className="max-h-[360px] overflow-y-auto pr-1">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start gap-3 py-3 border-b border-border last:border-0"
                  >
                    <input
                      type="checkbox"
                      aria-label={`Complete ${task.title}`}
                      defaultChecked={task.done}
                      className="mt-0.5 rounded text-accent focus:ring-accent"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {task.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                        <AlertCircle
                          className="h-3 w-3 text-danger"
                          aria-hidden="true"
                        />
                        <span>
                          Due {task.dueDate}
                          {task.contactName ? ` · ${task.contactName}` : ''}
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card.Body>
            <Card.Footer>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] rounded-btn"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add item
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] rounded-btn"
              >
                View all
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </Card.Footer>
          </Card>
        </GridItem>

        {/* ─── Recent activity ───────────────────────────────────────── */}
        <GridItem span={{ base: 12, lg: 6, xl: 4 }}>
          <Card variant="list">
            <Card.Header
              title="Recent activity"
              menu={[{ label: 'Filter by type', onSelect: () => {} }]}
            />
            <Card.Meta>Fri, Mar 27, 2026</Card.Meta>
            <Card.Body>
              <ul className="max-h-[360px] overflow-y-auto pr-1">
                {recentActivity.map((item) => {
                  const Icon = activityIcon(item.type)
                  return (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 py-3 border-b border-border last:border-0"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-ink-muted"
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {item.description}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">
                          {item.subject} · {item.time}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card.Body>
            <Card.Footer>
              <span className="text-sm font-semibold">View all activity</span>
              <IconButton variant="card-footer" aria-label="Open activity">
                <KeapArrowRight />
              </IconButton>
            </Card.Footer>
          </Card>
        </GridItem>

        {/* ─── Appointments (empty) ──────────────────────────────────── */}
        <GridItem span={{ base: 12, md: 6, lg: 6, xl: 4 }}>
          <Card variant="empty">
            <Card.Header
              title="Appointments"
              menu={[{ label: 'Settings', onSelect: () => {} }]}
            />
            <Card.Body>
              <div className="flex flex-col items-center text-center gap-3 py-6">
                <div
                  aria-hidden="true"
                  className="flex h-24 w-24 items-center justify-center rounded-card bg-brand-50"
                >
                  <CalendarDays className="h-12 w-12 text-brand" aria-hidden="true" />
                </div>
                <div className="text-base font-semibold text-ink">
                  No upcoming appointments
                </div>
                <div className="text-sm text-ink-muted">
                  Schedule your first appointment to see it here.
                </div>
                <Button variant="secondary">Get started</Button>
              </div>
            </Card.Body>
          </Card>
        </GridItem>

        {/* ─── Reviews (empty) ───────────────────────────────────────── */}
        <GridItem span={{ base: 12, md: 6, lg: 6, xl: 4 }}>
          <ReviewsCard />
        </GridItem>

        {/* ─── Email health (progress) ───────────────────────────────── */}
        <GridItem span={{ base: 12, md: 6, lg: 4 }}>
          <EmailHealthCard metrics={EMAIL_HEALTH_METRICS} />
        </GridItem>

        {/* ─── Share feedback (centered in content area) ─────────────── */}
        <GridItem span={{ base: 12 }}>
          <div className="flex justify-center">
            <a
              href="#feedback"
              className="inline-flex items-center gap-2 rounded-btn px-3 py-2 text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Share feedback
            </a>
          </div>
        </GridItem>
      </DashboardGrid>
    </div>
  )
}

/* ─── Local card helpers ─────────────────────────────────────────────── */

function KpiCard({
  title,
  meta,
  value,
  valueSuffix,
}: {
  title: string
  meta: string
  value: string
  valueSuffix?: React.ReactNode
}) {
  return (
    <GridItem span={{ base: 12, sm: 6, md: 4, lg: 3, xl: 2 }}>
      <Card variant="kpi">
        <Card.Header
          title={title}
          menu={[
            { label: 'Edit', onSelect: () => {} },
            { label: 'Remove', onSelect: () => {}, danger: true },
          ]}
        />
        <Card.Meta interactive>{meta}</Card.Meta>
        <Card.Body>
          <div className="text-metric text-ink">
            {value}
            {valueSuffix}
          </div>
        </Card.Body>
        <Card.Footer>
          <IconButton variant="card-footer" aria-label={`Add to ${title}`}>
            <KeapPlusCircle />
          </IconButton>
          <div className="flex items-center">
            <IconButton variant="pager" aria-label={`Previous ${title}`}>
              <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
            </IconButton>
            <IconButton variant="pager" aria-label={`Next ${title}`}>
              <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
            </IconButton>
          </div>
          <IconButton variant="card-footer" aria-label={`Open ${title}`}>
            <KeapArrowRight />
          </IconButton>
        </Card.Footer>
      </Card>
    </GridItem>
  )
}

function ReviewsCard() {
  return (
    <Card variant="empty">
      <Card.Header
        title="Reviews"
        menu={[{ label: 'Settings', onSelect: () => {} }]}
      />
      <Card.Body>
        <div className="flex h-full flex-col gap-3">
          <div
            role="img"
            aria-label="5 star rating"
            className="flex items-center gap-1"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                aria-hidden="true"
                fill="currentColor"
                className="h-5 w-5 text-amber-500"
              />
            ))}
          </div>
          <h3 className="text-lg font-semibold leading-snug text-ink">
            Boost your business with Google Reviews
          </h3>
          <p className="mt-2 text-sm text-ink-muted">
            From being found online to earning trust, reviews are a proven
            source of new business.
          </p>
          <div className="mt-auto pt-6">
            <Button variant="secondary" fullWidth>
              Connect to Google My Business
            </Button>
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}

/* ─── Email Health ───────────────────────────────────────────────────── */

export type EmailHealthMetric = {
  id: string
  label: string
  min: string
  max: string
  value: string
  /** 0–100+. Values over 100 are clamped and force the danger state. */
  progress: number
  status: 'healthy' | 'warning' | 'danger'
}

const EMAIL_HEALTH_METRICS: EmailHealthMetric[] = [
  {
    id: 'engagement',
    label: 'Average engagement (days)',
    min: '0 days',
    max: '100 days (at risk)',
    value: '322.00 days',
    progress: 322,
    status: 'danger',
  },
  {
    id: 'bounce',
    label: 'Invalid bounce rate',
    min: '0%',
    max: '5% (at risk)',
    value: '0.00%',
    progress: 2,
    status: 'healthy',
  },
  {
    id: 'complaint',
    label: 'Complaint rate',
    min: '0%',
    max: '0.1% (at risk)',
    value: '0.00%',
    progress: 2,
    status: 'healthy',
  },
]

function EmailHealthCard({ metrics }: { metrics: EmailHealthMetric[] }) {
  return (
    <Card variant="progress">
      <Card.Header
        title="Email Health (Last 30 days)"
        menu={[{ label: 'View report', onSelect: () => {} }]}
      />
      <Card.Body>
        <ul>
          {metrics.map((m, i) => (
            <li
              key={m.id}
              className={i === 0 ? '' : 'border-t border-border pt-4 mt-4'}
            >
              <EmailHealthRow metric={m} />
            </li>
          ))}
        </ul>
      </Card.Body>
    </Card>
  )
}

function EmailHealthRow({ metric }: { metric: EmailHealthMetric }) {
  // Clamp to [2, 100] so healthy values still show a visible sliver. Values
  // over the max stay pinned at 100 and force the danger state.
  const clampedProgress = Math.min(100, Math.max(2, metric.progress))
  const overLimit = metric.progress > 100
  const status: EmailHealthMetric['status'] = overLimit ? 'danger' : metric.status

  const barColor =
    status === 'danger'
      ? 'bg-danger'
      : status === 'warning'
        ? 'bg-amber-500'
        : 'bg-success'

  const StatusIcon =
    status === 'danger' ? AlertCircle : status === 'warning' ? AlertCircle : ThumbsUp
  const statusColor =
    status === 'danger'
      ? 'text-danger'
      : status === 'warning'
        ? 'text-amber-500'
        : 'text-success'

  return (
    <>
      <p className="text-sm font-medium text-ink">{metric.label}</p>
      <div className="mt-1 flex justify-between text-xs text-ink-muted">
        <span>{metric.min}</span>
        <span>{metric.max}</span>
      </div>
      <div
        role="progressbar"
        aria-label={metric.label}
        aria-valuenow={Math.round(clampedProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1 h-1.5 rounded-pill bg-border"
      >
        <div
          className={`h-full rounded-pill ${barColor}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-2xl font-semibold text-ink">
          <span>{metric.value}</span>
          <StatusIcon
            className={`h-5 w-5 ${statusColor}`}
            aria-hidden="true"
          />
        </div>
        <IconButton variant="card-footer" aria-label={`View details for ${metric.label}`}>
          <KeapArrowRight />
        </IconButton>
      </div>
    </>
  )
}

function activityIcon(type: string) {
  switch (type) {
    case 'email':
      return Mail
    case 'tag':
      return Tag
    case 'note':
      return FileText
    case 'task':
      return CheckCircle2
    case 'call':
      return Phone
    case 'appointment':
      return Calendar
    case 'text':
      return MessageSquare
    default:
      return FileText
  }
}
