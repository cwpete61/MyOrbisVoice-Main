'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch, apiFetchRaw } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'

const TEAL = 'oklch(55% 0.11 193)'

type Severity = 'good' | 'warn' | 'critical'
type DimensionKey = 'mapPack' | 'reviews' | 'completeness' | 'categories' | 'nap' | 'photos'

interface Dimension {
  key: DimensionKey
  score: number
  weight: number
  severity: Severity
  params: Record<string, string | number>
}
interface Competitor { position: number; title: string; rating?: number; ratingCount?: number }
interface AuditResult {
  found: boolean
  overallScore: number
  business: { title: string; category?: string; rating?: number; ratingCount?: number } | null
  mapPackPosition: number | null
  dimensions: Dimension[]
  gaps: DimensionKey[]
  competitors: Competitor[]
}
interface EvalDetail {
  id: string
  businessName: string
  city: string
  website: string | null
  keywords: string[]
  overallScore: number
  createdAt: string
  result: AuditResult
}
interface ListItem {
  id: string
  businessName: string
  city: string
  overallScore: number
  createdAt: string
}

const SEV_COLOR: Record<Severity, string> = {
  good: 'oklch(58% 0.14 152)',
  warn: 'oklch(72% 0.15 75)',
  critical: 'oklch(58% 0.18 25)',
}

function scoreColor(score: number): string {
  if (score >= 75) return SEV_COLOR.good
  if (score >= 45) return SEV_COLOR.warn
  return SEV_COLOR.critical
}

export default function GmbEvaluationPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'

  const [businessName, setBusinessName] = useState('')
  const [city, setCity] = useState('')
  const [website, setWebsite] = useState('')
  const [keywords, setKeywords] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<EvalDetail | null>(null)
  const [history, setHistory] = useState<ListItem[]>([])
  const [downloading, setDownloading] = useState(false)

  const loadHistory = useCallback(async () => {
    const resp = await apiFetch<{ items: ListItem[]; total: number }>(
      '/api/partner/gmb-evaluations',
    ).catch(() => ({ items: [], total: 0 }))
    setHistory(resp.items)
  }, [])

  useEffect(() => { void loadHistory() }, [loadHistory])

  async function runEvaluation(e: React.FormEvent) {
    e.preventDefault()
    if (!businessName.trim() || !city.trim()) return
    setRunning(true)
    setError(null)
    try {
      const kw = keywords.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 5)
      const data = await apiFetch<{ id: string; createdAt: string; result: AuditResult }>(
        '/api/partner/gmb-evaluations',
        {
          method: 'POST',
          body: JSON.stringify({
            businessName: businessName.trim(),
            city: city.trim(),
            website: website.trim() || undefined,
            keywords: kw.length > 0 ? kw : undefined,
          }),
        },
      )
      setCurrent({
        id: data.id,
        businessName: businessName.trim(),
        city: city.trim(),
        website: website.trim() || null,
        keywords: kw,
        overallScore: data.result.overallScore,
        createdAt: data.createdAt,
        result: data.result,
      })
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('gmbEval.errorGeneric'))
    } finally {
      setRunning(false)
    }
  }

  async function openEvaluation(id: string) {
    setError(null)
    try {
      const data = await apiFetch<EvalDetail>(`/api/partner/gmb-evaluations/${id}`)
      setCurrent(data)
    } catch {
      setError(t('gmbEval.errorGeneric'))
    }
  }

  async function downloadPdf() {
    if (!current) return
    setDownloading(true)
    try {
      const res = await apiFetchRaw(
        `/api/partner/gmb-evaluations/${current.id}/export.pdf?locale=${locale}`,
      )
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gmb-evaluation-${current.businessName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {t('gmbEval.title')}
      </h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-tertiary)' }}>
        {t('gmbEval.subtitle')}
      </p>

      {/* Search form */}
      <form onSubmit={runEvaluation} className="rounded-xl p-4 mb-6" style={{ border: '1px solid var(--border-subtle)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('gmbEval.businessName')}
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t('gmbEval.businessNamePlaceholder')}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('gmbEval.city')}
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t('gmbEval.cityPlaceholder')}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('gmbEval.website')}
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder={t('gmbEval.websitePlaceholder')}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('gmbEval.keywords')}
            <input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder={t('gmbEval.keywordsPlaceholder')}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={running || !businessName.trim() || !city.trim()}
          className="mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
          style={{ background: TEAL }}
        >
          {running ? t('gmbEval.running') : t('gmbEval.runButton')}
        </button>
        {error && (
          <p className="mt-2 text-sm" style={{ color: SEV_COLOR.critical }}>{error}</p>
        )}
      </form>

      {/* Result */}
      {current && (
        <div className="rounded-xl p-5 mb-6" style={{ border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {current.businessName}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{current.city}</p>
            </div>
            <button
              onClick={downloadPdf}
              disabled={downloading}
              className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{ border: `1px solid ${TEAL}`, color: TEAL }}
            >
              {downloading ? t('gmbEval.preparing') : t('gmbEval.downloadReport')}
            </button>
          </div>

          {!current.result.found ? (
            <p className="text-sm py-4" style={{ color: SEV_COLOR.warn }}>{t('gmbEval.notFound')}</p>
          ) : (
            <>
              {/* Score band */}
              <div className="flex items-center gap-4 mb-5 p-4 rounded-lg" style={{ background: 'oklch(55% 0.11 193 / 0.08)' }}>
                <div className="text-4xl font-bold" style={{ color: scoreColor(current.result.overallScore) }}>
                  {current.result.overallScore}
                  <span className="text-base font-normal" style={{ color: 'var(--text-tertiary)' }}>/100</span>
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <div className="font-medium">{t('gmbEval.overallScore')}</div>
                  <div style={{ color: 'var(--text-tertiary)' }}>
                    {current.result.mapPackPosition
                      ? t('gmbEval.mapPackHeadline', { position: current.result.mapPackPosition })
                      : t('gmbEval.notRanking')}
                  </div>
                </div>
              </div>

              {/* Dimensions */}
              <div className="space-y-3 mb-5">
                {current.result.dimensions.map((d) => (
                  <div key={d.key} className="flex gap-3">
                    <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SEV_COLOR[d.severity] }} />
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {t(`gmbEval.dim.${d.key}`)}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{d.score}/100</span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {t(`gmbEval.finding.${d.key}.${d.severity}`, d.params)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Competitors */}
              {current.result.competitors.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {t('gmbEval.competitorsHeader')}
                  </h3>
                  <div className="space-y-1">
                    {current.result.competitors.map((c) => (
                      <div key={c.position} className="flex items-center gap-2 text-sm">
                        <span className="w-6 text-center font-semibold" style={{ color: TEAL }}>#{c.position}</span>
                        <span style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                        {c.ratingCount != null && (
                          <span style={{ color: 'var(--text-tertiary)' }}>
                            {c.rating ? `${c.rating}★ · ` : ''}{t('gmbEval.reviewsCount', { count: c.ratingCount })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            {t('gmbEval.recentTitle')}
          </h2>
          <div className="space-y-1">
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => openEvaluation(h.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-left"
                style={{ border: '1px solid var(--border-subtle)' }}
              >
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {h.businessName} <span style={{ color: 'var(--text-tertiary)' }}>· {h.city}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-sm font-semibold" style={{ color: scoreColor(h.overallScore) }}>{h.overallScore}</span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(h.createdAt).toLocaleDateString(dateLocale)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
