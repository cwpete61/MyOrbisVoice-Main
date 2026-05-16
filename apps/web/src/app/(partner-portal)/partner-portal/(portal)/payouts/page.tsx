'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { useUserTimezone, formatInTimezone } from '@/lib/timezone'
import { PartnerBackToOnboarding } from '@/components/PartnerBackToOnboarding'

// AffiliateAccount shape — see services/affiliate.service.ts:getAffiliateAccount
type Account = {
  id: string
  status: string
  totalEarnedCents: number
  totalPaidCents: number
  payoutMethodJson: Record<string, string> | null
}

// Stats shape — used to compute the "approved balance" available for payout
type Stats = {
  approvedCents: number
}

// AffiliatePayoutRequest model fields
type PayoutRequest = {
  id: string
  amountCents: number       // not "requestedAmountCents"
  currency: string
  status: string
  requestedAt: string
  processedAt: string | null
  payoutRef: string | null
  notes: string | null
}

const STATUS_BG: Record<string, { bg: string; text: string }> = {
  PENDING:   { bg: 'oklch(65% 0.18 60 / 0.12)',  text: 'oklch(50% 0.15 60)' },
  PROCESSING:{ bg: 'oklch(55% 0.18 220 / 0.12)', text: 'oklch(45% 0.15 220)' },
  PAID:      { bg: 'oklch(55% 0.18 145 / 0.12)', text: 'oklch(45% 0.15 145)' },
  REJECTED:  { bg: 'oklch(55% 0.18 15 / 0.12)',  text: 'oklch(45% 0.15 15)' },
}

function fmt(cents: number) { return '$' + (cents / 100).toFixed(2) }

type ConnectStatus = {
  connected: boolean
  detailsSubmitted: boolean
  payoutsEnabled: boolean
  chargesEnabled: boolean
  accountId: string | null
  disabledReason: string | null
}

export default function PayoutsPage() {
  const t = useT()
  const { locale } = useLocale()
  const tz = useUserTimezone()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const [account, setAccount] = useState<Account | null>(null)
  const [stats, setStats]   = useState<Stats | null>(null)
  const [requests, setRequests] = useState<PayoutRequest[]>([])
  const [connect, setConnect] = useState<ConnectStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [connectStarting, setConnectStarting] = useState(false)

  const STATUS_LABEL: Record<string, string> = {
    PENDING:    t('partnerPayouts.statusPill.pending'),
    PROCESSING: t('partnerPayouts.statusPill.processing'),
    PAID:       t('partnerPayouts.statusPill.paid'),
    REJECTED:   t('partnerPayouts.statusPill.rejected'),
  }

  async function load() {
    const [acc, st, reqs, conn] = await Promise.all([
      apiFetch<Account>('/api/affiliate/account').catch(() => null),
      apiFetch<Stats>('/api/affiliate/stats').catch(() => null),
      apiFetch<PayoutRequest[]>('/api/affiliate/payout/requests').catch(() => []),
      apiFetch<ConnectStatus>('/api/affiliate/connect/status').catch(() => null),
    ])
    setAccount(acc)
    setStats(st)
    setRequests(reqs ?? [])
    setConnect(conn)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // If we landed here from a Stripe Connect onboarding return, force a refresh
  // so the cached payoutsEnabled flag reflects what the partner just did.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe') !== 'return') return
    apiFetch<ConnectStatus>('/api/affiliate/connect/refresh', { method: 'POST' })
      .then(fresh => setConnect(fresh))
      .catch(() => {})
      .finally(() => {
        // Strip the query string so a page reload doesn't re-trigger the refresh.
        window.history.replaceState({}, '', window.location.pathname)
      })
  }, [])

  /** Start (or resume) Stripe Connect onboarding. Redirects the browser to the
   *  Stripe-hosted form; the partner returns to /partner-portal/payouts?stripe=return
   *  which triggers the refresh effect above. */
  async function startConnectOnboarding() {
    setConnectStarting(true)
    try {
      const origin = window.location.origin
      const result = await apiFetch<{ url: string }>('/api/affiliate/connect/onboard', {
        method: 'POST',
        body: JSON.stringify({
          returnUrl:  `${origin}/partner-portal/payouts?stripe=return`,
          refreshUrl: `${origin}/partner-portal/payouts?stripe=refresh`,
        }),
      })
      window.location.href = result.url
    } catch (e) {
      alert((e as Error).message ?? t('partnerPayouts.connectFailed'))
      setConnectStarting(false)
    }
  }

  async function requestPayout() {
    setRequesting(true)
    try {
      await apiFetch('/api/affiliate/payout/request', { method: 'POST' })
      await load()
    } catch (e: unknown) {
      alert((e as Error).message ?? t('partnerPayouts.requestFailed'))
    }
    setRequesting(false)
  }

  if (loading) return <div className="text-sm pt-8" style={{ color: 'var(--text-tertiary)' }}>{t('actions.loading')}</div>

  const approvedBalanceCents = stats?.approvedCents ?? 0
  const payoutsReady = !!connect?.payoutsEnabled
  const detailsSubmitted = !!connect?.detailsSubmitted
  const connectStatusLabel = payoutsReady
    ? t('partnerPayouts.connect.statusVerified')
    : detailsSubmitted
      ? t('partnerPayouts.connect.statusPending')
      : connect?.connected
        ? t('partnerPayouts.connect.statusRestricted')
        : t('partnerPayouts.connect.statusNotConnected')
  const connectStatusColor = payoutsReady
    ? 'oklch(55% 0.18 145)'
    : detailsSubmitted
      ? 'oklch(60% 0.16 75)'
      : 'oklch(55% 0.05 250)'
  const canRequest = approvedBalanceCents > 0 && payoutsReady

  return (
    <div>
      <PartnerBackToOnboarding />
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerPayouts.title')}</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{t('partnerPayouts.subtitle')}</p>

      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPayouts.availableBalance')}</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(approvedBalanceCents)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPayouts.approvedOnly')}</p>
        </div>

        <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPayouts.payoutMethod')}</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('partnerPayouts.connect.providerName')}
          </p>
          <p className="text-xs mt-1" style={{ color: connectStatusColor }}>
            {connectStatusLabel}
          </p>
          {connect?.disabledReason && (
            <p className="text-xs mt-1" style={{ color: 'oklch(55% 0.18 15)' }}>
              {connect.disabledReason}
            </p>
          )}
          <button
            onClick={startConnectOnboarding}
            disabled={connectStarting}
            className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: payoutsReady ? 'transparent' : 'var(--brand-500)',
              color: payoutsReady ? 'var(--brand-500)' : '#fff',
              border: payoutsReady ? '1px solid var(--brand-500)' : 'none',
              cursor: connectStarting ? 'wait' : 'pointer',
            }}
          >
            {connectStarting
              ? t('partnerPayouts.connect.starting')
              : payoutsReady
                ? t('partnerPayouts.connect.updateDetails')
                : detailsSubmitted
                  ? t('partnerPayouts.connect.continueOnboarding')
                  : t('partnerPayouts.connect.connectNow')}
          </button>
        </div>
      </div>

      <div className="mb-8">
        <button
          onClick={requestPayout}
          disabled={!canRequest || requesting}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: canRequest ? 'var(--brand-500)' : 'var(--surface-raised)', color: canRequest ? '#fff' : 'var(--text-tertiary)', border: canRequest ? 'none' : '1px solid var(--border-subtle)', cursor: canRequest ? 'pointer' : 'not-allowed' }}
        >
          {requesting ? t('partnerPayouts.submitting') : t('partnerPayouts.requestPayoutOf', { amount: fmt(approvedBalanceCents) })}
        </button>
        {!canRequest && (
          <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
            {!payoutsReady
              ? t('partnerPayouts.needConnect')
              : t('partnerPayouts.needApproved')}
          </p>
        )}
      </div>

      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('partnerPayouts.history')}</h2>
      {requests.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPayouts.noRequests')}</p>
      ) : (
        <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPayouts.tableRequested')}</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPayouts.tableAmount')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPayouts.tableStatus')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPayouts.tableReference')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('partnerPayouts.tableProcessed')}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, i) => {
                const bg = STATUS_BG[r.status] ?? STATUS_BG['PENDING']!
                const label = STATUS_LABEL[r.status] ?? STATUS_LABEL['PENDING']!
                return (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{formatInTimezone(r.requestedAt, { tz, locale: dateLocale, dateStyle: 'short' })}</td>
                    <td className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(r.amountCents ?? 0)}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: bg.bg, color: bg.text }}>{label}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{r.payoutRef ?? '—'}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)' }}>{r.processedAt ? formatInTimezone(r.processedAt, { tz, locale: dateLocale, dateStyle: 'short' }) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
