import React, { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Contact,
  Download,
  Home,
  Mail,
  Plus,
  Trash2,
  Workflow,
} from 'lucide-react'
import {
  Button,
  Card,
  DashboardGrid,
  DataTable,
  DataTableSkeleton,
  GridItem,
  IconButton,
  KeapArrowRight,
  KeapPlusCircle,
  MobileTabBar,
  Row as DataRow,
  Sidebar,
  StatusBadge,
  Tabs,
  Th,
  type ButtonSize,
  type ButtonVariant,
  type CardVariant,
  type StatusBadgeStatus,
} from '../components/ui'

/** Gallery page at /dev/ui that renders every variant/state of Card and Button
 *  for visual inspection. Not linked from the production UI. */
export default function DevUI() {
  return (
    <div className="min-h-screen bg-canvas text-ink font-sans antialiased">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold">UI Primitives</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Gallery of <code>src/components/ui/</code> primitives — every
            variant, size, and state.
          </p>
        </div>
      </header>

      <DashboardGrid>
        <GridItem span={{ base: 12 }}>
          <Section title="Button — variants">
            <Row>
              {(['primary', 'secondary', 'ghost', 'danger'] as ButtonVariant[]).map((v) => (
                <Button key={v} variant={v}>
                  {cap(v)}
                </Button>
              ))}
            </Row>
          </Section>
        </GridItem>

        <GridItem span={{ base: 12 }}>
          <Section title="Button — sizes">
            <Row>
              {(['sm', 'md', 'lg'] as ButtonSize[]).map((s) => (
                <Button key={s} size={s}>
                  Size {s}
                </Button>
              ))}
            </Row>
          </Section>
        </GridItem>

        <GridItem span={{ base: 12 }}>
          <Section title="Button — with icons">
            <Row>
              <Button leftIcon={<Plus className="h-4 w-4" />}>Add item</Button>
              <Button rightIcon={<ArrowRight className="h-4 w-4" />}>Continue</Button>
              <Button
                variant="secondary"
                leftIcon={<Download className="h-4 w-4" />}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Download
              </Button>
              <Button variant="danger" leftIcon={<Trash2 className="h-4 w-4" />}>
                Delete
              </Button>
            </Row>
          </Section>
        </GridItem>

        <GridItem span={{ base: 12 }}>
          <Section title="Button — states">
            <Row>
              <Button>Default</Button>
              <Button disabled>Disabled</Button>
              <ButtonLoadingDemo />
              <Button fullWidth>Full width</Button>
            </Row>
          </Section>
        </GridItem>

        <GridItem span={{ base: 12 }}>
          <Section title="IconButton — card-footer variant (Addendum C)">
            <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3">
              <IconButton variant="card-footer" aria-label="Add">
                <KeapPlusCircle />
              </IconButton>
              <IconButton variant="card-footer" aria-label="Open">
                <KeapArrowRight />
              </IconButton>
              <IconButton variant="card-footer" aria-label="Disabled add" disabled>
                <KeapPlusCircle />
              </IconButton>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              Strict 32×32, <code>rounded-btn</code>, <code>text-accent</code>,{' '}
              <code>hover:bg-accent/5</code>. Pixel-perfect <code>KeapPlusCircle</code>{' '}
              / <code>KeapArrowRight</code> SVGs match the reference. Blue (accent)
              only — for primary actions (+) and drill-in (→).
            </p>
          </Section>
        </GridItem>

        <GridItem span={{ base: 12 }}>
          <Section title="IconButton — pager variant (Addendum E)">
            <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3">
              <IconButton variant="pager" aria-label="Previous quote">
                <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
              </IconButton>
              <IconButton variant="pager" aria-label="Next quote">
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
              </IconButton>
              <IconButton variant="pager" aria-label="Disabled previous" disabled>
                <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
              </IconButton>
              <IconButton variant="pager" aria-label="Disabled next" disabled>
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
              </IconButton>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              Neutral <code>text-ink</code> (not blue) so the prev/next pager reads
              as plumbing between the blue +/→ CTAs. Hover tint{' '}
              <code>rgba(0,0,0,0.02)</code>, active{' '}
              <code>rgba(0,0,0,0.09)</code>, disabled icon{' '}
              <code>rgba(0,0,0,0.4)</code>. 250ms ease-out transition matches the
              reference.
            </p>
          </Section>
        </GridItem>

        <GridItem span={{ base: 12 }}>
          <AutomationsDemo />
        </GridItem>

        <GridItem span={{ base: 12 }}>
          <Section title="IconButton — variants & sizes">
            <Row>
              <IconButton aria-label="Default action">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <IconButton aria-label="Primary action" variant="primary">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <IconButton aria-label="Secondary action" variant="secondary">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <IconButton aria-label="Ghost action" variant="ghost">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <IconButton aria-label="Danger action" variant="danger">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <IconButton aria-label="Medium icon button" size="md">
                <Plus className="h-5 w-5" aria-hidden="true" />
              </IconButton>
            </Row>
          </Section>
        </GridItem>

        {/* Card variants */}
        {(['kpi', 'list', 'empty', 'progress'] as CardVariant[]).map((variant) => (
          <GridItem key={variant} span={{ base: 12, md: 6, lg: 4 }}>
            <Card variant={variant}>
              <CardDemoContent variant={variant} />
            </Card>
          </GridItem>
        ))}

        {/* Loading cards */}
        {(['kpi', 'list', 'progress'] as CardVariant[]).map((variant) => (
          <GridItem key={`loading-${variant}`} span={{ base: 12, md: 6, lg: 4 }}>
            <Card variant={variant} loading />
          </GridItem>
        ))}

        <GridItem span={{ base: 12 }}>
          <Section title="Sidebar & MobileTabBar (previewed inline; fixed positioning omitted)">
            <div className="flex flex-wrap gap-6">
              <div className="rounded-card border border-border bg-surface p-3">
                <p className="mb-2 text-xs font-medium text-ink-muted">
                  Sidebar (72px rail)
                </p>
                <div className="flex w-[72px] flex-col items-center gap-2 border-r border-border bg-surface py-3">
                  {sidebarPreviewItems().map((item) => (
                    <IconButton
                      key={item.key}
                      aria-label={item.label}
                      aria-current={item.active ? 'page' : undefined}
                      className={item.active ? 'bg-canvas text-ink' : ''}
                    >
                      {item.icon}
                    </IconButton>
                  ))}
                </div>
              </div>
              <div className="rounded-card border border-border bg-surface p-3">
                <p className="mb-2 text-xs font-medium text-ink-muted">
                  MobileTabBar
                </p>
                <div className="flex h-16 w-80 border-t border-border bg-surface">
                  {sidebarPreviewItems()
                    .slice(0, 4)
                    .map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        aria-label={item.label}
                        aria-current={item.active ? 'page' : undefined}
                        className={
                          'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium ' +
                          (item.active
                            ? 'text-accent'
                            : 'text-ink-muted hover:text-ink')
                        }
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              Live, fixed-position versions are exported as{' '}
              <code>&lt;Sidebar /&gt;</code> and <code>&lt;MobileTabBar /&gt;</code>.
              See <code>MIGRATION.md</code> for adoption notes.
            </p>
          </Section>
        </GridItem>
      </DashboardGrid>
    </div>
  )
}

function sidebarPreviewItems() {
  return [
    { key: 'home', label: 'Home', active: true, icon: <Home className="h-5 w-5" aria-hidden="true" /> },
    { key: 'contacts', label: 'Contacts', icon: <Contact className="h-5 w-5" aria-hidden="true" /> },
    { key: 'mail', label: 'Email', icon: <Mail className="h-5 w-5" aria-hidden="true" /> },
    { key: 'reports', label: 'Reports', icon: <BarChart3 className="h-5 w-5" aria-hidden="true" /> },
    { key: 'automation', label: 'Automation', icon: <Workflow className="h-5 w-5" aria-hidden="true" /> },
  ]
}
// Keep imports referenced so they don't trip unused-import rules in strict builds.
void Sidebar
void MobileTabBar

function ButtonLoadingDemo() {
  const [loading, setLoading] = useState(false)
  return (
    <Button
      loading={loading}
      onClick={() => {
        setLoading(true)
        setTimeout(() => setLoading(false), 1500)
      }}
    >
      Save changes
    </Button>
  )
}

function CardDemoContent({ variant }: { variant: CardVariant }) {
  const menu = [
    { label: 'Edit', onSelect: () => {} },
    { label: 'Duplicate', onSelect: () => {} },
    { label: 'Delete', onSelect: () => {}, danger: true },
  ]

  if (variant === 'kpi') {
    return (
      <>
        <Card.Header title="Contacts" menu={menu} />
        <Card.Meta interactive>Last 30 days</Card.Meta>
        <Card.Body>
          <div className="text-metric text-ink">1,284</div>
        </Card.Body>
        <Card.Footer>
          <IconButton variant="card-footer" aria-label="Add">
            <KeapPlusCircle />
          </IconButton>
          <div className="flex items-center">
            <IconButton variant="pager" aria-label="Previous">
              <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
            </IconButton>
            <IconButton variant="pager" aria-label="Next">
              <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
            </IconButton>
          </div>
          <IconButton variant="card-footer" aria-label="Open">
            <KeapArrowRight />
          </IconButton>
        </Card.Footer>
      </>
    )
  }

  if (variant === 'list') {
    return (
      <>
        <Card.Header title="Tasks" menu={menu} />
        <Card.Meta>3 open</Card.Meta>
        <Card.Body>
          <ul className="max-h-[360px] overflow-y-auto pr-1">
            {[
              'Follow up with Acme Corp',
              'Review Q2 proposal',
              'Send invoice reminder',
            ].map((task) => (
              <li
                key={task}
                className="flex items-start gap-3 py-3 border-b border-border last:border-0"
              >
                <input
                  type="checkbox"
                  aria-label={task}
                  className="mt-0.5 rounded text-accent focus:ring-accent"
                />
                <span className="text-sm text-ink">{task}</span>
              </li>
            ))}
          </ul>
        </Card.Body>
        <Card.Footer>
          <span className="text-sm font-semibold">View all</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Card.Footer>
      </>
    )
  }

  if (variant === 'empty') {
    return (
      <>
        <Card.Header title="Appointments" menu={menu} />
        <Card.Body>
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <div
              aria-hidden="true"
              className="h-24 w-24 rounded-full bg-brand-50 flex items-center justify-center"
            >
              <Plus className="h-10 w-10 text-brand" aria-hidden="true" />
            </div>
            <div className="text-base font-semibold text-ink">No appointments yet</div>
            <div className="text-sm text-ink-muted">
              Schedule your first appointment to see it here.
            </div>
            <Button variant="secondary">Create appointment</Button>
          </div>
        </Card.Body>
      </>
    )
  }

  // progress
  return (
    <>
      <Card.Header title="Email health" menu={menu} />
      <Card.Meta>Sender reputation</Card.Meta>
      <Card.Body>
        <div className="flex justify-between text-xs text-ink-muted">
          <span>Low</span>
          <span>High</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={72}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Sender reputation"
          className="mt-1 h-1.5 rounded-pill bg-border"
        >
          <div className="h-full rounded-pill bg-success" style={{ width: '72%' }} />
        </div>
        <div className="mt-3 flex items-center gap-2 text-2xl font-semibold text-ink">
          <span>Good</span>
        </div>
      </Card.Body>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-3">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1)
}

/* ─── Addendum F: automations list primitives ─────────────────────────── */

function AutomationsDemo() {
  const [tab, setTab] = useState<'advanced' | 'easy'>('advanced')
  const [state, setState] = useState<'data' | 'loading' | 'empty'>('data')
  const statuses: StatusBadgeStatus[] = [
    'draft',
    'published',
    'active',
    'disabled',
    'paused',
    'error',
  ]

  return (
    <section className="space-y-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Automations list primitives (Addendum F)
      </h2>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          StatusBadge
        </h3>
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3">
          {statuses.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Tabs
        </h3>
        <div className="rounded-card border border-border bg-surface p-3">
          <Tabs
            items={[
              { id: 'advanced', label: 'Advanced' },
              { id: 'easy', label: 'Easy' },
            ]}
            value={tab}
            onChange={(v) => setTab(v as 'advanced' | 'easy')}
            aria-label="Demo tabs"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            DataTable ({state})
          </h3>
          <div className="flex gap-1">
            {(['data', 'loading', 'empty'] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={state === s ? 'primary' : 'filled-gray'}
                onClick={() => setState(s)}
              >
                {cap(s)}
              </Button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <DataTable label="Demo advanced automations">
            <thead>
              <tr>
                <Th sortable>Advanced automation</Th>
                <Th sortable>Category</Th>
                <Th>Status</Th>
                <Th sortable>ID</Th>
              </tr>
            </thead>
            <tbody>
              {state === 'loading' && <DataTableSkeleton columns={4} />}
              {state === 'empty' && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-10 text-center text-sm text-ink-muted"
                  >
                    No automations match your search.
                  </td>
                </tr>
              )}
              {state === 'data' && (
                <>
                  <DataRow interactive>
                    <td className="p-4 text-sm text-ink">Catnip onboarding</td>
                    <td className="p-4 text-sm text-ink">Whiskers</td>
                    <td className="p-4">
                      <StatusBadge status="published" label="Published" />
                    </td>
                    <td className="p-4 text-sm text-ink">2888</td>
                  </DataRow>
                  <DataRow interactive>
                    <td className="p-4 text-sm text-ink">DD Test</td>
                    <td className="p-4 text-sm text-ink">Whiskers</td>
                    <td className="p-4">
                      <StatusBadge status="draft" label="Draft" />
                    </td>
                    <td className="p-4 text-sm text-ink">3000</td>
                  </DataRow>
                </>
              )}
            </tbody>
          </DataTable>
        </div>
      </div>
    </section>
  )
}
