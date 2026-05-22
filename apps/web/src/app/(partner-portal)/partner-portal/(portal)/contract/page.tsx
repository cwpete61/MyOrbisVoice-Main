'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { AgreementBody } from '@/components/AgreementBody'
import { getAgreementMarkdown } from '@/lib/partner-agreement'

const TEAL = 'oklch(55% 0.11 193)'

interface AgreementStatus {
  accepted: boolean
  acceptedAt: string | null
  signerName: string | null
  version: string | null
  currentVersion: string
}
interface PublicSettings { commissionRatePct: number; minPayoutCents: number }

export default function ContractPage() {
  const t = useT()
  const { locale } = useLocale()

  const [status, setStatus] = useState<AgreementStatus | null>(null)
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [agreed, setAgreed] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [st, se] = await Promise.all([
      apiFetch<AgreementStatus>('/api/affiliate/agreement').catch(() => null),
      apiFetch<PublicSettings>('/api/public/affiliate/settings').catch(() => null),
    ])
    if (st) setStatus(st)
    if (se) setSettings(se)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const markdown = useMemo(() => {
    const pct = settings?.commissionRatePct ?? 20
    const minPayout = `$${((settings?.minPayoutCents ?? 5000) / 100).toFixed(2)}`
    return getAgreementMarkdown(locale === 'es' ? 'es' : 'en', { commissionRatePct: pct, minPayout })
  }, [settings, locale])

  const accepted = status?.accepted ?? false
  const canSubmit = agreed && name.trim().length >= 2 && !submitting && !accepted

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await apiFetch<AgreementStatus>('/api/affiliate/agreement/accept', {
        method: 'POST',
        body: JSON.stringify({ signerName: name.trim(), agreed: true }),
      })
      setStatus(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('partnerContract.submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  const fmtDate = (iso: string | null) => {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleString(locale === 'es' ? 'es' : 'en', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    } catch { return iso }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('common.loading')}</p>
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('partnerContract.title')}</h1>
        {accepted && (
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold flex-shrink-0"
            style={{ background: 'oklch(62% 0.17 145 / 0.15)', color: 'oklch(45% 0.15 145)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            {t('partnerContract.signedBadge')}
          </span>
        )}
      </div>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{t('partnerContract.subtitle')}</p>

      {/* Spanish legal disclaimer — English version is authoritative. */}
      {locale === 'es' && (
        <div className="rounded-lg px-4 py-3 mb-5 text-xs" style={{ background: 'oklch(75% 0.13 85 / 0.12)', color: 'var(--text-secondary)', border: '1px solid oklch(75% 0.13 85 / 0.4)' }}>
          {t('partnerContract.esDisclaimer')}
        </div>
      )}

      {/* The agreement body */}
      <div className="rounded-2xl p-6 lg:p-8 mb-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', maxHeight: '60vh', overflowY: 'auto' }}>
        <AgreementBody markdown={markdown} />
      </div>

      {/* Acceptance / signature block */}
      <div className="rounded-2xl p-6" style={{ background: accepted ? 'var(--surface-app)' : 'var(--surface-raised)', border: `1px solid ${accepted ? 'var(--border-subtle)' : TEAL}`, opacity: accepted ? 0.85 : 1 }}>
        {accepted ? (
          <div>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('partnerContract.signedTitle')}</p>
            <dl className="space-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex gap-2"><dt className="font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerContract.signedByLabel')}:</dt><dd style={{ color: 'var(--text-primary)' }}>{status?.signerName}</dd></div>
              <div className="flex gap-2"><dt className="font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerContract.signedDateLabel')}:</dt><dd style={{ color: 'var(--text-primary)' }}>{fmtDate(status?.acceptedAt ?? null)}</dd></div>
            </dl>
            <p className="text-xs mt-4" style={{ color: 'var(--text-tertiary)' }}>{t('partnerContract.immutableNote')}</p>
          </div>
        ) : (
          <div>
            <label className="flex items-start gap-3 cursor-pointer mb-4">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 flex-shrink-0" style={{ accentColor: TEAL }} />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('partnerContract.checkboxLabel')}</span>
            </label>

            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('partnerContract.nameLabel')}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t('partnerContract.namePlaceholder')} autoComplete="name"
              disabled={!agreed}
              className="w-full px-3 py-2 rounded-lg text-sm mb-4"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', opacity: agreed ? 1 : 0.5 }} />

            {error && <p className="text-sm mb-3" style={{ color: 'oklch(55% 0.2 25)' }}>{error}</p>}

            <button onClick={submit} disabled={!canSubmit}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
              style={{ background: TEAL, color: 'white', opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
              {submitting ? t('partnerContract.submitting') : t('partnerContract.submitButton')}
            </button>
            <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>{t('partnerContract.finalNote')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
