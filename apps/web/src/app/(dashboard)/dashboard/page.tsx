'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useApi, apiFetch } from '@/hooks/useApi'
import { OnboardingBanner } from '@/components/OnboardingBanner'
import { EnableNotificationsBanner } from '@/components/EnableNotificationsBanner'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'

// ── Types ────────────────────────────────────────────────────────────────────

interface KPI {
  callsThisMonth: number
  callsThisWeek: number
  activeNow: number
  appointmentsToday: number
  totalContacts: number
}

interface ChartPoint { date: string; label: string; calls: number }

interface RecentConv {
  id: string
  channelType: string
  status: string
  startedAt: string
  endedAt: string | null
  summaryText: string | null
  recordingStatus: string | null
  contact: { fullName: string | null; phoneE164: string | null } | null
}

interface StorageInfo { usedBytes: number; quotaBytes: number; pct: number }
interface SubscriptionInfo { planName: string; status: string }

interface DashboardData {
  kpi: KPI
  callChart: ChartPoint[]
  recentConversations: RecentConv[]
  storage: StorageInfo
  subscription: SubscriptionInfo | null
}

type KpiPeriod = '7d' | '30d'

interface DashboardKpis {
  period: KpiPeriod
  rangeStart: string
  rangeEnd: string
  totalCalls: number
  inboundCalls: number
  missedInboundCalls: number
  missedCallRate: number
  avgCallDurationSecs: number
  appointmentsBooked: number
  followupEmailsSent: number
  topDispositions: Array<{ code: string; count: number }>
}

type TFn = (key: string, vars?: Record<string, string | number>) => string

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`
  return `${(b / 1024 ** 3).toFixed(2)} GB`
}

function timeSince(dt: string, t: TFn) {
  const diff = Date.now() - new Date(dt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return t('tenantDashboard.time.justNow')
  if (mins < 60) return t('tenantDashboard.time.minutesAgo', { n: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return t('tenantDashboard.time.hoursAgo', { n: hrs })
  return t('tenantDashboard.time.daysAgo', { n: Math.floor(hrs / 24) })
}

function callDuration(start: string, end: string | null, t: TFn) {
  if (!end) return null
  const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  if (secs < 60) return t('tenantDashboard.duration.seconds', { s: secs })
  return t('tenantDashboard.duration.minutesSeconds', { m: Math.floor(secs / 60), s: secs % 60 })
}

function fmtDurationSecs(secs: number, t: TFn) {
  if (!secs || secs <= 0) return t('tenantDashboard.duration.seconds', { s: 0 })
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m === 0) return t('tenantDashboard.duration.seconds', { s })
  return t('tenantDashboard.duration.minutesSeconds', { m, s })
}

// Match the disposition labels used on /conversations.
const DISPOSITION_KEYS: Record<string, string> = {
  booked:         'tenantDashboard.dispositions.booked',
  qualified:      'tenantDashboard.dispositions.qualified',
  callback:       'tenantDashboard.dispositions.callback',
  not_interested: 'tenantDashboard.dispositions.notInterested',
  wrong_number:   'tenantDashboard.dispositions.wrongNumber',
  voicemail:      'tenantDashboard.dispositions.voicemail',
  no_answer:      'tenantDashboard.dispositions.noAnswer',
  spam:           'tenantDashboard.dispositions.spam',
  interested:     'tenantDashboard.dispositions.interested',
}

function dispositionLabel(code: string, t: TFn): string {
  const key = DISPOSITION_KEYS[code]
  if (key) {
    const translated = t(key)
    // If translation key itself comes back (no entry), fall through to title-case fallback.
    if (translated !== key) return translated
  }
  return code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const CHANNEL_COLOR: Record<string, string> = {
  INBOUND:  'bg-blue-50 text-blue-700 border-blue-200',
  OUTBOUND: 'bg-violet-50 text-violet-700 border-violet-200',
  WIDGET:   'bg-teal-50 text-teal-700 border-teal-200',
}

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'bg-green-50 text-green-700',
  OPEN:      'bg-blue-50 text-blue-700',
  MISSED:    'bg-red-50 text-red-700',
  FAILED:    'bg-red-50 text-red-700',
}

// ── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub }: { icon: string; label: string; value: number | string; sub?: string }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          {label}
        </span>
        <span className="text-xl leading-none">{icon}</span>
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {value.toLocaleString()}
        </p>
        {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
      </div>
    </div>
  )
}

function MetricCard({
  label, value, sub, children,
}: {
  label: string
  value?: string | number
  sub?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-2 min-h-[140px]"
      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
    >
      <span
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </span>
      {value !== undefined && (
        <p className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      )}
      {sub && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sub}</p>
      )}
      {children}
    </div>
  )
}

function KpiGrid({ data, period, onPeriodChange, loading, error }: {
  data: DashboardKpis | null
  period: KpiPeriod
  onPeriodChange: (p: KpiPeriod) => void
  loading: boolean
  error: string | null
}) {
  const t = useT()
  // Empty when zero of everything that matters.
  const isEmpty = !!data
    && data.totalCalls === 0
    && data.appointmentsBooked === 0
    && data.followupEmailsSent === 0
    && data.topDispositions.length === 0

  const periodLabel = period === '7d'
    ? t('tenantDashboard.period.last7days')
    : t('tenantDashboard.period.last30days')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {t('tenantDashboard.operationalKpis')}
        </h2>
        <div
          className="inline-flex rounded-lg overflow-hidden text-xs font-medium"
          style={{ border: '1px solid var(--border-subtle)' }}
          role="tablist"
          aria-label={t('tenantDashboard.periodSelector')}
        >
          {(['7d', '30d'] as const).map(opt => {
            const active = period === opt
            return (
              <button
                key={opt}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onPeriodChange(opt)}
                className="px-3 py-1.5 transition-colors"
                style={{
                  background: active ? 'oklch(55% 0.14 193)' : 'var(--surface-raised)',
                  color:      active ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {opt === '7d'
                  ? t('tenantDashboard.period.last7days')
                  : t('tenantDashboard.period.last30days')}
              </button>
            )
          })}
        </div>
      </div>

      {error && !data && (
        <div
          className="rounded-xl px-5 py-4 text-sm"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          {t('tenantDashboard.kpis.loadError', { error })}
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-[140px] rounded-xl animate-pulse"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
            />
          ))}
        </div>
      )}

      {data && isEmpty && (
        <div
          className="rounded-xl px-5 py-10 text-center"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('tenantDashboard.kpis.emptyTitle')}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {t('tenantDashboard.kpis.emptyDesc', { period: periodLabel })}
          </p>
        </div>
      )}

      {data && !isEmpty && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            label={t('tenantDashboard.kpis.totalCalls')}
            value={data.totalCalls}
            sub={
              period === '7d'
                ? t('tenantDashboard.kpis.totalCallsSub7d')
                : t('tenantDashboard.kpis.totalCallsSub30d')
            }
          />

          <MetricCard
            label={t('tenantDashboard.kpis.missedCallRate')}
            value={`${data.missedCallRate.toFixed(1)}%`}
            sub={
              data.inboundCalls === 0
                ? t('tenantDashboard.kpis.missedCallRateNoInbound')
                : t('tenantDashboard.kpis.missedCallRateSub', {
                    missed: data.missedInboundCalls.toLocaleString(),
                    inbound: data.inboundCalls.toLocaleString(),
                  })
            }
          >
            <div className="mt-1 h-2 rounded-full" style={{ background: 'var(--border-subtle)' }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, data.missedCallRate))}%`,
                  background:
                    data.missedCallRate >= 25 ? '#ef4444'
                    : data.missedCallRate >= 10 ? '#f59e0b'
                    : 'oklch(55% 0.14 193)',
                }}
              />
            </div>
          </MetricCard>

          <MetricCard
            label={t('tenantDashboard.kpis.avgCallDuration')}
            value={fmtDurationSecs(data.avgCallDurationSecs, t)}
            sub={t('tenantDashboard.kpis.avgCallDurationSub')}
          />

          <MetricCard
            label={t('tenantDashboard.kpis.appointmentsBooked')}
            value={data.appointmentsBooked}
            sub={
              period === '7d'
                ? t('tenantDashboard.kpis.appointmentsBookedSub7d')
                : t('tenantDashboard.kpis.appointmentsBookedSub30d')
            }
          />

          <MetricCard
            label={t('tenantDashboard.kpis.followupEmails')}
            value={data.followupEmailsSent}
            sub={t('tenantDashboard.kpis.followupEmailsSub')}
          />

          <MetricCard label={t('tenantDashboard.kpis.topDispositions')}>
            {data.topDispositions.length === 0 ? (
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                {t('tenantDashboard.kpis.noDispositions')}
              </p>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {data.topDispositions.map(d => (
                  <li
                    key={d.code}
                    className="flex items-center justify-between text-sm"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span className="truncate">{dispositionLabel(d.code, t)}</span>
                    <span
                      className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}
                    >
                      {d.count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </MetricCard>
        </div>
      )}
    </div>
  )
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  const t = useT()
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
    >
      <p className="font-medium mb-0.5">{label}</p>
      <p style={{ color: 'oklch(55% 0.14 193)' }}>
        {t('tenantDashboard.chart.callsCount', { count: payload[0]?.value ?? 0 })}
      </p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const t = useT()
  const { locale } = useLocale()
  const { data: d, loading } = useApi<DashboardData>('/api/dashboard/stats')

  const [kpiPeriod, setKpiPeriod] = useState<KpiPeriod>('7d')
  const [kpiData, setKpiData] = useState<DashboardKpis | null>(null)
  const [kpiLoading, setKpiLoading] = useState(true)
  const [kpiError, setKpiError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setKpiLoading(true)
    setKpiError(null)
    apiFetch<DashboardKpis>(`/api/dashboard/kpis?period=${kpiPeriod}`)
      .then(res => { if (!cancelled) setKpiData(res) })
      .catch(err => { if (!cancelled) setKpiError(err instanceof Error ? err.message : t('tenantDashboard.kpis.loadFailed')) })
      .finally(() => { if (!cancelled) setKpiLoading(false) })
    return () => { cancelled = true }
  }, [kpiPeriod, t])

  // Hint to satisfy locale usage when not directly referenced in JSX (kept for future date formatting).
  void locale

  if (loading || !d) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded-lg" style={{ background: 'var(--border-subtle)' }} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }} />
          ))}
        </div>
        <div className="h-64 rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }} />
      </div>
    )
  }

  const { kpi, callChart, recentConversations, storage, subscription } = d
  const storageColor = storage.pct >= 100 ? '#ef4444' : storage.pct >= 90 ? '#f59e0b' : 'oklch(55% 0.14 193)'

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {t('tenantDashboard.title')}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t('tenantDashboard.platformOverview')}
          </p>
        </div>
        {kpi.activeNow > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {kpi.activeNow === 1
              ? t('tenantDashboard.liveCallSingular', { n: kpi.activeNow })
              : t('tenantDashboard.liveCallPlural', { n: kpi.activeNow })}
          </div>
        )}
      </div>

      <OnboardingBanner />
      <EnableNotificationsBanner />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon="📞"
          label={t('tenantDashboard.headline.callsThisMonth')}
          value={kpi.callsThisMonth}
          sub={t('tenantDashboard.headline.callsThisMonthSub', { n: kpi.callsThisWeek })}
        />
        <KpiCard
          icon="⚡"
          label={t('tenantDashboard.headline.activeNow')}
          value={kpi.activeNow}
          sub={t('tenantDashboard.headline.activeNowSub')}
        />
        <KpiCard
          icon="📅"
          label={t('tenantDashboard.headline.appointmentsToday')}
          value={kpi.appointmentsToday}
          sub={t('tenantDashboard.headline.appointmentsTodaySub')}
        />
        <KpiCard
          icon="👥"
          label={t('tenantDashboard.headline.totalContacts')}
          value={kpi.totalContacts}
          sub={t('tenantDashboard.headline.totalContactsSub')}
        />
      </div>

      {/* Operational KPIs (period-windowed) */}
      <KpiGrid
        data={kpiData}
        period={kpiPeriod}
        onPeriodChange={setKpiPeriod}
        loading={kpiLoading}
        error={kpiError}
      />

      {/* Chart + side panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Call volume chart — spans 2 cols */}
        <div
          className="lg:col-span-2 rounded-xl p-5"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('tenantDashboard.chart.title')}
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={callChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="oklch(55% 0.14 193)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="oklch(55% 0.14 193)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-subtle)', strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="calls"
                stroke="oklch(55% 0.14 193)"
                strokeWidth={2}
                fill="url(#tealGrad)"
                dot={false}
                activeDot={{ r: 4, fill: 'oklch(55% 0.14 193)', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Side cards */}
        <div className="flex flex-col gap-4">

          {/* Storage gauge */}
          <div
            className="rounded-xl p-5 flex-1"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
          >
            <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
              {t('tenantDashboard.storage.title')}
            </h2>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{storage.pct}%</span>
              <span className="text-xs pb-0.5" style={{ color: 'var(--text-secondary)' }}>
                {t('tenantDashboard.storage.used')}
              </span>
            </div>
            <div className="h-2.5 rounded-full mb-2" style={{ background: 'var(--border-subtle)' }}>
              <div
                className="h-2.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, storage.pct)}%`, background: storageColor }}
              />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('tenantDashboard.storage.usedOf', {
                used: fmtBytes(storage.usedBytes),
                quota: fmtBytes(storage.quotaBytes),
              })}
            </p>
            {storage.pct >= 90 && (
              <Link href="/billing" className="mt-3 block text-xs font-medium text-amber-600 hover:underline">
                {t('tenantDashboard.storage.upgrade')}
              </Link>
            )}
          </div>

          {/* Plan card */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
          >
            <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
              {t('tenantDashboard.subscription.title')}
            </h2>
            {subscription ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{subscription.planName}</p>
                  <p className="text-xs capitalize mt-0.5" style={{ color: 'var(--text-secondary)' }}>{subscription.status.toLowerCase()}</p>
                </div>
                <Link
                  href="/billing"
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80"
                  style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                >
                  {t('tenantDashboard.subscription.manage')}
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {t('tenantDashboard.subscription.none')}
                </p>
                <Link
                  href="/billing"
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80 inline-block"
                  style={{ background: 'oklch(55% 0.14 193)', color: '#fff' }}
                >
                  {t('tenantDashboard.subscription.choosePlan')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent conversations */}
      <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('tenantDashboard.recentConversations.title')}
          </h2>
          <Link href="/conversations" className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('tenantDashboard.recentConversations.viewAll')}
          </Link>
        </div>

        {recentConversations.length === 0 ? (
          <div className="flex flex-col items-center py-14 gap-3">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ color: 'var(--text-tertiary)', opacity: 0.4 }}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {t('tenantDashboard.recentConversations.emptyTitle')}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>
              {t('tenantDashboard.recentConversations.emptyDesc')}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {recentConversations.map(c => {
              const name = c.contact?.fullName || c.contact?.phoneE164 || t('tenantDashboard.recentConversations.unknownContact')
              const duration = callDuration(c.startedAt, c.endedAt, t)
              const channelLabel =
                c.channelType === 'INBOUND'  ? t('tenantDashboard.recentConversations.channelInbound')
                : c.channelType === 'OUTBOUND' ? t('tenantDashboard.recentConversations.channelOutbound')
                : t('tenantDashboard.recentConversations.channelWidget')
              return (
                <Link
                  key={c.id}
                  href={`/conversations?id=${c.id}`}
                  className="flex items-start gap-4 px-5 py-3.5 transition-colors"
                  style={{ color: 'inherit' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-overlay)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Channel badge */}
                  <div className="flex-shrink-0 pt-0.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${CHANNEL_COLOR[c.channelType] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {channelLabel}
                    </span>
                  </div>

                  {/* Main */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.status}
                      </span>
                      {c.status === 'OPEN' && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          {t('tenantDashboard.recentConversations.live')}
                        </span>
                      )}
                      {c.recordingStatus === 'stored' && (
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>🎙</span>
                      )}
                    </div>
                    {c.summaryText && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                        {c.summaryText}
                      </p>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{timeSince(c.startedAt, t)}</p>
                    {duration && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{duration}</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
