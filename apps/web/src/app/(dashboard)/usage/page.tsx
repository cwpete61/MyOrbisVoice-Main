'use client'

import { useApi } from '@/hooks/useApi'
import { Tooltip } from '@/components/Tooltip'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { useUserTimezone, formatInTimezone } from '@/lib/timezone'

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

type TFn = (key: string, vars?: Record<string, string | number>) => string

function ProgressBar({
  value, max, unit, t,
}: {
  value: number
  max: number | null
  unit: 'min' | 'msg'
  t: TFn
}) {
  const unitLabel = unit === 'min' ? t('tenantUsage.units.min') : t('tenantUsage.units.msg')
  if (!max) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('tenantUsage.progress.noQuota', { value: value.toLocaleString(), unit: unitLabel })}
      </p>
    )
  }
  const pct = Math.min(100, Math.round((value / max) * 100))
  const color = pct >= 95 ? 'oklch(55% 0.18 25)' : pct >= 80 ? 'oklch(60% 0.16 75)' : 'oklch(55% 0.11 193)'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
        <span>{t('tenantUsage.progress.used', { value: value.toLocaleString(), unit: unitLabel })}</span>
        <span>{t('tenantUsage.progress.pctOf', { pct, max: max.toLocaleString(), unit: unitLabel })}</span>
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
  label, sent, received, included, overage, ratePerMessageCents, t,
}: {
  label: string
  sent: number
  received: number
  included: number
  overage: number
  ratePerMessageCents: number
  t: TFn
}) {
  const overageCents = overage * ratePerMessageCents
  return (
    <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('tenantUsage.rates.perOverageMsg', { rate: ratePerMessageCents })}
        </p>
      </div>
      <ProgressBar value={sent} max={included || null} unit="msg" t={t} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div>
          <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{sent}</p>
          <p className="text-xs flex items-center" style={{ color: 'var(--text-tertiary)' }}>
            <Tooltip content={t('tenantUsage.tooltips.sent')}>{t('tenantUsage.labels.sent')}</Tooltip>
          </p>
        </div>
        <div>
          <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{received}</p>
          <p className="text-xs flex items-center" style={{ color: 'var(--text-tertiary)' }}>
            <Tooltip content={t('tenantUsage.tooltips.received')}>{t('tenantUsage.labels.received')}</Tooltip>
          </p>
        </div>
        <div>
          <p className="text-lg font-bold" style={{ color: overage > 0 ? 'oklch(55% 0.18 25)' : 'var(--text-primary)' }}>
            {overage}
          </p>
          <p className="text-xs flex items-center" style={{ color: 'var(--text-tertiary)' }}>
            <Tooltip content={t('tenantUsage.tooltips.overage')}>{t('tenantUsage.labels.overage')}</Tooltip>
          </p>
        </div>
      </div>
      {overageCents > 0 && (
        <p className="text-xs" style={{ color: 'oklch(55% 0.18 25)' }}>
          {t('tenantUsage.projectedOverage', { amount: formatCents(overageCents) })}
        </p>
      )}
    </div>
  )
}

export default function UsagePage() {
  const t = useT()
  const { locale } = useLocale()
  const tz = useUserTimezone()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
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

  const period = formatInTimezone(data.periodStart, { tz, locale: dateLocale, month: 'long', year: 'numeric' })
  const histMax = Math.max(1, ...data.history.map(h => h.minutes))
  const totalOverage = data.overageCharges.totalCents

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {t('tenantUsage.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('tenantUsage.subtitle', { period })}
        </p>
      </div>

      {/* Voice */}
      <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide flex items-center" style={{ color: 'var(--text-tertiary)' }}>
            <Tooltip content={t('tenantUsage.voice.tooltip')}>
              {t('tenantUsage.voice.heading', { period })}
            </Tooltip>
          </p>
          <p className="text-xs flex items-center" style={{ color: 'var(--text-tertiary)' }}>
            <Tooltip content={t('tenantUsage.voice.rateTooltip')}>
              {t('tenantUsage.rates.perOverageMin', { rate: data.voice.ratePerMinuteCents })}
            </Tooltip>
          </p>
        </div>
        <ProgressBar value={data.minutesUsed} max={data.minutesQuota} unit="min" t={t} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {[
            { key: 'totalCalls', label: t('tenantUsage.callStats.totalCalls'), value: data.callCounts.total },
            { key: 'inbound',    label: t('tenantUsage.callStats.inbound'),    value: data.callCounts.inbound },
            { key: 'outbound',   label: t('tenantUsage.callStats.outbound'),   value: data.callCounts.outbound },
            { key: 'widget',     label: t('tenantUsage.callStats.widget'),     value: data.callCounts.widget },
          ].map(({ key, label, value }) => (
            <div key={key}>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Messaging breakdown */}
      <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          {t('tenantUsage.messaging.heading', { period })}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ChannelCard label={t('tenantUsage.channels.sms')}      {...data.messaging.sms}      t={t} />
          <ChannelCard label={t('tenantUsage.channels.mms')}      {...data.messaging.mms}      t={t} />
          <ChannelCard label={t('tenantUsage.channels.whatsapp')} {...data.messaging.whatsapp} t={t} />
        </div>
      </div>

      {/* Projected overage charges */}
      {totalOverage > 0 && (
        <div className="rounded-xl p-6 space-y-3" style={{ background: 'oklch(98% 0.02 75)', border: '1px solid oklch(85% 0.10 75)' }}>
          <p className="text-sm font-semibold flex items-center" style={{ color: 'oklch(35% 0.16 75)' }}>
            <Tooltip content={t('tenantUsage.overageSection.tooltip')}>
              {t('tenantUsage.overageSection.title')}
            </Tooltip>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { key: 'sms',      label: t('tenantUsage.channels.sms'),      cents: data.overageCharges.smsCents },
              { key: 'mms',      label: t('tenantUsage.channels.mms'),      cents: data.overageCharges.mmsCents },
              { key: 'whatsapp', label: t('tenantUsage.channels.whatsapp'), cents: data.overageCharges.whatsappCents },
              { key: 'voice',    label: t('tenantUsage.channels.voice'),    cents: data.overageCharges.voiceCents },
              { key: 'total',    label: t('tenantUsage.channels.total'),    cents: data.overageCharges.totalCents, bold: true },
            ].map(({ key, label, cents, bold }) => (
              <div key={key}>
                <p className="text-xl font-bold" style={{ color: bold ? 'oklch(45% 0.18 25)' : 'var(--text-primary)' }}>
                  {formatCents(cents)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('tenantUsage.overageSection.disclaimer')}
          </p>
        </div>
      )}

      {/* 6-month history chart */}
      <div className="rounded-xl p-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-tertiary)' }}>
          {t('tenantUsage.history.title')}
        </p>
        <div className="flex items-end gap-3 h-32">
          {data.history.map((h) => {
            const heightPct = histMax > 0 ? Math.max(4, Math.round((h.minutes / histMax) * 100)) : 4
            const isCurrent = h.month === data.periodStart.slice(0, 7)
            return (
              <div key={h.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('tenantUsage.history.minutesShort', { n: h.minutes })}
                </span>
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
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('tenantUsage.history.axisLabel')}
          </span>
        </div>
      </div>
    </div>
  )
}
