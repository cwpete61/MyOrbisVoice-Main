'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

// AffiliateAccount shape — see services/affiliate.service.ts:getAffiliateAccount
type Account = {
  id: string
  status: string
  totalEarnedCents: number
  totalPaidCents: number
  payoutMethodJson: Record<string, string> | null
}

// Stats shape — used to compute the "approved balance" available for payout
type Stats = {
  approvedCents: number
}

// AffiliatePayoutRequest model fields
type PayoutRequest = {
  id: string
  amountCents: number       // not "requestedAmountCents"
  currency: string
  status: string
  requestedAt: string
  processedAt: string | null
  payoutRef: string | null
  notes: string | null
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:   { bg: 'oklch(65% 0.18 60 / 0.12)',  text: 'oklch(50% 0.15 60)',  label: 'Pending' },
  PROCESSING:{ bg: 'oklch(55% 0.18 220 / 0.12)', text: 'oklch(45% 0.15 220)', label: 'Processing' },
  PAID:      { bg: 'oklch(55% 0.18 145 / 0.12)', text: 'oklch(45% 0.15 145)', label: 'Paid' },
  REJECTED:  { bg: 'oklch(55% 0.18 15 / 0.12)',  text: 'oklch(45% 0.15 15)',  label: 'Rejected' },
}

function fmt(cents: number) { return '$' + (cents / 100).toFixed(2) }

export default function PayoutsPage() {
  const [account, setAccount] = useState<Account | null>(null)
  const [stats, setStats]   = useState<Stats | null>(null)
  const [requests, setRequests] = useState<PayoutRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)

  async function load() {
    const [acc, st, reqs] = await Promise.all([
      apiFetch<Account>('/api/affiliate/account').catch(() => null),
      apiFetch<Stats>('/api/affiliate/stats').catch(() => null),
      apiFetch<PayoutRequest[]>('/api/affiliate/payout/requests').catch(() => []),
    ])
    setAccount(acc)
    setStats(st)
    setRequests(reqs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function requestPayout() {
    setRequesting(true)
    try {
      await apiFetch('/api/affiliate/payout/request', { method: 'POST' })
      await load()
    } catch (e: unknown) {
      alert((e as Error).message ?? 'Payout request failed')
    }
    setRequesting(false)
  }

  if (loading) return <div className="text-sm pt-8" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>

  const approvedBalanceCents = stats?.approvedCents ?? 0
  const payoutMethodLabel = account?.payoutMethodJson?.['type'] ?? null
  const canRequest = approvedBalanceCents > 0

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Payouts</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Request payment of your approved commission balance.</p>

      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Available Balance</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(approvedBalanceCents)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Approved commissions only</p>
        </div>

        <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Payout Method</p>
          <p className="text-sm font-medium" style={{ color: payoutMethodLabel ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
            {payoutMethodLabel ?? 'Not configured'}
          </p>
          {account?.payoutMethodJson && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              {Object.entries(account.payoutMethodJson).filter(([k]) => k !== 'type').map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </p>
          )}
        </div>
      </div>

      <div className="mb-8">
        <button
          onClick={requestPayout}
          disabled={!canRequest || requesting}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: canRequest ? 'var(--brand-primary)' : 'var(--surface-raised)', color: canRequest ? '#fff' : 'var(--text-tertiary)', border: canRequest ? 'none' : '1px solid var(--border-subtle)', cursor: canRequest ? 'pointer' : 'not-allowed' }}
        >
          {requesting ? 'Submitting…' : `Request Payout of ${fmt(approvedBalanceCents)}`}
        </button>
        {!canRequest && (
          <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>You need approved commissions before requesting a payout.</p>
        )}
      </div>

      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Payout History</h2>
      {requests.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No payout requests yet.</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Requested</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Amount</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Reference</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Processed</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, i) => {
                const style = STATUS_STYLE[r.status] ?? STATUS_STYLE['PENDING']!
                return (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{new Date(r.requestedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(r.amountCents ?? 0)}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: style.bg, color: style.text }}>{style.label}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{r.payoutRef ?? '—'}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)' }}>{r.processedAt ? new Date(r.processedAt).toLocaleDateString() : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
