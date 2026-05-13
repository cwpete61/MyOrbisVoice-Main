'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { useUserTimezone, formatInTimezone } from '@/lib/timezone'

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
  eligibleAt: string
  scheduledPayoutDate: string | null
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

function fmtNumber(n: number, locale: string) {
  return n.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US')
}

function fmtPct(pct: number) {
  return pct.toFixed(2) + '%'
}

function fmtDate(iso: string, locale: string, tz: string) {
  const tag = locale === 'es' ? 'es-MX' : 'en-US'
  const date = formatInTimezone(iso, { tz, locale: tag, month: 'short', day: 'numeric', year: 'numeric' })
  const time = formatInTimezone(iso, { tz, locale: tag, hour: 'numeric', minute: '2-digit' }).toLowerCase()
  return `${date} ${time}`
}

function fmtLongDate(iso: string, locale: string, tz: string) {
  const tag = locale === 'es' ? 'es-MX' : 'en-US'
  return formatInTimezone(iso, { tz, locale: tag, month: 'long', day: 'numeric', year: 'numeric' })
}

// ─── Card components ──────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, viewAllHref, viewAllLabel, variant = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: React.ReactNode
  viewAllHref?: string
  viewAllLabel: string
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
          {viewAllLabel}
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
  payoutMethodConnected, taxFormSubmitted, nextPayoutCommission,
  onStartConnect, connectStarting,
}: {
  accountActive: boolean
  approvedBalanceCents: number
  minPayoutCents: number
  payoutMethodConnected: boolean
  taxFormSubmitted: boolean
  nextPayoutCommission: { scheduledPayoutDate: string | null } | null
  onStartConnect: () => void
  connectStarting: boolean
}) {
  const t = useT()
  const { locale } = useLocale()
  const tz = useUserTimezone()
  const reachedMin = approvedBalanceCents >= minPayoutCents
  const nextPayoutDateStr = nextPayoutCommission?.scheduledPayoutDate
    ? fmtLongDate(nextPayoutCommission.scheduledPayoutDate, locale, tz)
    : null

  const minAmount = (minPayoutCents / 100).toFixed(0)
  const currentAmount = (approvedBalanceCents / 100).toFixed(2)

  const items = [
    {
      done: accountActive,
      title: t('partnerDashboard.checklist.activeTitle'),
      detail: accountActive
        ? t('partnerDashboard.checklist.activeDoneDetail')
        : t('partnerDashboard.checklist.activePendingDetail'),
      action: null as React.ReactNode | null,
    },
    {
      done: payoutMethodConnected,
      title: t('partnerDashboard.checklist.payoutTitle'),
      detail: payoutMethodConnected
        ? t('partnerDashboard.checklist.payoutDoneDetail')
        : t('partnerDashboard.checklist.payoutTodoDetail'),
      action: !payoutMethodConnected && accountActive ? (
        <button
          onClick={onStartConnect}
          disabled={connectStarting}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
          style={{ background: TEAL, color: '#fff', opacity: connectStarting ? 0.6 : 1 }}
        >
          {connectStarting
            ? t('partnerDashboard.checklist.connecting')
            : t('partnerDashboard.checklist.connectNow')}
        </button>
      ) : null,
    },
    {
      done: taxFormSubmitted,
      title: t('partnerDashboard.checklist.taxTitle'),
      // Stripe Connect Express collects W-9 / W-8BEN as part of the onboarding
      // form. Once payouts are enabled, tax info is on file too. So this item
      // mirrors the connect status — separate line in the UI for clarity, but
      // it flips together.
      detail: taxFormSubmitted
        ? t('partnerDashboard.checklist.taxDoneDetail')
        : t('partnerDashboard.checklist.taxTodoDetail'),
      action: null,
    },
    {
      done: reachedMin,
      title: t('partnerDashboard.checklist.minTitle', { amount: minAmount }),
      detail: nextPayoutDateStr
        ? t('partnerDashboard.checklist.minTodoNextPayoutDetail', { current: currentAmount, target: minAmount, date: nextPayoutDateStr })
        : reachedMin
          ? t('partnerDashboard.checklist.minDoneDetail')
          : t('partnerDashboard.checklist.minTodoDetail', { current: currentAmount, target: minAmount }),
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
            {t('partnerDashboard.checklist.title')}
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerDashboard.checklist.desc')}
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
              {item.action && <div className="flex-shrink-0">{item.action}</div>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PartnerDashboardPage() {
  const t = useT()
  const { locale } = useLocale()
  const tz = useUserTimezone()
  const [account, setAccount]       = useState<Account | null>(null)
  const [allTime, setAllTime]       = useState<Stats | null>(null)
  const [period, setPeriod]         = useState<PeriodStats | null>(null)
  const [settings, setSettings]     = useState<Settings | null>(null)
  const [recent, setRecent]         = useState<Commission[]>([])
  const [firstName, setFirstName]   = useState<string>('')
  const [loading, setLoading]       = useState(true)
  const [applying, setApplying]     = useState(false)
  const [connect, setConnect]       = useState<{ payoutsEnabled: boolean; detailsSubmitted: boolean } | null>(null)
  const [connectStarting, setConnectStarting] = useState(false)
  // Partner public-page state — slug + partnerPageActive drive the Share-your-
  // booking-page card. Loaded via /api/partner/me alongside the existing fetches.
  const [partnerInfo, setPartnerInfo] = useState<{ slug: string | null; partnerPageActive: boolean } | null>(null)
  const [copiedBookingUrl, setCopiedBookingUrl] = useState(false)

  const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
    PENDING:  { bg: 'oklch(95% 0.04 193)', fg: TEAL,                       label: t('partnerDashboard.statusPill.pending') },
    APPROVED: { bg: 'oklch(95% 0.05 145)', fg: 'oklch(45% 0.15 145)',      label: t('partnerDashboard.statusPill.approved') },
    PAID:     { bg: 'oklch(95% 0.05 145)', fg: 'oklch(45% 0.15 145)',      label: t('partnerDashboard.statusPill.paid') },
    HOLD:     { bg: 'oklch(95% 0.05 60)',  fg: 'oklch(50% 0.15 60)',       label: t('partnerDashboard.statusPill.hold') },
    REVERSED: { bg: 'oklch(95% 0.05 25)',  fg: 'oklch(50% 0.15 25)',       label: t('partnerDashboard.statusPill.reversed') },
    CANCELLED:{ bg: 'oklch(95% 0 0)',      fg: 'oklch(55% 0 0)',           label: t('partnerDashboard.statusPill.cancelled') },
  }

  async function load() {
    setLoading(true)
    try {
      const acc = await apiFetch<Account>('/api/affiliate/account').catch(() => null)
      setAccount(acc)
      if (acc) {
        const [s, p, sett, comms, me, conn, partnerMe] = await Promise.all([
          apiFetch<Stats>('/api/affiliate/stats').catch(() => null),
          apiFetch<PeriodStats>('/api/affiliate/stats/period?days=30').catch(() => null),
          apiFetch<Settings>('/api/public/affiliate/settings').catch(() => null),
          apiFetch<CommissionsResp>('/api/affiliate/commissions?page=1&limit=5').catch(() => ({ items: [], total: 0 })),
          apiFetch<{ user: { firstName: string | null } }>('/api/auth/me').catch(() => null),
          apiFetch<{ payoutsEnabled: boolean; detailsSubmitted: boolean }>('/api/affiliate/connect/status').catch(() => null),
          apiFetch<{ partner: { slug: string | null; partnerPageActive: boolean } }>('/api/partner/me').catch(() => null),
        ])
        setAllTime(s)
        setPeriod(p)
        setSettings(sett)
        setRecent(comms?.items ?? [])
        setFirstName(me?.user?.firstName ?? '')
        setConnect(conn)
        if (partnerMe?.partner) {
          setPartnerInfo({
            slug:              partnerMe.partner.slug,
            partnerPageActive: partnerMe.partner.partnerPageActive,
          })
        }
      }
    } finally {
      setLoading(false)
    }
  }

  /** Kick off Stripe Connect Express onboarding — gets a one-shot URL and
   *  redirects the browser. Stripe sends them back to /partner-portal/payouts
   *  on completion (or refresh URL if they bail mid-onboarding). */
  async function startConnectOnboarding() {
    setConnectStarting(true)
    try {
      const origin = window.location.origin
      const result = await apiFetch<{ url: string }>('/api/affiliate/connect/onboard', {
        method: 'POST',
        body: JSON.stringify({
          returnUrl:  `${origin}/partner-portal/payouts?stripe=return`,
          refreshUrl: `${origin}/partner-portal/dashboard?stripe=refresh`,
        }),
      })
      window.location.href = result.url
    } catch (e) {
      alert((e as Error).message ?? 'Could not start payout setup')
      setConnectStarting(false)
    }
  }

  async function apply() {
    setApplying(true)
    try {
      await apiFetch('/api/affiliate/apply', { method: 'POST' })
      await load()
    } catch (e) {
      alert((e as Error).message ?? t('partnerDashboard.applicationFailed'))
    }
    setApplying(false)
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return <div className="text-sm pt-8" style={{ color: 'var(--text-tertiary)' }}>{t('actions.loading')}</div>
  }

  // No partner account yet → application CTA
  if (!account) {
    return (
      <div className="max-w-lg">
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{t('partnerDashboard.applyTitle')}</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          {t('partnerDashboard.applyDesc')}
        </p>
        <button
          onClick={apply} disabled={applying}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: TEAL, color: '#fff' }}
        >
          {applying ? t('partnerDashboard.submitting') : t('partnerDashboard.applyButton')}
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

  const viewAll = t('partnerDashboard.stats.viewAll')

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {firstName
            ? t('partnerDashboard.welcomeWithName', { name: firstName })
            : t('partnerDashboard.welcome')}
        </h1>
        {settings && (
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {(() => {
              const line = t('partnerDashboard.commissionLine', { pct: settings.commissionRatePct })
              // Highlight the percentage in teal — split on the rendered "{pct}%" substring
              const pctStr = `${settings.commissionRatePct}%`
              const parts = line.split(pctStr)
              if (parts.length !== 2) return line
              return (
                <>
                  {parts[0]}
                  <span style={{ color: TEAL, fontWeight: 600 }}>{pctStr}</span>
                  {parts[1]}
                </>
              )
            })()}
          </p>
        )}
      </div>

      {showPendingBanner && (
        <div className="rounded-xl p-4 mb-8 text-sm" style={{
          background: 'oklch(96% 0.08 80)',
          border: '1px solid oklch(75% 0.15 80)',
          color: 'oklch(40% 0.13 60)',
        }}>
          <strong>{t('partnerDashboard.pendingTitle')}</strong> {t('partnerDashboard.pendingDesc')}
        </div>
      )}

      {/* Get-paid checklist — visible until ALL items are complete, then auto-hides.
          Each item shows the partner exactly what's needed to receive a payout. */}
      <GetPaidChecklist
        accountActive={account.status === 'ACTIVE'}
        approvedBalanceCents={allTime?.approvedCents ?? 0}
        minPayoutCents={5000}
        // Stripe Connect Express onboarding handles payouts AND tax forms in
        // one flow. Both checklist items flip true once Stripe says
        // payoutsEnabled.
        payoutMethodConnected={!!connect?.payoutsEnabled}
        taxFormSubmitted={!!connect?.detailsSubmitted}
        nextPayoutCommission={recent.find(c => c.status !== 'PAID' && c.status !== 'REVERSED' && c.scheduledPayoutDate) ?? null}
        onStartConnect={startConnectOnboarding}
        connectStarting={connectStarting}
      />

      {/* Your public booking page — shown when the partner has a slug AND
          partnerPageActive=true. When inactive, surfaces a CTA to Profile. */}
      {partnerInfo?.slug && (() => {
        const bookingUrl = `https://app.myorbisvoice.com/book/${partnerInfo.slug}`
        const isLive     = partnerInfo.partnerPageActive
        return (
          <section className="mb-10">
            <div className="rounded-xl p-5"
                 style={{
                   background: isLive ? 'oklch(96% 0.04 193)' : 'var(--surface-raised)',
                   border:     '1px solid ' + (isLive ? 'oklch(80% 0.10 193)' : 'var(--border-subtle)'),
                 }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1"
                     style={{ color: 'var(--text-tertiary)' }}>
                    {t('partnerDashboard.bookingLink.heading')}
                  </p>
                  <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {isLive
                      ? t('partnerDashboard.bookingLink.descActive')
                      : t('partnerDashboard.bookingLink.descInactive')}
                  </p>
                  <code className="block w-full text-xs px-3 py-2 rounded-md font-mono"
                        style={{
                          background: 'var(--surface-app)',
                          border:     '1px solid var(--border-subtle)',
                          color:      isLive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                          opacity:    isLive ? 1 : 0.6,
                          wordBreak:  'break-all',
                        }}>
                    {bookingUrl}
                  </code>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {isLive ? (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(bookingUrl)
                            setCopiedBookingUrl(true)
                            setTimeout(() => setCopiedBookingUrl(false), 2000)
                          } catch { /* clipboard blocked — ignore */ }
                        }}
                        className="px-3 py-2 rounded-md text-xs font-semibold"
                        style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                        {copiedBookingUrl
                          ? `✓ ${t('partnerDashboard.bookingLink.copied')}`
                          : t('partnerDashboard.bookingLink.copy')}
                      </button>
                      <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                         className="px-3 py-2 rounded-md text-xs font-semibold"
                         style={{ background: TEAL, color: '#fff', textDecoration: 'none' }}>
                        {t('partnerDashboard.bookingLink.open')} ↗
                      </a>
                    </>
                  ) : (
                    <Link href="/partner-portal/profile"
                          className="px-3 py-2 rounded-md text-xs font-semibold"
                          style={{ background: TEAL, color: '#fff', textDecoration: 'none' }}>
                      {t('partnerDashboard.bookingLink.activate')} →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>
        )
      })()}

      {/* Last 30 days */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t('partnerDashboard.last30Days')}</h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <StatCard
            icon={I.referrals}
            label={t('partnerDashboard.stats.referrals')}
            value={fmtNumber(period?.conversions ?? 0, locale)}
            viewAllHref="/partner-portal/referrals"
            viewAllLabel={viewAll}
          />
          <StatCard
            icon={I.visits}
            label={t('partnerDashboard.stats.visits')}
            value={fmtNumber(period?.clicks ?? 0, locale)}
            viewAllHref="/partner-portal/referrals"
            viewAllLabel={viewAll}
          />
          <StatCard
            icon={I.rate}
            label={t('partnerDashboard.stats.conversionRate')}
            value={fmtPct(period?.conversionRate ?? 0)}
            viewAllLabel={viewAll}
          />
        </div>
      </section>

      {/* All-time */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t('partnerDashboard.allTime')}</h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <StatCard
            icon={I.referrals}
            label={t('partnerDashboard.stats.referrals')}
            value={fmtNumber(allTime?.conversions ?? 0, locale)}
            viewAllHref="/partner-portal/commissions"
            viewAllLabel={viewAll}
          />
          <StatCard
            icon={I.visits}
            label={t('partnerDashboard.stats.visits')}
            value={fmtNumber(allTime?.clicks ?? 0, locale)}
            viewAllLabel={viewAll}
          />
          <StatCard
            icon={I.rate}
            label={t('partnerDashboard.stats.conversionRate')}
            value={fmtPct(allTimeConvRate)}
            viewAllLabel={viewAll}
          />
          <StatCard
            icon={I.unpaid}
            label={t('partnerDashboard.stats.unpaidEarnings')}
            value={fmtMoney((allTime?.pendingCents ?? 0) + (allTime?.approvedCents ?? 0))}
            sub={<span>{t('partnerDashboard.stats.pendingApproved')}</span>}
            viewAllHref="/partner-portal/commissions"
            viewAllLabel={viewAll}
          />
          <StatCard
            icon={I.paid}
            label={t('partnerDashboard.stats.paidEarnings')}
            value={fmtMoney(allTime?.paidCents ?? 0)}
            viewAllHref="/partner-portal/payouts"
            viewAllLabel={viewAll}
          />
          <StatCard
            icon={I.trophy}
            label={t('partnerDashboard.stats.totalEarnings')}
            value={fmtMoney(allTime?.totalEarnedCents ?? 0)}
            sub={<span style={{ color: 'oklch(100% 0 0 / 0.85)' }}>{t('partnerDashboard.stats.lifetimeSub')}</span>}
            variant="feature"
            viewAllLabel={viewAll}
          />
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t('partnerDashboard.recentActivity')}</h2>
        {recent.length === 0 ? (
          <div className="rounded-xl p-8 text-center text-sm" style={{
            background: 'var(--surface-raised)',
            border: '1px dashed var(--border-subtle)',
            color: 'var(--text-tertiary)',
          }}>
            {t('partnerDashboard.noCommissions')}
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{t('partnerDashboard.table.reference')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{t('partnerDashboard.table.amount')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{t('partnerDashboard.table.description')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{t('partnerDashboard.table.status')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{t('partnerDashboard.table.date')}</th>
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
                      <td className="px-4 py-3" style={{ color: 'var(--text-tertiary)' }}>{fmtDate(c.createdAt, locale, tz)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 text-xs text-center" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
              <Link href="/partner-portal/commissions" style={{ color: TEAL, fontWeight: 500, textDecoration: 'none' }}>
                {t('partnerDashboard.viewAllCommissions')}
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
