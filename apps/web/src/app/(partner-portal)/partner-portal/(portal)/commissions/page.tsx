'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

// Shape returned by GET /api/affiliate/commissions — see services/affiliate.service.ts:getCommissions
// Maps directly to the AffiliateCommission Prisma model with the joined affiliateConversion.
type Commission = {
  id: string
  amountMinor: number       // not "amountCents" — the schema uses generic 'minor units'
  currency: string
  status: string
  approvedAt: string | null
  paidAt: string | null
  reversedAt: string | null
  holdReason: string | null
  payoutRef: string | null
  eligibleAt: string         // when 30-day hold ends (or createdAt for renewals)
  scheduledPayoutDate: string | null  // next 1st-or-15th >= eligibleAt, biz-day-adjusted
  createdAt: string
  affiliateConversion: {
    conversionType: string
    conversionValue: number | null
    occurredAt: string
  } | null
}

type PagedResult = {
  items: Commission[]
  total: number
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:  { bg: 'oklch(65% 0.18 60 / 0.12)',  text: 'oklch(50% 0.15 60)',  label: 'Pending' },
  APPROVED: { bg: 'oklch(55% 0.18 145 / 0.12)', text: 'oklch(45% 0.15 145)', label: 'Approved' },
  PAID:     { bg: 'oklch(55% 0.18 220 / 0.12)', text: 'oklch(45% 0.15 220)', label: 'Paid' },
  HELD:     { bg: 'oklch(65% 0.18 30 / 0.12)',  text: 'oklch(50% 0.15 30)',  label: 'On Hold' },
  REVERSED: { bg: 'oklch(55% 0.18 15 / 0.12)',  text: 'oklch(45% 0.15 15)',  label: 'Reversed' },
}

function fmt(cents: number) { return '$' + (cents / 100).toFixed(2) }

export default function CommissionsPage() {
  const [result, setResult] = useState<PagedResult | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiFetch<PagedResult>(`/api/affiliate/commissions?page=${page}&limit=20`)
      .then(r => { setResult(r); setLoading(false) })
      .catch(() => setLoading(false))
  }, [page])

  const items = result?.items ?? []
  const total = result?.total ?? 0
  const pages = Math.ceil(total / 20)

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Commissions</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Earnings generated from your referrals.</p>

      {loading ? (
        <div className="text-sm pt-4" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl p-6 text-center text-sm" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
          No commissions yet. Commissions are created when your referrals subscribe.
        </div>
      ) : (
        <>
          <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Description</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Amount</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Pays on</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Paid</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c, i) => {
                  const style = STATUS_STYLE[c.status] ?? STATUS_STYLE['PENDING']!
                  // "Pays on" only shows if not yet paid. Once paid, the Paid column tells the story.
                  const showsPaysOn = c.status !== 'PAID' && c.status !== 'REVERSED' && c.scheduledPayoutDate
                  return (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{c.affiliateConversion?.conversionType ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(c.amountMinor ?? 0)}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: style.bg, color: style.text }}>{style.label}</span>
                      </td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)' }}>
                        {showsPaysOn ? new Date(c.scheduledPayoutDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)' }}>
                        {c.paidAt ? new Date(c.paidAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', opacity: page === 1 ? 0.4 : 1 }}>← Prev</button>
              <span style={{ color: 'var(--text-tertiary)' }}>Page {page} of {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', opacity: page === pages ? 0.4 : 1 }}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
