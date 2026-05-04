'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'

// ─── API contracts ────────────────────────────────────────────────────────────
type Account = {
  id: string
  status: string
  referralCode: string
  totalEarnedCents: number
  totalPaidCents: number
}

type Stats = {
  clicks: number
  conversions: number
  pendingCents: number
  approvedCents: number
  holdCents: number
  paidCents: number
  reversedCents: number
  totalEarnedCents: number
}

type PeriodStats = {
  days: number
  clicks: number
  conversions: number
  conversionRate: number
  pendingCents: number
  approvedCents: number
  paidCents: number
  totalEarnedCents: number
}

type Settings = {
  programName: string
  commissionRatePct: number
  cookieDurationDays: number
}

type Commission = {
  id: string
  amountMinor: number
  currency: string
  status: string
  createdAt: string
  paidAt: string | null
  affiliateConversion: {
    conversionType: string
    conversionValue: number | null
    occurredAt: string
  } | null
}

type CommissionsResp = { items: Commission[]; total: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TEAL = 'oklch(55% 0.11 193)'
const TEAL_TINT = 'oklch(55% 0.11 193 / 0.10)'

function fmtMoney(cents: number) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtNumber(n: number) {
  return n.toLocaleString('en-US')
}

function fmtPct(pct: number) {
  return pct.toFixed(2) + '%'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
}

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  PENDING:  { bg: 'oklch(95% 0.04 193)', fg: TEAL,                       label: 'Pending' },
  APPROVED: { bg: 'oklch(95% 0.05 145)', fg: 'oklch(45% 0.15 145)',      label: 'Approved' },
  PAID:     { bg: 'oklch(95% 0.05 145)', fg: 'oklch(45% 0.15 145)',      label: 'Paid' },
  HOLD:     { bg: 'oklch(95% 0.05 60)',  fg: 'oklch(50% 0.15 60)',       label: 'On Hold' },
  REVERSED: { bg: 'oklch(95% 0.05 25)',  fg: 'oklch(50% 0.15 25)',       label: 'Reversed' },
  CANCELLED:{ bg: 'oklch(95% 0 0)',      fg: 'oklch(55% 0 0)',           label: 'Cancelled' },
}

// ─── Card components ──────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, viewAllHref, variant = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: React.ReactNode
  viewAllHref?: string
  variant?: 'default' | 'feature'
}) {
  const isFeature = variant === 'feature'
  return (
    <div
      className="rounded-2xl p-5 flex flex-col"
      style={{
        background: isFeature ? TEAL : 'var(--surface-raised)',
        border: isFeature ? 'none' : '1px solid var(--border-subtle)',
        boxShadow: isFeature ? '0 8px 24px oklch(55% 0.11 193 / 0.25)' : 'none',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon circle */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: isFeature ? 'oklch(100% 0 0 / 0.18)' : TEAL_TINT,
            color: isFeature ? 'white' : TEAL,
          }}
        >
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium" style={{ color: isFeature ? 'oklch(100% 0 0 / 0.85)' : 'var(--text-tertiary)' }}>
            {label}
          </p>
          <p className="text-2xl font-bold mt-1 truncate" style={{ color: isFeature ? 'white' : 'var(--text-primary)' }}>
            {value}
          </p>
          {sub && (
            <div className="text-xs mt-1" style={{ color: isFeature ? 'oklch(100% 0 0 / 0.75)' : 'var(--text-tertiary)' }}>
              {sub}
            </div>
          )}
        </div>
      </div>

      {viewAllHref && !isFeature && (
        <Link
          href={viewAllHref}
          className="text-xs font-medium mt-4 self-start"
          style={{ color: TEAL, textDecoration: 'none' }}
        >
          View all
        </Link>
      )}
    </div>
  )
}

// ─── Icons (inline SVG, scaled to 18×18) ───────────────────────────────────────
const I = {
  referrals:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  visits:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
  rate:       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 6-6"/></svg>,
  cash:       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/><path d="M16 9.5a3 3 0 0 0-3-1.5h-2a2.5 2.5 0 0 0 0 5h2a2.5 2.5 0 0 1 0 5h-2a3 3 0 0 1-3-1.5"/></svg>,
  unpaid:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  paid:       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>,
  trophy:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
}

// ─── Get-paid checklist ───────────────────────────────────────────────────────
function GetPaidChecklist({
  accountActive, approvedBalanceCents, minPayoutCents,
  payoutMethodConnected, taxFormSubmitted,
}: {
  accountActive: boolean
  approvedBalanceCents: number
  minPayoutCents: number
  payoutMethodConnected: boolean
  taxFormSubmitted: boolean
}) {
  const reachedMin = approvedBalanceCents >= minPayoutCents
  const items = [
    {
      done: accountActive,
      title: 'Partner account active',
      detail: accountActive ? 'You can start sharing your referral link.' : 'Application is being reviewed.',
      action: null as { label: string; href: string } | null,
    },
    {
      done: payoutMethodConnected,
      title: 'Connect your payout account',
      detail: payoutMethodConnected
        ? 'Stripe payout account verified.'
        : 'Coming soon — secure bank deposit via Stripe. We\'ll notify you when this is live.',
      action: payoutMethodConnected ? null : null, // Will become actionable when Stripe Connect lands
    },
    {
      done: taxFormSubmitted,
      title: 'Submit tax info (W-9 / W-8BEN)',
      detail: taxFormSubmitted
        ? 'On file with Stripe — they\'ll mail you a 1099-NEC at year-end if you earn $600+.'
        : 'Collected automatically when you connect your payout account.',
      action: null,
    },
    {
      done: reachedMin,
      title: `Earn at least $${(minPayoutCents / 100).toFixed(0)} in approved commissions`,
      detail: reachedMin
        ? 'Minimum payout balance reached.'
        : `Currently $${(approvedBalanceCents / 100).toFixed(2)} of $${(minPayoutCents / 100).toFixed(0)} needed.`,
      action: null,
    },
  ]

  // Once ALL items are complete, the checklist hides itself (clean dashboard for active earners)
  if (items.every(i => i.done)) return null

  return (
    <section className="mb-10">
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            What you need to get paid
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Complete these steps to start receiving commissions. You can earn referrals before completing them — payment just won&apos;t process until everything is checked.
          </p>
        </div>
        <ul>
          {items.map((item, i) => (
            <li
              key={item.title}
              className="flex items-start gap-3 px-5 py-3"
              style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}
            >
              {/* Checkmark / pending circle */}
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                style={{
                  background: item.done ? TEAL : 'transparent',
                  border: item.done ? 'none' : '1.5px solid var(--border-subtle)',
                  color: 'white',
                }}
              >
                {item.done && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium"
                  style={{ color: item.done ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: item.done ? 'line-through' : undefined }}
                >
                  {item.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PartnerDashboardPage() {
  const [account, setAccount]       = useState<Account | null>(null)
  const [allTime, setAllTime]       = useState<Stats | null>(null)
  const [period, setPeriod]         = useState<PeriodStats | null>(null)
  const [settings, setSettings]     = useState<Settings | null>(null)
  const [recent, setRecent]         = useState<Commission[]>([])
  const [firstName, setFirstName]   = useState<string>('')
  const [loading, setLoading]       = useState(true)
  const [applying, setApplying]     = useState(false)

  async function load() {
    setLoading(true)
    try {
      const acc = await apiFetch<Account>('/api/affiliate/account').catch(() => null)
      setAccount(acc)
      if (acc) {
        const [s, p, sett, comms, me] = await Promise.all([
          apiFetch<Stats>('/api/affiliate/stats').catch(() => null),
          apiFetch<PeriodStats>('/api/affiliate/stats/period?days=30').catch(() => null),
          apiFetch<Settings>('/api/public/affiliate/settings').catch(() => null),
          apiFetch<CommissionsResp>('/api/affiliate/commissions?page=1&limit=5').catch(() => ({ items: [], total: 0 })),
          apiFetch<{ user: { firstName: string | null } }>('/api/auth/me').catch(() => null),
        ])
        setAllTime(s)
        setPeriod(p)
        setSettings(sett)
        setRecent(comms?.items ?? [])
        setFirstName(me?.user?.firstName ?? '')
      }
    } finally {
      setLoading(false)
    }
  }

  async function apply() {
    setApplying(true)
    try {
      await apiFetch('/api/affiliate/apply', { method: 'POST' })
      await load()
    } catch (e) {
      alert((e as Error).message ?? 'Application failed')
    }
    setApplying(false)
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return <div className="text-sm pt-8" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
  }

  // No partner account yet → application CTA
  if (!account) {
    return (
      <div className="max-w-lg">
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Join the Partner Program</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Earn commissions by referring customers to OrbisVoice. Once approved, you'll get a unique referral link and real-time tracking.
        </p>
        <button
          onClick={apply} disabled={applying}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: TEAL, color: '#fff' }}
        >
          {applying ? 'Submitting…' : 'Apply to Become a Partner'}
        </button>
      </div>
    )
  }

  // PENDING banner — application under review
  const showPendingBanner = account.status === 'PENDING'

  // Conversion rate (all-time, computed)
  const allTimeConvRate = allTime && allTime.clicks > 0
    ? (allTime.conversions / allTime.clicks) * 100
    : 0

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Welcome{firstName ? ` ${firstName}` : ''}
        </h1>
        {settings && (
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
            You earn <span style={{ color: TEAL, fontWeight: 600 }}>{settings.commissionRatePct}%</span> recurring commission on every active subscription you refer.
          </p>
        )}
      </div>

      {showPendingBanner && (
        <div className="rounded-xl p-4 mb-8 text-sm" style={{
          background: 'oklch(96% 0.08 80)',
          border: '1px solid oklch(75% 0.15 80)',
          color: 'oklch(40% 0.13 60)',
        }}>
          <strong>Application under review.</strong> We'll notify you by email once your partner account is approved. You won't be able to track conversions until then.
        </div>
      )}

      {/* Get-paid checklist — visible until ALL items are complete, then auto-hides.
          Each item shows the partner exactly what's needed to receive a payout. */}
      <GetPaidChecklist
        accountActive={account.status === 'ACTIVE'}
        approvedBalanceCents={allTime?.approvedCents ?? 0}
        minPayoutCents={5000}
        payoutMethodConnected={false /* TODO: from Stripe Connect status when wired */}
        taxFormSubmitted={false /* TODO: from Stripe Connect KYC */}
      />

      {/* Last 30 days */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Last 30 days</h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <StatCard
            icon={I.referrals}
            label="Referrals"
            value={fmtNumber(period?.conversions ?? 0)}
            viewAllHref="/partner-portal/referrals"
          />
          <StatCard
            icon={I.visits}
            label="Visits"
            value={fmtNumber(period?.clicks ?? 0)}
            viewAllHref="/partner-portal/referrals"
          />
          <StatCard
            icon={I.rate}
            label="Conversion Rate"
            value={fmtPct(period?.conversionRate ?? 0)}
          />
        </div>
      </section>

      {/* All-time */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>All-time</h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <StatCard
            icon={I.referrals}
            label="Referrals"
            value={fmtNumber(allTime?.conversions ?? 0)}
            viewAllHref="/partner-portal/commissions"
          />
          <StatCard
            icon={I.visits}
            label="Visits"
            value={fmtNumber(allTime?.clicks ?? 0)}
          />
          <StatCard
            icon={I.rate}
            label="Conversion Rate"
            value={fmtPct(allTimeConvRate)}
          />
          <StatCard
            icon={I.unpaid}
            label="Unpaid Earnings"
            value={fmtMoney((allTime?.pendingCents ?? 0) + (allTime?.approvedCents ?? 0))}
            sub={<span>Pending + approved</span>}
            viewAllHref="/partner-portal/commissions"
          />
          <StatCard
            icon={I.paid}
            label="Paid Earnings"
            value={fmtMoney(allTime?.paidCents ?? 0)}
            viewAllHref="/partner-portal/payouts"
          />
          <StatCard
            icon={I.trophy}
            label="Total Earnings"
            value={fmtMoney(allTime?.totalEarnedCents ?? 0)}
            sub={<span style={{ color: 'oklch(100% 0 0 / 0.85)' }}>Lifetime — every commission you've earned</span>}
            variant="feature"
          />
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Recent referral activity</h2>
        {recent.length === 0 ? (
          <div className="rounded-xl p-8 text-center text-sm" style={{
            background: 'var(--surface-raised)',
            border: '1px dashed var(--border-subtle)',
            color: 'var(--text-tertiary)',
          }}>
            No commissions yet. Your earnings will appear here once your referrals subscribe.
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Reference</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c, i) => {
                  const pill = STATUS_PILL[c.status] ?? STATUS_PILL['PENDING']!
                  return (
                    <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{c.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{fmtMoney(c.amountMinor)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{c.affiliateConversion?.conversionType ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: pill.bg, color: pill.fg }}>
                          {pill.label}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-tertiary)' }}>{fmtDate(c.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 text-xs text-center" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
              <Link href="/partner-portal/commissions" style={{ color: TEAL, fontWeight: 500, textDecoration: 'none' }}>
                View all commissions →
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
