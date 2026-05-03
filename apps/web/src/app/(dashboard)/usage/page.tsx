'use client'

import { useApi } from '@/hooks/useApi'
import { Tooltip } from '@/components/Tooltip'

interface ChannelUsage {
  sent: number
  received: number
  included: number
  overage: number
  ratePerMessageCents: number
}

interface VoiceUsage {
  included: number
  overage: number
  ratePerMinuteCents: number
}

interface UsageSummary {
  periodStart: string
  minutesUsed: number
  minutesQuota: number | null
  callCounts: { inbound: number; outbound: number; widget: number; total: number }
  messaging: { sms: ChannelUsage; mms: ChannelUsage; whatsapp: ChannelUsage }
  voice: VoiceUsage
  overageCharges: {
    smsCents: number
    mmsCents: number
    whatsappCents: number
    voiceCents: number
    totalCents: number
    markupPct: number
  }
  history: { month: string; minutes: number; calls: number }[]
}

function ProgressBar({ value, max, unit = 'min' }: { value: number; max: number | null; unit?: string }) {
  if (!max) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {value.toLocaleString()} {unit} used — no quota set on your plan
      </p>
    )
  }
  const pct = Math.min(100, Math.round((value / max) * 100))
  const color = pct >= 95 ? 'oklch(55% 0.18 25)' : pct >= 80 ? 'oklch(60% 0.16 75)' : 'oklch(55% 0.11 193)'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
        <span>{value.toLocaleString()} {unit} used</span>
        <span>{pct}% of {max.toLocaleString()} {unit}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-sunken)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function ChannelCard({
  label, sent, received, included, overage, ratePerMessageCents,
}: { label: string; sent: number; received: number; included: number; overage: number; ratePerMessageCents: number }) {
  const overageCents = overage * ratePerMessageCents
  return (
    <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {ratePerMessageCents}¢ per overage msg
        </p>
      </div>
      <ProgressBar value={sent} max={included || null} unit="msg" />
      <div className="grid grid-cols-3 gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div>
          <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{sent}</p>
          <p className="text-xs flex items-center" style={{ color: 'var(--text-tertiary)' }}>
            <Tooltip content="Outbound messages your agent or campaigns sent this period. Counts toward your included quota.">sent</Tooltip>
          </p>
        </div>
        <div>
          <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{received}</p>
          <p className="text-xs flex items-center" style={{ color: 'var(--text-tertiary)' }}>
            <Tooltip content="Inbound messages from your contacts. Free — does not count toward your quota.">received</Tooltip>
          </p>
        </div>
        <div>
          <p className="text-lg font-bold" style={{ color: overage > 0 ? 'oklch(55% 0.18 25)' : 'var(--text-primary)' }}>
            {overage}
          </p>
          <p className="text-xs flex items-center" style={{ color: 'var(--text-tertiary)' }}>
            <Tooltip content="Messages sent above your included monthly quota. Each one is billed on your next invoice at the per-message rate shown above.">overage</Tooltip>
          </p>
        </div>
      </div>
      {overageCents > 0 && (
        <p className="text-xs" style={{ color: 'oklch(55% 0.18 25)' }}>
          Projected overage: {formatCents(overageCents)}
        </p>
      )}
    </div>
  )
}

export default function UsagePage() {
  const { data, loading } = useApi<UsageSummary>('/api/usage/summary')

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse max-w-4xl">
        {[200, 140, 300].map(w => (
          <div key={w} className="h-5 rounded" style={{ width: `${w}px`, background: 'var(--border-subtle)' }} />
        ))}
      </div>
    )
  }

  if (!data) return null

  const period = new Date(data.periodStart).toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const histMax = Math.max(1, ...data.history.map(h => h.minutes))
  const totalOverage = data.overageCharges.totalCents

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Usage</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Voice and messaging activity for {period}.
        </p>
      </div>

      {/* Voice */}
      <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide flex items-center" style={{ color: 'var(--text-tertiary)' }}>
            <Tooltip content="Total minutes across inbound, outbound, and widget calls this billing period. Rounded up to the next minute per call.">Voice — {period}</Tooltip>
          </p>
          <p className="text-xs flex items-center" style={{ color: 'var(--text-tertiary)' }}>
            <Tooltip content="Per-minute rate billed on your next invoice for any call minutes beyond your included quota.">{data.voice.ratePerMinuteCents}¢ per overage min</Tooltip>
          </p>
        </div>
        <ProgressBar value={data.minutesUsed} max={data.minutesQuota} unit="min" />
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

      {/* Messaging breakdown */}
      <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          Messaging — {period}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ChannelCard label="SMS" {...data.messaging.sms} />
          <ChannelCard label="MMS" {...data.messaging.mms} />
          <ChannelCard label="WhatsApp" {...data.messaging.whatsapp} />
        </div>
      </div>

      {/* Projected overage charges */}
      {totalOverage > 0 && (
        <div className="rounded-xl p-6 space-y-3" style={{ background: 'oklch(98% 0.02 75)', border: '1px solid oklch(85% 0.10 75)' }}>
          <p className="text-sm font-semibold flex items-center" style={{ color: 'oklch(35% 0.16 75)' }}>
            <Tooltip content="Estimate of overage charges based on usage so far this period. The actual amount finalizes on your next Stripe invoice — usage between now and the period end can change it.">Projected overage charges this period</Tooltip>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'SMS',      cents: data.overageCharges.smsCents },
              { label: 'MMS',      cents: data.overageCharges.mmsCents },
              { label: 'WhatsApp', cents: data.overageCharges.whatsappCents },
              { label: 'Voice',    cents: data.overageCharges.voiceCents },
              { label: 'Total',    cents: data.overageCharges.totalCents, bold: true },
            ].map(({ label, cents, bold }) => (
              <div key={label}>
                <p className="text-xl font-bold" style={{ color: bold ? 'oklch(45% 0.18 25)' : 'var(--text-primary)' }}>
                  {formatCents(cents)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Charges are projections based on usage so far this period. Final amounts post on your next invoice.
          </p>
        </div>
      )}

      {/* 6-month history chart */}
      <div className="rounded-xl p-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-tertiary)' }}>
          Voice — last 6 months
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
