import React, { useState } from 'react'
import {
  DexButton,
  DexCard,
  DexOffsetPager,
  DexTable,
  DexTableBody,
  DexTableHeader,
  DexTableHeaderCell,
  DexTabs,
  DexTabsList,
  DexTabsTrigger,
} from '@thryvlabs/dex-react'
import { forms } from '../data/mockData'
import FormRow from '../components/marketing/FormRow'

const ITEMS_PER_PAGE = 10
const TOTAL = 131
const TOTAL_PAGES = 14

export default function Marketing() {
  const [tab, setTab] = useState<'public' | 'internal'>('public')
  const [page, setPage] = useState(1)

  const tabForms = forms.filter((f) => f.type === tab)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#F4F4F7' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E7E7E7', padding: '16px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#2C2C2C', margin: 0 }}>Forms</h1>
          <DexButton variant="solid" color="default" leadingIcon="add">
            Create form
          </DexButton>
        </div>

        {/* Tabs */}
        <DexTabs
          value={tab}
          onValueChange={(v) => { setTab(v as 'public' | 'internal'); setPage(1) }}
          defaultValue="public"
        >
          <DexTabsList>
            <DexTabsTrigger value="public">Public forms</DexTabsTrigger>
            <DexTabsTrigger value="internal">Internal forms</DexTabsTrigger>
          </DexTabsList>
        </DexTabs>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <DexCard elevation="flat" style={{ padding: 0, overflow: 'hidden' }}>
          <DexTable label="Forms">
            <DexTableHeader>
              <tr>
                <DexTableHeaderCell>Form name</DexTableHeaderCell>
                <DexTableHeaderCell>Date created</DexTableHeaderCell>
                <DexTableHeaderCell>Last edited</DexTableHeaderCell>
                <DexTableHeaderCell alignX="center" width="50px">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.75">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </DexTableHeaderCell>
                <DexTableHeaderCell width="40px"> </DexTableHeaderCell>
              </tr>
            </DexTableHeader>
            <DexTableBody>
              {tabForms.map((form) => (
                <FormRow key={form.id} form={form} />
              ))}
            </DexTableBody>
          </DexTable>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #E7E7E7', background: '#FAFAFA' }}>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
              Showing {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, TOTAL)} of {TOTAL}
            </p>
            <DexOffsetPager
              size="dense"
              totalPages={TOTAL_PAGES}
              currentPage={page}
              onCurrentPageChange={setPage}
            />
          </div>
        </DexCard>
      </div>
    </div>
  )
}
