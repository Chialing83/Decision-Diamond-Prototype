import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Filter, Search } from 'lucide-react'
import {
  Button,
  DataTable,
  IconButton,
  KebabMenu,
  Row,
  StatusBadge,
  Tabs,
  Th,
  type SortDirection,
  type StatusBadgeStatus,
} from '../components/ui'
import { CreateAutomationButton } from '../components/automations/CreateAutomationButton'
import { advancedAutomations, automations, type AdvancedAutomation, type Automation as EasyAutomation } from '../data/mockData'
import {
  loadNameOverrides,
  getDisplayName,
  type NameOverrides,
} from '../data/automationNames'

/**
 * My automations — refactored to the Tailwind v4 + primitives system
 * (Addendum F). Preserves existing routes, search behavior, and selection
 * state from the original dex-react implementation.
 */
export default function Automation() {
  const location = useLocation()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'advanced' | 'easy'>(
    location.pathname.includes('/advanced') ? 'advanced' : 'easy',
  )
  const [search, setSearch] = useState('')

  /** Per-id name overrides — the list view is READ-ONLY for
   *  renames (the editor lives in the builder's top bar). We just
   *  read the shared store so the list reflects any rename done
   *  inside the builder. Cross-tab + within-tab sync hooks below
   *  refresh the local cache without polling. */
  const [nameOverrides, setNameOverrides] = useState<NameOverrides>(
    () => loadNameOverrides(),
  )
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('keap-automation-name-overrides:')) {
        setNameOverrides(loadNameOverrides())
      }
    }
    const onSelf = () => setNameOverrides(loadNameOverrides())
    window.addEventListener('storage', onStorage)
    window.addEventListener('automation-names-changed', onSelf)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('automation-names-changed', onSelf)
    }
  }, [])
  const displayName = (id: string, fallback: string) =>
    getDisplayName(nameOverrides, id, fallback)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  // ── Sort state (client-side; header button cycles asc → desc → none) ─────
  type AdvSortKey = 'name' | 'category' | 'publishDate' | 'numericId'
  type EasySortKey = 'name' | 'lastUpdated'
  const [advSort, setAdvSort] = useState<{ key: AdvSortKey; dir: SortDirection }>({
    key: 'name',
    dir: 'none',
  })
  const [easySort, setEasySort] = useState<{ key: EasySortKey; dir: SortDirection }>({
    key: 'name',
    dir: 'none',
  })

  const filteredEasy = useMemo(
    () =>
      sortRows(
        automations.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())),
        easySort.key,
        easySort.dir,
      ),
    [search, easySort],
  )
  const filteredAdvanced = useMemo(
    () =>
      sortRows(
        advancedAutomations.filter((a) =>
          a.name.toLowerCase().includes(search.toLowerCase()),
        ),
        advSort.key,
        advSort.dir,
      ),
    [search, advSort],
  )
  const visibleIds =
    tab === 'easy' ? filteredEasy.map((a) => a.id) : filteredAdvanced.map((a) => a.id)

  const toggleCheck = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => checked.has(id))
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(visibleIds))

  const onTabChange = (next: 'advanced' | 'easy') => {
    setTab(next)
    setChecked(new Set())
    // Reflect the change in the URL so deep links still work.
    navigate(`/my-automations/list/${next}`, { replace: true })
  }

  // ── Sort cycle helper ────────────────────────────────────────────────────
  const cycleAdv = (key: AdvSortKey) =>
    setAdvSort((prev) =>
      prev.key !== key
        ? { key, dir: 'asc' }
        : { key, dir: nextDir(prev.dir) },
    )
  const cycleEasy = (key: EasySortKey) =>
    setEasySort((prev) =>
      prev.key !== key ? { key, dir: 'asc' } : { key, dir: nextDir(prev.dir) },
    )
  const advDir = (key: AdvSortKey) => (advSort.key === key ? advSort.dir : 'none')
  const easyDir = (key: EasySortKey) => (easySort.key === key ? easySort.dir : 'none')

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full w-full min-w-0 bg-surface">
      <div className="mx-auto w-full min-w-0 max-w-[1400px] px-4 py-3 sm:px-6 sm:py-4">
        <PageHeader />

        <Tabs
          items={[
            { id: 'advanced' as const, label: 'Advanced' },
            { id: 'easy' as const, label: 'Easy' },
          ]}
          value={tab}
          onChange={onTabChange}
          aria-label="Automation type"
        />

        <Toolbar
          tab={tab}
          search={search}
          onSearch={setSearch}
          showCategory={tab === 'advanced'}
        />

        {/* ── <md: stacked card list (whole-card tap target) ───────────── */}
        <div className="md:hidden">
          {tab === 'advanced' ? (
            <MobileList
              empty={visibleIds.length === 0}
              emptyLabel={
                search ? 'No automations match your search.' : 'No automations yet.'
              }
            >
              {filteredAdvanced.map((a) => (
                <MobileCard
                  key={a.id}
                  title={displayName(a.id, a.name)}
                  status={a.status === 'Published' ? 'published' : 'draft'}
                  statusLabel={a.status}
                  category={a.category}
                  meta={`${a.publishDate} · ID ${a.numericId}`}
                  onOpen={() => navigate(`/my-automations/list/advanced/${a.id}`)}
                />
              ))}
            </MobileList>
          ) : (
            <MobileList
              empty={visibleIds.length === 0}
              emptyLabel={
                search ? 'No automations match your search.' : 'No automations yet.'
              }
            >
              {filteredEasy.map((a) => (
                <MobileCard
                  key={a.id}
                  title={displayName(a.id, a.name)}
                  status={
                    a.status === 'Active'
                      ? 'active'
                      : a.status === 'Disabled'
                        ? 'disabled'
                        : 'draft'
                  }
                  statusLabel={a.status}
                  meta={a.lastUpdated}
                />
              ))}
            </MobileList>
          )}
        </div>

        {/* ── md+: full table view ─────────────────────────────────────── */}
        {/* No overflow wrapper here — `overflow-x-auto` previously
            clipped the row KebabMenu's popover whenever it dropped
            past the table's right edge. With only two columns of
            row actions and a typical md+ viewport the table fits
            unscrolled; on narrower viewports the row's own
            horizontal scroll picks up naturally. */}
        <div className="hidden min-w-0 md:block">
        {tab === 'advanced' ? (
          <DataTable label="Advanced automations">
            <thead>
              <tr>
                <th className="w-14 p-4 text-left">
                  <input
                    type="checkbox"
                    aria-label={allChecked ? 'Unselect all' : 'Select all'}
                    checked={allChecked}
                    onChange={toggleAll}
                    className="h-5 w-5 rounded border-input-border text-accent focus:ring-accent"
                  />
                </th>
                <Th sortable sort={advDir('name')} onSort={() => cycleAdv('name')}>
                  Advanced automation
                </Th>
                <Th sortable sort={advDir('category')} onSort={() => cycleAdv('category')}>
                  Category
                </Th>
                <Th>Status</Th>
                <Th>Active contacts</Th>
                <Th
                  sortable
                  sort={advDir('publishDate')}
                  onSort={() => cycleAdv('publishDate')}
                  className="hidden lg:table-cell"
                >
                  Publish date
                </Th>
                <Th
                  sortable
                  sort={advDir('numericId')}
                  onSort={() => cycleAdv('numericId')}
                  className="hidden lg:table-cell"
                >
                  ID
                </Th>
                <th className="w-14 border-b border-row-divider" aria-label="Row actions" />
              </tr>
            </thead>
            <tbody>
              {filteredAdvanced.map((a) => (
                <AdvancedRow
                  key={a.id}
                  row={{ ...a, name: displayName(a.id, a.name) }}
                  checked={checked.has(a.id)}
                  onToggle={() => toggleCheck(a.id)}
                  onOpen={() => navigate(`/my-automations/list/advanced/${a.id}`)}
                />
              ))}
              {visibleIds.length === 0 && <EmptyRow colSpan={8} search={search} />}
            </tbody>
          </DataTable>
        ) : (
          <DataTable label="Easy automations">
            <thead>
              <tr>
                <th className="w-14 p-4 text-left">
                  <input
                    type="checkbox"
                    aria-label={allChecked ? 'Unselect all' : 'Select all'}
                    checked={allChecked}
                    onChange={toggleAll}
                    className="h-5 w-5 rounded border-input-border text-accent focus:ring-accent"
                  />
                </th>
                <Th sortable sort={easyDir('name')} onSort={() => cycleEasy('name')}>
                  Easy automations
                </Th>
                <Th>Status</Th>
                <Th
                  sortable
                  sort={easyDir('lastUpdated')}
                  onSort={() => cycleEasy('lastUpdated')}
                >
                  Last updated
                </Th>
                <th className="w-14 border-b border-row-divider" aria-label="Row actions" />
              </tr>
            </thead>
            <tbody>
              {filteredEasy.map((a) => (
                <EasyRow
                  key={a.id}
                  row={{ ...a, name: displayName(a.id, a.name) }}
                  checked={checked.has(a.id)}
                  onToggle={() => toggleCheck(a.id)}
                />
              ))}
              {visibleIds.length === 0 && <EmptyRow colSpan={5} search={search} />}
            </tbody>
          </DataTable>
        )}
        </div>
      </div>
    </div>
  )
}

/* ─── Header ──────────────────────────────────────────────────────────── */

function PageHeader() {
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl leading-tight font-normal text-ink-muted sm:text-[32px] sm:leading-[48px]">
        My automations
      </h1>
      <CreateAutomationButton />
    </header>
  )
}

/* ─── Toolbar (search + filter + category) ────────────────────────────── */

function Toolbar({
  tab,
  search,
  onSearch,
  showCategory,
}: {
  tab: 'advanced' | 'easy'
  search: string
  onSearch: (next: string) => void
  showCategory: boolean
}) {
  return (
    <div className="mt-4 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:w-[315px]">
        <Search
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="search"
          placeholder={`Search ${tab} automations`}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-10 w-full rounded-btn border border-input-border bg-surface pl-10 pr-4 text-sm text-ink placeholder:text-ink-muted focus-visible:border-accent focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
        />
      </div>
      <div className="flex items-center gap-3">
        <IconButton aria-label="Filter automations" className="hover:bg-hover-overlay">
          <Filter size={20} strokeWidth={2} className="text-ink" aria-hidden="true" />
        </IconButton>
        {showCategory && (
          <Button
            variant="filled-gray"
            rightIcon={<ChevronDown size={16} strokeWidth={2} />}
          >
            Category
          </Button>
        )}
      </div>
    </div>
  )
}

/* ─── Row components ──────────────────────────────────────────────────── */

function AdvancedRow({
  row,
  checked,
  onToggle,
  onOpen,
}: {
  row: AdvancedAutomation
  checked: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const status: StatusBadgeStatus = row.status === 'Published' ? 'published' : 'draft'
  const unpublished = row.publishDate === 'Not published'
  return (
    <Row interactive selected={checked} onClick={onOpen}>
      <td className="w-14 p-4" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label={`Select ${row.name}`}
          checked={checked}
          onChange={onToggle}
          className="h-5 w-5 rounded border-input-border text-accent focus:ring-accent"
        />
      </td>
      <td className="p-4 text-sm text-ink">{row.name}</td>
      <td className="p-4 text-sm text-ink">{row.category}</td>
      <td className="p-4">
        <StatusBadge status={status} label={row.status} />
      </td>
      <td className="p-4 text-sm text-ink">{row.activeContacts}</td>
      <td className={`p-4 text-sm hidden lg:table-cell ${unpublished ? 'text-ink-muted' : 'text-ink'}`}>
        {row.publishDate}
      </td>
      <td className="p-4 text-sm text-ink hidden lg:table-cell">{row.numericId}</td>
      <td className="w-14 p-2 text-right" onClick={(e) => e.stopPropagation()}>
        <KebabMenu
          aria-label={`Actions for ${row.name}`}
          items={[
            { label: 'Edit', onSelect: onOpen },
            { label: 'Duplicate', onSelect: () => {} },
            {
              label: row.status === 'Published' ? 'Unpublish' : 'Publish',
              onSelect: () => {},
            },
            { label: 'Delete', onSelect: () => {}, danger: true },
          ]}
        />
      </td>
    </Row>
  )
}

function EasyRow({
  row,
  checked,
  onToggle,
}: {
  row: EasyAutomation
  checked: boolean
  onToggle: () => void
}) {
  const status: StatusBadgeStatus =
    row.status === 'Active' ? 'active' : row.status === 'Disabled' ? 'disabled' : 'draft'
  return (
    <Row selected={checked}>
      <td className="w-14 p-4">
        <input
          type="checkbox"
          aria-label={`Select ${row.name}`}
          checked={checked}
          onChange={onToggle}
          className="h-5 w-5 rounded border-input-border text-accent focus:ring-accent"
        />
      </td>
      <td className="p-4 text-sm text-ink">{row.name}</td>
      <td className="p-4">
        <StatusBadge status={status} label={row.status} />
      </td>
      <td className="p-4 text-sm text-ink">{row.lastUpdated}</td>
      <td className="w-14 p-2 text-right">
        <KebabMenu
          aria-label={`Actions for ${row.name}`}
          items={[
            { label: 'Edit', onSelect: () => {} },
            { label: 'Duplicate', onSelect: () => {} },
            { label: 'Delete', onSelect: () => {}, danger: true },
          ]}
        />
      </td>
    </Row>
  )
}

function EmptyRow({ colSpan, search }: { colSpan: number; search: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-sm text-ink-muted">
        {search
          ? 'No automations match your search.'
          : 'No automations yet.'}
      </td>
    </tr>
  )
}

/* ─── Mobile stacked-card list (<md) ──────────────────────────────────── */

function MobileList({
  empty,
  emptyLabel,
  children,
}: {
  empty: boolean
  emptyLabel: string
  children: React.ReactNode
}) {
  if (empty) {
    return (
      <div className="py-10 text-center text-sm text-ink-muted">{emptyLabel}</div>
    )
  }
  return <ul className="flex flex-col gap-2">{children}</ul>
}

function MobileCard({
  title,
  status,
  statusLabel,
  category,
  meta,
  onOpen,
}: {
  title: string
  status: StatusBadgeStatus
  statusLabel: string
  category?: string
  meta: string
  onOpen?: () => void
}) {
  const Tag = onOpen ? 'button' : 'div'
  return (
    <li>
      <Tag
        {...(onOpen ? { type: 'button' as const, onClick: onOpen } : {})}
        className={`flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-left transition-colors motion-reduce:transition-none ${
          onOpen
            ? 'cursor-pointer hover:bg-hover-overlay focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]'
            : ''
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={status} label={statusLabel} />
            {category ? (
              <span className="text-xs text-ink-muted">{category}</span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-ink-muted">{meta}</p>
        </div>
        {onOpen ? (
          <ChevronRight
            size={20}
            strokeWidth={2}
            aria-hidden="true"
            className="shrink-0 text-ink-muted"
          />
        ) : null}
      </Tag>
    </li>
  )
}

/* ─── Sort helpers ────────────────────────────────────────────────────── */

function nextDir(dir: SortDirection): SortDirection {
  return dir === 'none' ? 'asc' : dir === 'asc' ? 'desc' : 'none'
}

function sortRows<T>(rows: T[], key: keyof T, dir: SortDirection): T[] {
  if (dir === 'none') return rows
  const sorted = [...rows].sort((a, b) => {
    const av = a[key] as unknown
    const bv = b[key] as unknown
    if (typeof av === 'number' && typeof bv === 'number') return av - bv
    return String(av).localeCompare(String(bv), undefined, { numeric: true })
  })
  return dir === 'asc' ? sorted : sorted.reverse()
}
