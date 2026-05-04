'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

// Shape returned by GET /api/affiliate/account — see services/affiliate.service.ts
type Account = {
  id: string
  status: string
  referralCode: string
  totalEarnedCents: number
  totalPaidCents: number
}

// Shape returned by GET /api/affiliate/stats — see services/affiliate.service.ts:getAffiliateStats
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

// Shape returned by GET /api/public/affiliate/settings (public, no auth)
type Settings = {
  programName: string
  commissionRatePct: number
  cookieDurationDays: number
}

function fmt(cents: number) {
  return '$' + (cents / 100).toFixed(2)
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
    </div>
  )
}

export default function AffiliateDashboardPage() {
  const [account, setAccount] = useState<Account | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const acc = await apiFetch<Account>('/api/affiliate/account')
      setAccount(acc)
      if (acc) {
        const [s, sett] = await Promise.all([
          apiFetch<Stats>('/api/affiliate/stats'),
          apiFetch<Settings>('/api/public/affiliate/settings').catch(() => null),
        ])
        setStats(s)
        setSettings(sett)
      }
    } catch {
      // not yet a partner
    }
    setLoading(false)
  }

  async function apply() {
    setApplying(true)
    try {
      await apiFetch('/api/affiliate/apply', { method: 'POST' })
      await load()
    } catch (e: unknown) {
      alert((e as Error).message ?? 'Application failed')
    }
    setApplying(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <div style={{ color: 'var(--text-tertiary)' }} className="text-sm pt-8">Loading…</div>

  if (!account) {
    return (
      <div className="max-w-lg">
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Join the Partner Program</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Earn commissions by referring customers to OrbisVoice. Once approved, you'll get a unique referral link and real-time tracking.
        </p>
        <button
          onClick={apply}
          disabled={applying}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--brand-primary)', color: '#fff' }}
        >
          {applying ? 'Submitting…' : 'Apply to Become a Partner'}
        </button>
      </div>
    )
  }

  const statusColor = account.status === 'ACTIVE' ? 'oklch(55% 0.18 145)' : account.status === 'PENDING' ? 'oklch(65% 0.18 60)' : 'var(--text-tertiary)'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Partner performance overview</p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: `color-mix(in oklch, ${statusColor} 15%, transparent)`, color: statusColor }}>
          {account.status}
        </span>
      </div>

      {account.status === 'PENDING' && (
        <div className="rounded-xl p-4 mb-6 text-sm" style={{ background: 'oklch(65% 0.18 60 / 0.1)', border: '1px solid oklch(65% 0.18 60 / 0.3)', color: 'oklch(55% 0.15 60)' }}>
          Your application is under review. We'll notify you once approved.
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <StatCard label="Lifetime Earnings" value={fmt(stats.totalEarnedCents ?? 0)} />
          <StatCard label="Pending Balance" value={fmt(stats.pendingCents ?? 0)} sub="Awaiting approval" />
          <StatCard label="Approved Balance" value={fmt(stats.approvedCents ?? 0)} sub="Ready to request" />
          <StatCard label="Total Clicks" value={String(stats.clicks ?? 0)} />
          <StatCard label="Conversions" value={String(stats.conversions ?? 0)} />
          <StatCard
            label="Conversion Rate"
            value={
              (stats.clicks ?? 0) > 0
                ? (((stats.conversions ?? 0) / stats.clicks) * 100).toFixed(1) + '%'
                : '—'
            }
          />
        </div>
      )}

      {settings && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-tertiary)' }}>YOUR COMMISSION RATE</p>
          <p className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{settings.commissionRatePct}%</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Recurring on every active subscription you refer</p>
        </div>
      )}
    </div>
  )
}
