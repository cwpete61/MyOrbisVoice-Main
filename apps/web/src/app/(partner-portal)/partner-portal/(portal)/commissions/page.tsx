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

      {/* How payment works — explains the holdback + Stripe fee model.
          Always visible so partners understand why their net differs from gross. */}
      <PaymentExplainer />

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

// ─── Payment explainer ────────────────────────────────────────────────────────
// Tells the partner exactly how/when commissions become real money in their
// bank, and why the net amount differs from the gross commission. Visible on
// every commissions page load so it's always one click away when a partner
// has a question.
const TEAL = 'oklch(55% 0.11 193)'
const TEAL_TINT = 'oklch(55% 0.11 193 / 0.08)'

function PaymentExplainer() {
  const [open, setOpen] = useState(true)
  return (
    <div
      className="rounded-xl mb-6 overflow-hidden"
      style={{ background: TEAL_TINT, border: '1px solid oklch(55% 0.11 193 / 0.25)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ color: 'var(--text-primary)' }}
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
          <span className="text-sm font-semibold">How you get paid</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', color: 'var(--text-tertiary)' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm space-y-3" style={{ color: 'var(--text-secondary)' }}>
          <div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>1. 30-day hold (refund window)</p>
            <p className="text-xs leading-relaxed">
              When a customer subscribes, your commission is locked for 30 days. If the customer refunds during that window, the commission gets reversed and you don&apos;t see it. After 30 days, the commission becomes eligible for payout. Recurring renewals from existing customers skip the hold.
            </p>
          </div>

          <div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>2. Auto-payout on the 1st &amp; 15th</p>
            <p className="text-xs leading-relaxed">
              Eligible commissions are batched and paid automatically twice a month. If the 1st or 15th lands on a weekend, the payout fires the next business day. Each commission&apos;s exact payout date is shown in the &quot;Pays on&quot; column above.
            </p>
          </div>

          <div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>3. Stripe processing fees come out of your payout</p>
            <p className="text-xs leading-relaxed">
              We pay you via Stripe direct deposit to your bank. Stripe charges two fees that are deducted from each payout:
            </p>
            <ul className="text-xs leading-relaxed mt-1.5 ml-4 list-disc space-y-0.5">
              <li><strong>$2 / month</strong> — Stripe Connect Express monthly fee, billed once per month on your first payout (only on months you actually receive a payout).</li>
              <li><strong>~$0 standard ACH</strong> (1–3 business day settlement) or <strong>1.5% (min $0.50) instant</strong> if you opt for same-day deposit.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Worked example</p>
            <table className="text-xs w-full max-w-md">
              <tbody>
                <tr><td className="py-0.5" style={{ color: 'var(--text-tertiary)' }}>Commission earned</td><td className="text-right tabular-nums">$100.00</td></tr>
                <tr><td className="py-0.5" style={{ color: 'var(--text-tertiary)' }}>− Stripe Connect monthly fee (first payout this month)</td><td className="text-right tabular-nums" style={{ color: 'oklch(55% 0.18 25)' }}>− $2.00</td></tr>
                <tr><td className="py-0.5" style={{ color: 'var(--text-tertiary)' }}>− Standard ACH transfer fee</td><td className="text-right tabular-nums" style={{ color: 'oklch(55% 0.18 25)' }}>− $0.00</td></tr>
                <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td className="py-1 font-semibold" style={{ color: 'var(--text-primary)' }}>Net deposited to your bank</td>
                  <td className="text-right py-1 font-semibold tabular-nums" style={{ color: TEAL }}>$98.00</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
              The $2 monthly fee only hits once per month — every additional payout the same month is fee-free (or just the transfer fee if you pick instant).
            </p>
          </div>

          <div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Minimum balance</p>
            <p className="text-xs leading-relaxed">
              You need at least <strong>$50</strong> in approved commissions for a payout cycle to fire. If your eligible balance is below the minimum on a 1st or 15th, it rolls into the next cycle.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
