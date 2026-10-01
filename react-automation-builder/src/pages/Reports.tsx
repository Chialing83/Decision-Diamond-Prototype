import React from 'react'
import { DexButton, DexLink } from '@thryvlabs/dex-react'

const cardStyle = {
  background: '#FAFAFA',
  border: '1px solid #E7E7E7',
  borderRadius: 12,
  overflow: 'hidden',
}

const reportCategories = [
  {
    title: 'Sales Reports',
    reports: [
      { name: 'All sales report', desc: 'View all sales transactions for any date range', isNew: false },
      { name: 'Revenue by contact', desc: 'Breakdown of revenue attributed to each contact', isNew: true },
      { name: 'Pipeline report', desc: 'Deal flow and conversion rates across stages', isNew: false },
    ],
  },
  {
    title: 'Contact Reports',
    reports: [
      { name: 'New leads report', desc: 'Track lead acquisition over time', isNew: false },
      { name: 'Contact growth', desc: 'Monitor your contact list growth', isNew: true },
    ],
  },
  {
    title: 'Marketing Reports',
    reports: [
      { name: 'Email broadcast report', desc: 'Open rates, click rates, and engagement metrics', isNew: false },
      { name: 'Form submissions', desc: 'Track form completion rates and sources', isNew: false },
    ],
  },
]

export default function Reports() {
  return (
    <div style={{ background: '#F4F4F7', minHeight: '100vh', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#2C2C2C', marginBottom: 20 }}>Reports</h1>

      {/* Top stat card */}
      <div style={{ ...cardStyle, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13, color: '#656565', margin: '0 0 4px', fontWeight: 500 }}>All sales for last 30 days</p>
          <p style={{ fontSize: 48, fontWeight: 300, color: '#2C2C2C', margin: 0 }}>$0.00</p>
        </div>
        <DexLink as="button" trailingIcon="arrow-right">
          All sales report
        </DexLink>
      </div>

      {/* Reports heading row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#2C2C2C', margin: 0 }}>Reports</h2>
        <DexLink
          as="button"
          trailing={
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#343434', color: '#fff', fontWeight: 700 }}>
              NEW
            </span>
          }
        >
          View all reports
        </DexLink>
      </div>

      {/* Report category cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reportCategories.map((category) => (
          <div key={category.title} style={cardStyle}>
            <div style={{ padding: '10px 20px', background: '#F4F4F7', borderBottom: '1px solid #E7E7E7' }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {category.title}
              </h3>
            </div>
            {category.reports.map((report, i) => (
              <div
                key={report.name}
                style={{
                  borderBottom: i < category.reports.length - 1 ? '1px solid #F0F0F0' : 'none',
                  background: '#FAFAFA',
                }}
              >
                <DexButton
                  variant="transparent"
                  color="neutral"
                  size="stretch"
                  trailingIcon="chevron-right"
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2C' }}>{report.name}</span>
                      {report.isNew && (
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#343434', color: '#fff', fontWeight: 700 }}>
                          NEW
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: '#656565', margin: '3px 0 0' }}>{report.desc}</p>
                  </div>
                </DexButton>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
