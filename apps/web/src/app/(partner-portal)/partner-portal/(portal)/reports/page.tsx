'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { LeadScoreBadge } from '@/components/LeadScoreBadge'
import { apiContactSignupInvite } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'

interface RContact {
  id: string
  fullName: string | null
  email: string | null
  createdAt: string
  metadataJson: { leadCaptureScore?: number | null; leadCaptureGrade?: string | null; businessName?: string | null } | null
}
interface RList { items: RContact[]; total: number }

export default function PartnerReportsPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const { data, loading } = useApi<RList>('/api/partner/crm/contacts?limit=200')
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const reports = (data?.items ?? []).filter((c) => typeof c.metadataJson?.leadCaptureScore === 'number')

  async function withLink(id: string, fn: (url: string) => void) {
    setBusy(id)
    try { const r = await apiContactSignupInvite(id, getAccessToken() ?? ''); fn(r.url) } finally { setBusy(null) }
  }
  const openReport = (id: string) => withLink(id, (url) => window.open(url, '_blank', 'noopener'))
  const copyLink = (id: string) => withLink(id, (url) => { navigator.clipboard?.writeText(url).then(() => { setCopied(id); setTimeout(() => setCopied(null), 1500) }).catch(() => {}) })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{t('partnerReports.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {data ? t('partnerReports.subtitleTotal', { n: reports.length }) : t('partnerReports.subtitle')}
        </p>
      </div>

      {loading && <div className="h-4 rounded animate-pulse w-48" style={{ background: 'var(--border-subtle)' }} />}

      {!loading && reports.length === 0 && (
        <div className="py-16 text-center rounded-xl" style={{ border: '1px dashed var(--border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('partnerReports.empty')}</p>
        </div>
      )}

      {reports.length > 0 && (
        <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}>
                {[t('partnerReports.colBusiness'), t('partnerReports.colScore'), t('partnerReports.colAdded'), ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < reports.length - 1 ? '1px solid var(--border-subtle)' : undefined }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{c.metadataJson?.businessName || c.fullName || '—'}</td>
                  <td className="px-4 py-3"><LeadScoreBadge score={c.metadataJson!.leadCaptureScore as number} grade={c.metadataJson?.leadCaptureGrade} /></td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(c.createdAt).toLocaleDateString(dateLocale)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openReport(c.id)} disabled={busy === c.id} className="text-xs px-3 py-1.5 rounded-lg mr-2 disabled:opacity-50" style={{ background: 'var(--brand-500, oklch(55% 0.11 193))', color: '#fff' }}>{t('partnerReports.open')}</button>
                    <button onClick={() => copyLink(c.id)} disabled={busy === c.id} className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{copied === c.id ? t('partnerReports.copied') : t('partnerReports.copy')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
