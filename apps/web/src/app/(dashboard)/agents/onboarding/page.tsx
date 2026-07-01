'use client'

/**
 * MyOrbisAgents — RE agent self-serve onboarding (Step 2). Mobile-first (§24):
 * single column, big tap targets. Collects a short RE intake and calls
 * POST /api/onboarding/provision-orby, which builds + publishes RE-shaped Agent
 * DNA ("Orby" persona + Fair-Housing guardrail) and enables the website widget.
 * On success it shows the embed snippet and a hosted widget link.
 */

import { useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

interface OnboardResult {
  dnaId: string
  dnaVersion: number
  publicKey: string
  embedCode: string
  widgetUrl: string
  aiEnriched: boolean
}

type Lang = 'en' | 'es' | 'bilingual'

export default function AgentOnboardingPage() {
  const t = useT()
  const [agentName, setAgentName] = useState('')
  const [brokerage, setBrokerage] = useState('')
  const [market, setMarket] = useState('')
  const [specialties, setSpecialties] = useState('')
  const [listingsBrief, setListingsBrief] = useState('')
  const [bookingHours, setBookingHours] = useState('')
  const [bookingUrl, setBookingUrl] = useState('')
  const [language, setLanguage] = useState<Lang>('en')

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<OnboardResult | null>(null)
  const [copied, setCopied] = useState(false)

  const canSubmit = agentName.trim().length >= 2 && market.trim().length >= 2 && !busy

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setErr('')
    try {
      const res = await apiFetch<OnboardResult>('/api/onboarding/provision-orby', {
        method: 'POST',
        body: JSON.stringify({
          agentName: agentName.trim(),
          brokerage: brokerage.trim() || undefined,
          market: market.trim(),
          specialties: specialties.trim() || undefined,
          listingsBrief: listingsBrief.trim() || undefined,
          bookingHours: bookingHours.trim() || undefined,
          bookingUrl: bookingUrl.trim() || undefined,
          language,
        }),
      })
      setResult(res)
    } catch {
      setErr(t('tenantAgentOnboard.errorGeneric'))
    } finally {
      setBusy(false)
    }
  }

  const copyEmbed = async () => {
    if (!result) return
    try { await navigator.clipboard.writeText(result.embedCode); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked */ }
  }

  const field = 'w-full rounded-lg px-3 py-3 text-base'
  const fieldStyle = { background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' } as const
  const label = 'block text-sm font-medium mb-1.5'
  const labelStyle = { color: 'var(--text-secondary)' } as const

  if (result) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="rounded-2xl p-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentOnboard.successTitle')} 🎉</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('tenantAgentOnboard.successSubtitle')}{result.aiEnriched ? ` ${t('tenantAgentOnboard.aiEnrichedNote')}` : ''}
          </p>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium" style={labelStyle}>{t('tenantAgentOnboard.embedLabel')}</span>
              <button onClick={copyEmbed} className="text-sm font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                {copied ? t('tenantAgentOnboard.copied') : t('tenantAgentOnboard.copyEmbed')}
              </button>
            </div>
            <pre className="rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all"
              style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>{result.embedCode}</pre>
          </div>

          <div className="mt-5">
            <span className="text-sm font-medium" style={labelStyle}>{t('tenantAgentOnboard.widgetUrlLabel')}</span>
            <a href={result.widgetUrl} target="_blank" rel="noreferrer" className="block mt-1 text-sm font-medium break-all"
              style={{ color: 'var(--accent, #0d9488)' }}>{result.widgetUrl}</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentOnboard.title')}</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('tenantAgentOnboard.subtitle')}</p>

      {err && <div className="mt-4 rounded-lg px-3 py-2.5 text-sm" style={{ background: 'oklch(60% 0.18 25 / 0.12)', color: 'oklch(50% 0.18 25)' }}>{err}</div>}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className={label} style={labelStyle}>{t('tenantAgentOnboard.agentNameLabel')} <span style={{ color: 'oklch(55% 0.18 25)' }}>*</span></label>
          <input className={field} style={fieldStyle} value={agentName} onChange={(e) => setAgentName(e.target.value)}
            placeholder={t('tenantAgentOnboard.agentNamePlaceholder')} required />
        </div>
        <div>
          <label className={label} style={labelStyle}>{t('tenantAgentOnboard.brokerageLabel')}</label>
          <input className={field} style={fieldStyle} value={brokerage} onChange={(e) => setBrokerage(e.target.value)}
            placeholder={t('tenantAgentOnboard.brokeragePlaceholder')} />
        </div>
        <div>
          <label className={label} style={labelStyle}>{t('tenantAgentOnboard.marketLabel')} <span style={{ color: 'oklch(55% 0.18 25)' }}>*</span></label>
          <input className={field} style={fieldStyle} value={market} onChange={(e) => setMarket(e.target.value)}
            placeholder={t('tenantAgentOnboard.marketPlaceholder')} required />
        </div>
        <div>
          <label className={label} style={labelStyle}>{t('tenantAgentOnboard.specialtiesLabel')}</label>
          <input className={field} style={fieldStyle} value={specialties} onChange={(e) => setSpecialties(e.target.value)}
            placeholder={t('tenantAgentOnboard.specialtiesPlaceholder')} />
        </div>
        <div>
          <label className={label} style={labelStyle}>{t('tenantAgentOnboard.listingsLabel')}</label>
          <textarea className={field} style={{ ...fieldStyle, resize: 'vertical' }} rows={4} value={listingsBrief} onChange={(e) => setListingsBrief(e.target.value)}
            placeholder={t('tenantAgentOnboard.listingsPlaceholder')} />
        </div>
        <div>
          <label className={label} style={labelStyle}>{t('tenantAgentOnboard.hoursLabel')}</label>
          <input className={field} style={fieldStyle} value={bookingHours} onChange={(e) => setBookingHours(e.target.value)}
            placeholder={t('tenantAgentOnboard.hoursPlaceholder')} />
        </div>
        <div>
          <label className={label} style={labelStyle}>{t('tenantAgentOnboard.bookingUrlLabel')}</label>
          <input className={field} style={fieldStyle} type="url" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)}
            placeholder={t('tenantAgentOnboard.bookingUrlPlaceholder')} />
        </div>
        <div>
          <label className={label} style={labelStyle}>{t('tenantAgentOnboard.languageLabel')}</label>
          <select className={field} style={fieldStyle} value={language} onChange={(e) => setLanguage(e.target.value as Lang)}>
            <option value="en">{t('tenantAgentOnboard.langEn')}</option>
            <option value="es">{t('tenantAgentOnboard.langEs')}</option>
            <option value="bilingual">{t('tenantAgentOnboard.langBilingual')}</option>
          </select>
        </div>

        <button type="submit" disabled={!canSubmit}
          className="w-full rounded-lg py-3.5 text-base font-semibold text-white"
          style={{ background: 'var(--accent, #0d9488)', opacity: canSubmit ? 1 : 0.6 }}>
          {busy ? t('tenantAgentOnboard.building') : t('tenantAgentOnboard.submit')}
        </button>
      </form>
    </div>
  )
}
