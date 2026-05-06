'use client'

import { useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { Tooltip } from '@/components/Tooltip'

interface Plan {
  id: string; code: string; name: string; interval: string
  priceCents: number
  stripePriceId: string | null
  /** Optional second Stripe price for plans that bundle a one-time charge
   *  PLUS a recurring add-on (today only LTD: $497 + $24.99/mo). */
  stripeRecurringPriceId: string | null
  entitlements: Array<{ key: string; valueType: string; booleanValue: boolean | null; integerValue: number | null; stringValue: string | null }>
}
interface Subscription {
  id: string; status: string
  currentPeriodStart: string | null; currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean; plan: Plan
}

type TFn = (key: string, vars?: Record<string, string | number>) => string

const ENTITLEMENT_KEYS: Record<string, string> = {
  max_channels:       'tenantBilling.entitlements.maxChannels',
  max_agents:         'tenantBilling.entitlements.maxAgents',
  minutes_per_month:  'tenantBilling.entitlements.minutesPerMonth',
  widget_enabled:     'tenantBilling.entitlements.widgetEnabled',
  inbound_enabled:    'tenantBilling.entitlements.inboundEnabled',
  outbound_enabled:   'tenantBilling.entitlements.outboundEnabled',
  affiliate_enabled:  'tenantBilling.entitlements.affiliateEnabled',
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  ACTIVE:     { bg: 'oklch(28% 0.10 193)', text: 'oklch(88% 0.07 193)' },
  TRIALING:   { bg: 'oklch(14% 0.04 258)', text: 'oklch(72% 0.13 258)' },
  PAST_DUE:   { bg: 'oklch(14% 0.04 75)',  text: 'oklch(70% 0.16 75)'  },
  CANCELED:   { bg: 'oklch(13% 0.04 25)',  text: 'oklch(68% 0.20 25)'  },
  INCOMPLETE: { bg: 'var(--surface-overlay)', text: 'var(--text-tertiary)' },
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  ACTIVE:     'tenantBilling.statusPill.active',
  TRIALING:   'tenantBilling.statusPill.trialing',
  PAST_DUE:   'tenantBilling.statusPill.pastDue',
  CANCELED:   'tenantBilling.statusPill.canceled',
  INCOMPLETE: 'tenantBilling.statusPill.incomplete',
}

function fmt(e: Plan['entitlements'][0], t: TFn) {
  if (e.valueType === 'BOOLEAN') return e.booleanValue ? '✓' : '—'
  if (e.valueType === 'INTEGER') return String(e.integerValue ?? 0)
  return e.stringValue ?? t('tenantBilling.dash')
}

function entitlementLabel(key: string, t: TFn): string {
  const tKey = ENTITLEMENT_KEYS[key]
  if (tKey) {
    const translated = t(tKey)
    if (translated !== tKey) return translated
  }
  return key
}

function statusLabel(status: string, t: TFn): string {
  const tKey = STATUS_LABEL_KEYS[status]
  if (tKey) {
    const translated = t(tKey)
    if (translated !== tKey) return translated
  }
  return status
}

function fmtDate(iso: string | null, dateLocale: string, t: TFn) {
  if (!iso) return t('tenantBilling.dash')
  return new Date(iso).toLocaleDateString(dateLocale, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function BillingPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const { data: subscription, loading: subLoading } = useApi<Subscription | null>('/api/billing/subscription')
  const { data: plans, loading: plansLoading } = useApi<Plan[]>('/api/billing/plans')
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState('')

  async function startCheckout(planCode: string) {
    setUpgrading(planCode); setError('')
    try {
      const result = await apiFetch<{ url: string }>('/api/billing/checkout-session', {
        method: 'POST', body: JSON.stringify({ planCode }),
      })
      window.location.href = result.url
    } catch (err) { setError(err instanceof Error ? err.message : t('tenantBilling.errors.failed')); setUpgrading(null) }
  }

  async function openPortal() {
    setPortalLoading(true); setError('')
    try {
      const result = await apiFetch<{ url: string }>('/api/billing/portal-session', { method: 'POST' })
      window.location.href = result.url
    } catch (err) { setError(err instanceof Error ? err.message : t('tenantBilling.errors.failed')); setPortalLoading(false) }
  }

  if (subLoading || plansLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-32 rounded-lg" style={{ background: 'var(--border-subtle)' }} />
      <div className="h-48 rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }} />
    </div>
  )

  const sub = subscription
  const statusStyle = STATUS_STYLE[sub?.status ?? 'INCOMPLETE'] ?? STATUS_STYLE.INCOMPLETE!

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{t('tenantBilling.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('tenantBilling.subtitle')}
        </p>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* Current subscription */}
      {sub ? (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div
            className="flex items-start justify-between px-6 py-5"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <div>
              <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{sub.plan.name}</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {sub.plan.interval === 'MONTHLY' ? t('tenantBilling.billing.monthly') : t('tenantBilling.billing.annually')}
              </p>
            </div>
            <span className="badge" style={{ background: statusStyle.bg, color: statusStyle.text }}>{statusLabel(sub.status, t)}</span>
          </div>

          <div className="px-6 py-5">
            <div className="flex items-center gap-8 mb-5">
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('tenantBilling.currentPeriod')}</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {fmtDate(sub.currentPeriodStart, dateLocale, t)} – {fmtDate(sub.currentPeriodEnd, dateLocale, t)}
                </p>
              </div>
              {sub.cancelAtPeriodEnd && (
                <div className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'oklch(14% 0.04 75)', color: 'oklch(70% 0.16 75)' }}>
                  {t('tenantBilling.cancelsAtPeriodEnd')}
                </div>
              )}
            </div>

            {/* Entitlements */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
              {sub.plan.entitlements.map((e) => {
                const tooltipKey = `tenantBilling.entitlementTooltips.${e.key}`
                const tooltipText = t(tooltipKey)
                const hasTooltip = tooltipText !== tooltipKey
                return (
                  <div key={e.key} className="rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {hasTooltip
                        ? <Tooltip content={tooltipText}>{entitlementLabel(e.key, t)}</Tooltip>
                        : entitlementLabel(e.key, t)}
                    </p>
                    <p className="text-sm font-semibold" style={{ color: e.valueType === 'BOOLEAN' && !e.booleanValue ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                      {fmt(e, t)}
                    </p>
                  </div>
                )
              })}
            </div>

            <button onClick={openPortal} disabled={portalLoading} className="btn-ghost">
              {portalLoading ? t('tenantBilling.actions.opening') : t('tenantBilling.actions.manageSubscription')}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl px-6 py-5"
          style={{ background: 'oklch(14% 0.04 75)', border: '1px solid oklch(25% 0.08 75)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'oklch(70% 0.16 75)' }}>{t('tenantBilling.noSubscription.title')}</p>
          <p className="text-xs mt-0.5" style={{ color: 'oklch(55% 0.10 75)' }}>{t('tenantBilling.noSubscription.desc')}</p>
        </div>
      )}

      {/* Plan cards */}
      <div>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t('tenantBilling.availablePlans')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(plans ?? []).map((plan) => {
            const isCurrent = sub?.plan.code === plan.code
            return (
              <div
                key={plan.id}
                className="rounded-xl p-5 flex flex-col"
                style={{
                  background: 'var(--surface-raised)',
                  border: isCurrent ? '2px solid oklch(55% 0.14 193)' : '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{plan.name}</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {plan.interval === 'MONTHLY'
                        ? t('tenantBilling.interval.perMonth')
                        : plan.interval === 'YEARLY'
                          ? t('tenantBilling.interval.perYear')
                          : plan.stripeRecurringPriceId
                            ? t('tenantBilling.interval.oneTimePlusRecurring')
                            : t('tenantBilling.interval.oneTime')}
                    </p>
                    {plan.interval === 'ONE_TIME' && plan.stripeRecurringPriceId && (
                      <p className="text-xs mt-1 italic" style={{ color: 'var(--text-secondary)' }}>
                        {t('tenantBilling.ltdNote')}
                      </p>
                    )}
                  </div>
                  {isCurrent && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'oklch(28% 0.10 193)', color: 'oklch(88% 0.07 193)' }}>
                      {t('tenantBilling.currentBadge')}
                    </span>
                  )}
                </div>

                <ul className="space-y-2 flex-1 mb-4">
                  {plan.entitlements.map((e) => (
                    <li key={e.key} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: e.valueType === 'BOOLEAN' ? (e.booleanValue ? 'oklch(65% 0.15 145)' : 'var(--text-tertiary)') : 'oklch(55% 0.14 193)' }}>
                        {e.valueType === 'BOOLEAN' ? (e.booleanValue ? '✓' : '✗') : '●'}
                      </span>
                      {entitlementLabel(e.key, t)}
                      {e.valueType !== 'BOOLEAN' && `: ${e.integerValue ?? e.stringValue ?? t('tenantBilling.dash')}`}
                    </li>
                  ))}
                </ul>

                {!isCurrent && (
                  <button
                    onClick={() => startCheckout(plan.code)}
                    disabled={upgrading !== null || !plan.stripePriceId}
                    className="btn-primary w-full text-center"
                  >
                    {upgrading === plan.code
                      ? t('tenantBilling.actions.redirecting')
                      : plan.stripePriceId
                        ? t('tenantBilling.actions.selectPlan')
                        : t('tenantBilling.actions.comingSoon')}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
