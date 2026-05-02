'use client'

import { useApi } from '@/hooks/useApi'

interface UsageSummary {
  periodStart: string
  minutesUsed: number
  minutesQuota: number | null
  callCounts: { inbound: number; outbound: number; widget: number; total: number }
  history: { month: string; minutes: number; calls: number }[]
}

function ProgressBar({ value, max }: { value: number; max: number | null }) {
  if (!max) return null
  const pct = Math.min(100, Math.round((value / max) * 100))
  const color = pct >= 95 ? 'oklch(55% 0.18 25)' : pct >= 80 ? 'oklch(60% 0.16 75)' : 'oklch(55% 0.11 193)'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
        <span>{value.toLocaleString()} min used</span>
        <span>{pct}% of {max.toLocaleString()} min</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-sunken)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {pct >= 80 && (
        <p className="text-xs mt-1" style={{ color: pct >= 95 ? 'oklch(55% 0.18 25)' : 'oklch(60% 0.16 75)' }}>
          {pct >= 95
            ? 'You are almost at your limit. Upgrade to avoid interruptions.'
            : 'You are at 80%+ of your monthly call minutes.'}
        </p>
      )}
    </div>
  )
}

export default function UsagePage() {
  const { data, loading } = useApi<UsageSummary>('/api/usage/summary')

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse max-w-3xl">
        {[200, 140, 300].map(w => (
          <div key={w} className="h-5 rounded" style={{ width: `${w}px`, background: 'var(--border-subtle)' }} />
        ))}
      </div>
    )
  }

  if (!data) return null

  const period = new Date(data.periodStart).toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const histMax = Math.max(1, ...data.history.map(h => h.minutes))

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Phone Usage</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Call minutes and volume for {period}.
        </p>
      </div>

      {/* Current period */}
      <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>
            This billing period — {period}
          </p>
          <ProgressBar value={data.minutesUsed} max={data.minutesQuota} />
          {!data.minutesQuota && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {data.minutesUsed.toLocaleString()} minutes used — no quota set on your plan
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {[
            { label: 'Total calls', value: data.callCounts.total },
            { label: 'Inbound',     value: data.callCounts.inbound },
            { label: 'Outbound',    value: data.callCounts.outbound },
            { label: 'Widget',      value: data.callCounts.widget },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 6-month history chart */}
      <div className="rounded-xl p-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-tertiary)' }}>
          Last 6 months
        </p>
        <div className="flex items-end gap-3 h-32">
          {data.history.map((h) => {
            const heightPct = histMax > 0 ? Math.max(4, Math.round((h.minutes / histMax) * 100)) : 4
            const isCurrent = h.month === data.periodStart.slice(0, 7)
            return (
              <div key={h.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{h.minutes}m</span>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${heightPct}%`,
                    background: isCurrent ? 'oklch(55% 0.11 193)' : 'oklch(55% 0.11 193 / 0.35)',
                    minHeight: '4px',
                  }}
                />
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {h.month.slice(5)}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {h.calls}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>minutes / calls per month</span>
        </div>
      </div>
    </div>
  )
}
