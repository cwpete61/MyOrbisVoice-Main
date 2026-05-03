'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useApi } from '@/hooks/useApi'
import { OnboardingBanner } from '@/components/OnboardingBanner'
import { EnableNotificationsBanner } from '@/components/EnableNotificationsBanner'

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`
  return `${(b / 1024 ** 3).toFixed(2)} GB`
}

function timeSince(dt: string) {
  const diff = Date.now() - new Date(dt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function callDuration(start: string, end: string | null) {
  if (!end) return null
  const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
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

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
    >
      <p className="font-medium mb-0.5">{label}</p>
      <p style={{ color: 'oklch(55% 0.14 193)' }}>{payload[0]?.value} calls</p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: d, loading } = useApi<DashboardData>('/api/dashboard/stats')

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
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Platform overview · last 30 days</p>
        </div>
        {kpi.activeNow > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {kpi.activeNow} live {kpi.activeNow === 1 ? 'call' : 'calls'}
          </div>
        )}
      </div>

      <OnboardingBanner />
      <EnableNotificationsBanner />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="📞" label="Calls this month" value={kpi.callsThisMonth} sub={`${kpi.callsThisWeek} this week`} />
        <KpiCard icon="⚡" label="Active now" value={kpi.activeNow} sub="live calls in progress" />
        <KpiCard icon="📅" label="Appointments today" value={kpi.appointmentsToday} sub="scheduled & confirmed" />
        <KpiCard icon="👥" label="Total contacts" value={kpi.totalContacts} sub="in your database" />
      </div>

      {/* Chart + side panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Call volume chart — spans 2 cols */}
        <div
          className="lg:col-span-2 rounded-xl p-5"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Call Volume — Last 7 Days</h2>
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
            <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Recording Storage</h2>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{storage.pct}%</span>
              <span className="text-xs pb-0.5" style={{ color: 'var(--text-secondary)' }}>used</span>
            </div>
            <div className="h-2.5 rounded-full mb-2" style={{ background: 'var(--border-subtle)' }}>
              <div
                className="h-2.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, storage.pct)}%`, background: storageColor }}
              />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {fmtBytes(storage.usedBytes)} of {fmtBytes(storage.quotaBytes)}
            </p>
            {storage.pct >= 90 && (
              <Link href="/billing" className="mt-3 block text-xs font-medium text-amber-600 hover:underline">
                Upgrade storage →
              </Link>
            )}
          </div>

          {/* Plan card */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
          >
            <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Subscription</h2>
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
                  Manage
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>No active subscription</p>
                <Link
                  href="/billing"
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80 inline-block"
                  style={{ background: 'oklch(55% 0.14 193)', color: '#fff' }}
                >
                  Choose a plan →
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
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Recent Conversations</h2>
          <Link href="/conversations" className="text-xs" style={{ color: 'var(--text-tertiary)' }}>View all →</Link>
        </div>

        {recentConversations.length === 0 ? (
          <div className="flex flex-col items-center py-14 gap-3">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ color: 'var(--text-tertiary)', opacity: 0.4 }}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No conversations yet</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>
              They will appear here as calls and chats come in.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {recentConversations.map(c => {
              const name = c.contact?.fullName || c.contact?.phoneE164 || 'Unknown'
              const duration = callDuration(c.startedAt, c.endedAt)
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
                      {c.channelType === 'INBOUND' ? '↙ In' : c.channelType === 'OUTBOUND' ? '↗ Out' : '⊕ Web'}
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
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
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
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{timeSince(c.startedAt)}</p>
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
