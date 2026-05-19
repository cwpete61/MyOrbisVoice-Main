'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

const TEAL = 'oklch(55% 0.11 193)'
const RED  = 'oklch(55% 0.2 25)'

// Sending domains are locked to a fixed prefix + exactly 6 digits, so every
// partner's cold-email domain shares the same shape: no-reply-myorbisvoice-NNNNNN.com
const DOMAIN_PREFIX = 'no-reply-myorbisvoice-'

type DomainStatus =
  | 'PENDING_PAYMENT' | 'REGISTERING' | 'DNS_PENDING'
  | 'VERIFYING' | 'WARMING' | 'ACTIVE' | 'FAILED'

interface SendingDomain {
  id: string
  domain: string
  status: DomainStatus
  warmupDayCap: number
  lastError: string | null
}

interface CreateResult {
  status: DomainStatus | 'NEEDS_CARD'
  domain?: SendingDomain | string // SendingDomain when paid; the domain name when NEEDS_CARD
  domainId?: string
  priceUsd?: number
}

const PROVISION_STEPS: DomainStatus[] = ['REGISTERING', 'DNS_PENDING', 'VERIFYING', 'WARMING', 'ACTIVE']
const IN_FLIGHT: DomainStatus[] = ['REGISTERING', 'DNS_PENDING', 'VERIFYING', 'WARMING']

const card = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-subtle)',
}

export default function BulkEmailPage() {
  const t = useT()
  const [loading, setLoading] = useState(true)
  const [domain, setDomain] = useState<SendingDomain | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [name, setName] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ domain: string; available: boolean; priceUsd: number | null } | null>(null)
  const [registering, setRegistering] = useState(false)
  const [needsCard, setNeedsCard] = useState<{ domain: string; priceUsd: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err))

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ domain: SendingDomain | null }>('/api/partner/sending-domain')
      setDomain(res.domain)
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Poll while provisioning is in flight so the partner watches it progress.
  useEffect(() => {
    if (!domain || !IN_FLIGHT.includes(domain.status)) return
    const id = setInterval(() => { void load() }, 15000)
    return () => clearInterval(id)
  }, [domain, load])

  // Only the 6-digit tail is partner-editable; the prefix is fixed.
  const digits      = name.replace(/\D/g, '').slice(0, 6)
  const validDigits = digits.length === 6
  const fullDomain  = validDigits ? `${DOMAIN_PREFIX}${digits}.com` : ''

  async function check() {
    if (!fullDomain) return
    setChecking(true); setError(null); setCheckResult(null)
    try {
      const res = await apiFetch<{ domain: string; available: boolean; priceUsd: number | null }>(
        '/api/partner/sending-domain/check',
        { method: 'POST', body: JSON.stringify({ domain: fullDomain }) },
      )
      setCheckResult(res)
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setChecking(false)
    }
  }

  async function register() {
    if (!checkResult?.available) return
    setRegistering(true); setError(null)
    try {
      const res = await apiFetch<CreateResult>('/api/partner/sending-domain', {
        method: 'POST', body: JSON.stringify({ domain: checkResult.domain }),
      })
      if (res.status === 'NEEDS_CARD') {
        const dn = typeof res.domain === 'string' ? res.domain : checkResult.domain
        setNeedsCard({ domain: dn, priceUsd: res.priceUsd ?? 0 })
      } else if (res.domain && typeof res.domain !== 'string') {
        setDomain(res.domain)
        setWizardOpen(false); setCheckResult(null); setName(''); setNeedsCard(null)
      }
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setRegistering(false)
    }
  }

  async function addCard() {
    setError(null)
    try {
      const here = window.location.origin + window.location.pathname
      const res = await apiFetch<{ url: string }>('/api/partner/sending-domain/card-setup', {
        method: 'POST',
        body: JSON.stringify({ returnUrl: `${here}?setup=success`, cancelUrl: here }),
      })
      window.location.href = res.url
    } catch (err) {
      setError(errMsg(err))
    }
  }

  async function payNow() {
    setRegistering(true); setError(null)
    try {
      const res = await apiFetch<{ status: DomainStatus; domain: SendingDomain }>(
        '/api/partner/sending-domain/pay', { method: 'POST' },
      )
      setDomain(res.domain)
      setNeedsCard(null)
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setRegistering(false)
    }
  }

  async function startOver() {
    setError(null)
    try {
      if (domain?.status === 'PENDING_PAYMENT') {
        await apiFetch('/api/partner/sending-domain', { method: 'DELETE' })
      }
      setDomain(null); setWizardOpen(true)
      setCheckResult(null); setName(''); setNeedsCard(null)
    } catch (err) {
      setError(errMsg(err))
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {t('bulkEmail.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('bulkEmail.subtitle')}
          </p>
        </div>
        <a href="/partner-portal/bulk-email/campaigns"
          className="text-sm font-medium flex-shrink-0 px-3 py-1.5 rounded-lg"
          style={{ background: TEAL, color: 'white' }}>
          {t('bulkEmail.campaignsLink')}
        </a>
      </div>

      <section className="rounded-xl p-4" style={card}>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          {t('bulkEmail.whatTitle')}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('bulkEmail.whatBody')}
        </p>
      </section>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'oklch(60% 0.2 25 / 0.12)', color: 'oklch(55% 0.2 25)' }}>
          {error}
        </div>
      )}

      {/* ── Dynamic section: loading / status / wizard / setup CTA ── */}
      {loading ? (
        <section className="rounded-xl p-4" style={card}>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('bulkEmail.loading')}</p>
        </section>
      ) : domain ? (
        <DomainStatusCard
          domain={domain}
          t={t}
          registering={registering}
          onPay={payNow}
          onStartOver={startOver}
        />
      ) : wizardOpen ? (
        <section className="rounded-xl p-4 space-y-4" style={card}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('bulkEmail.wizardTitle')}
          </p>

          {!needsCard && (
            <>
              <div>
                <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {t('bulkEmail.wizardNameLabel')}
                </label>
                <p className="text-xs mt-0.5 mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  {t('bulkEmail.wizardNameHint')}
                </p>
                <p className="text-xs mb-2" style={{ color: RED, fontStyle: 'italic' }}>
                  {t('bulkEmail.wizardPrefixNote')}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-mono whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{DOMAIN_PREFIX}</span>
                  <input
                    value={name}
                    onChange={e => { setName(e.target.value.replace(/\D/g, '').slice(0, 6)); setCheckResult(null) }}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t('bulkEmail.wizardNamePlaceholder')}
                    className="w-28 text-sm px-3 py-2 rounded-lg outline-none font-mono"
                    style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  />
                  <span className="text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>{t('bulkEmail.wizardTld')}</span>
                </div>
                {validDigits && (
                  <p className="text-xs mt-1.5 font-mono" style={{ color: 'var(--text-secondary)' }}>{fullDomain}</p>
                )}
              </div>

              {checkResult && (
                <div
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: checkResult.available ? 'oklch(60% 0.13 150 / 0.12)' : 'oklch(60% 0.2 25 / 0.12)',
                    color: checkResult.available ? 'oklch(48% 0.13 150)' : 'oklch(55% 0.2 25)',
                  }}
                >
                  {checkResult.available
                    ? t('bulkEmail.wizardAvailable', { domain: checkResult.domain })
                    : t('bulkEmail.wizardUnavailable', { domain: checkResult.domain })}
                </div>
              )}

              {checkResult?.available && checkResult.priceUsd != null && (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('bulkEmail.wizardPriceNote', { price: checkResult.priceUsd.toFixed(2) })}
                </p>
              )}

              <div className="flex items-center gap-2">
                {!checkResult?.available ? (
                  <button
                    onClick={check}
                    disabled={!fullDomain || checking}
                    className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                    style={{ background: TEAL, color: 'white' }}
                  >
                    {checking ? t('bulkEmail.wizardChecking') : t('bulkEmail.wizardCheckBtn')}
                  </button>
                ) : (
                  <button
                    onClick={register}
                    disabled={registering}
                    className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                    style={{ background: TEAL, color: 'white' }}
                  >
                    {registering
                      ? t('bulkEmail.wizardRegistering')
                      : t('bulkEmail.wizardRegisterBtn', { price: (checkResult.priceUsd ?? 0).toFixed(2) })}
                  </button>
                )}
                <button
                  onClick={() => { setWizardOpen(false); setCheckResult(null); setName('') }}
                  className="text-sm px-4 py-2 rounded-lg font-medium"
                  style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}
                >
                  {t('bulkEmail.wizardCancel')}
                </button>
              </div>
            </>
          )}

          {needsCard && (
            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {t('bulkEmail.wizardNeedsCardTitle')}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('bulkEmail.wizardNeedsCardBody', { domain: needsCard.domain })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={addCard}
                  className="text-sm px-4 py-2 rounded-lg font-medium"
                  style={{ background: TEAL, color: 'white' }}
                >
                  {t('bulkEmail.wizardAddCardBtn')}
                </button>
                <button
                  onClick={() => setNeedsCard(null)}
                  className="text-sm px-4 py-2 rounded-lg font-medium"
                  style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}
                >
                  {t('bulkEmail.wizardBack')}
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-xl p-4" style={card}>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            {t('bulkEmail.setupTitle')}
          </p>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {t('bulkEmail.setupBody')}
          </p>
          <ol className="space-y-2">
            {(['step1', 'step2', 'step3'] as const).map((key, i) => (
              <li key={key} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-semibold flex items-center justify-center"
                  style={{ background: 'oklch(55% 0.11 193 / 0.14)', color: TEAL }}
                >
                  {i + 1}
                </span>
                <span style={{ lineHeight: 1.5 }}>{t(`bulkEmail.${key}`)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4">
            <button
              onClick={() => setWizardOpen(true)}
              className="text-sm px-4 py-2 rounded-lg font-medium"
              style={{ background: TEAL, color: 'white' }}
            >
              {t('bulkEmail.setupCta')}
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl p-4" style={card}>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          {t('bulkEmail.rulesTitle')}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('bulkEmail.rulesBody')}
        </p>
      </section>
    </div>
  )
}

function DomainStatusCard({
  domain, t, registering, onPay, onStartOver,
}: {
  domain: SendingDomain
  t: ReturnType<typeof useT>
  registering: boolean
  onPay: () => void
  onStartOver: () => void
}) {
  const currentIdx = PROVISION_STEPS.indexOf(domain.status)

  return (
    <section className="rounded-xl p-4 space-y-3" style={card}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {t('bulkEmail.statusTitle')}
        </p>
        <span className="text-sm font-mono" style={{ color: TEAL }}>{domain.domain}</span>
      </div>

      {domain.status === 'PENDING_PAYMENT' && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('bulkEmail.statusPayNote')}</p>
          <button
            onClick={onPay}
            disabled={registering}
            className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
            style={{ background: TEAL, color: 'white' }}
          >
            {registering ? t('bulkEmail.wizardRegistering') : t('bulkEmail.statusPayBtn')}
          </button>
        </div>
      )}

      {domain.status === 'FAILED' && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: 'oklch(55% 0.2 25)' }}>{t('bulkEmail.statusFailed')}</p>
          {domain.lastError && (
            <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{domain.lastError}</p>
          )}
          <button
            onClick={onStartOver}
            className="text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: TEAL, color: 'white' }}
          >
            {t('bulkEmail.statusRetry')}
          </button>
        </div>
      )}

      {currentIdx >= 0 && (
        <>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {domain.status === 'ACTIVE'
              ? t('bulkEmail.statusActive', { domain: domain.domain, cap: '50' })
              : domain.status === 'WARMING'
                ? t('bulkEmail.statusWarming', { domain: domain.domain, cap: String(domain.warmupDayCap) })
                : t('bulkEmail.statusProvisioning', { domain: domain.domain })}
          </p>
          <ol className="space-y-1.5">
            {PROVISION_STEPS.map((step, i) => {
              const done = i < currentIdx
              const active = i === currentIdx
              return (
                <li key={step} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-semibold flex items-center justify-center"
                    style={{
                      background: done || active ? TEAL : 'var(--surface-overlay)',
                      color: done || active ? 'white' : 'var(--text-tertiary)',
                    }}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span style={{ color: active ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: active ? 600 : 400 }}>
                    {t(`bulkEmail.step_${step}`)}
                  </span>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </section>
  )
}
