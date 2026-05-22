'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Cell, ReferenceLine, ResponsiveContainer, LabelList } from 'recharts'
import { apiFetch, apiFetchRaw } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import {
  GMB_CATEGORY_LABELS, GMB_TIME_LABELS, GMB_STATUS_LABELS, GMB_UI,
  GMB_DATA_SOURCE_LABELS, GMB_REASON_LABELS, GMB_SCORECARD_LABELS,
  gmbIssueText, gmbInterpolate, buildActionPlan, type GmbLocale,
} from '@voiceautomation/types'

const TEAL = 'oklch(55% 0.11 193)'
type Severity = 'critical' | 'warn' | 'minor'
type CatStatus = 'measured' | 'partial' | 'deferred' | 'needsConnect'

interface Issue { key: string; category: string; severity: Severity; timeTier: string; params: Record<string, string | number> }
interface Category { key: string; score: number | null; expected: number; weight: number; status: CatStatus; issues: Issue[] }
interface Competitor { position: number; title: string; rating?: number; ratingCount?: number }
type HeatBucket = 'green' | 'yellow' | 'orange' | 'red' | 'none'
interface HeatPoint { row: number; col: number; rank: number | null; bucket: HeatBucket }
interface HeatMap { keyword: string; gridSize: number; points: HeatPoint[]; avgRank: number | null; bestRank: number | null; top3Pct: number; top10Pct: number; invisiblePct: number }
interface CompetitorDetail { name: string; mapPackPosition: number; rating: number | null; reviewCount: number | null; categoryCount: number; servicePageCount: number | null; locationPageCount: number | null; hasSchema: boolean | null }
interface CompetitorGap { leaderName: string | null; reasons: string[]; client: { reviews: number; rating: number; categories: number; servicePages: number | null; locationPages: number | null; hasSchema: boolean } }
interface Summary { overallScore: number; top3Pct: number | null; invisiblePct: number | null; leaderName: string | null; criticalCount: number; fastWinCount: number }
interface AuditResult {
  version?: number
  found: boolean
  overallScore: number
  business: { title: string; category?: string; rating?: number; ratingCount?: number } | null
  mapPackPosition: number | null
  categories?: Category[]
  topGaps?: Issue[]
  competitors?: Competitor[]
  heatMap?: HeatMap | null
  competitorDetails?: CompetitorDetail[]
  competitorGap?: CompetitorGap | null
  summary?: Summary
  meta?: { dataSources?: string[] }
}
interface EvalDetail {
  id: string; businessName: string; city: string; website: string | null
  keywords: string[]; overallScore: number; createdAt: string; result: AuditResult; shareToken?: string | null
}
interface ListItem { id: string; businessName: string; city: string; overallScore: number; createdAt: string }

const SEV_COLOR: Record<Severity, string> = {
  critical: 'oklch(58% 0.18 25)', warn: 'oklch(72% 0.15 75)', minor: 'oklch(62% 0.02 250)',
}
function scoreColor(s: number | null): string {
  if (s === null) return 'var(--text-tertiary)'
  if (s >= 75) return 'oklch(58% 0.14 152)'
  if (s >= 45) return 'oklch(72% 0.15 75)'
  return 'oklch(58% 0.18 25)'
}
const HEAT_COLOR: Record<HeatBucket, string> = {
  green: 'oklch(60% 0.15 152)', yellow: 'oklch(82% 0.15 95)', orange: 'oklch(70% 0.16 55)',
  red: 'oklch(58% 0.19 25)', none: 'var(--surface-overlay)',
}
function heatTextColor(b: HeatBucket): string {
  return b === 'yellow' || b === 'none' ? 'var(--text-secondary)' : '#fff'
}

interface ScoreRow { k: string; you: number | null; comps: (number | null)[]; higher: boolean; dec?: number; gap: number | null; lose: boolean }
function buildScorecard(r: AuditResult): ScoreRow[] {
  const cg = r.competitorGap
  const ds = r.competitorDetails ?? []
  if (!cg || ds.length === 0) return []
  const cl = cg.client
  const base = [
    { k: 'reviews', you: cl.reviews, comps: ds.map((d) => d.reviewCount), higher: true },
    { k: 'rating', you: cl.rating, comps: ds.map((d) => d.rating), higher: true, dec: 1 },
    { k: 'categories', you: cl.categories, comps: ds.map((d) => d.categoryCount), higher: true },
    { k: 'servicePages', you: cl.servicePages, comps: ds.map((d) => d.servicePageCount), higher: true },
    { k: 'locationPages', you: cl.locationPages, comps: ds.map((d) => d.locationPageCount), higher: true },
    { k: 'mapPack', you: r.mapPackPosition, comps: ds.map((d) => d.mapPackPosition), higher: false },
  ]
  return base.map((row) => {
    const cs = row.comps.filter((x): x is number => x != null)
    let gap: number | null = null
    let lose = false
    if (row.you != null && cs.length) {
      const best = row.higher ? Math.max(...cs) : Math.min(...cs)
      gap = row.higher ? row.you - best : best - row.you
      lose = gap < 0
    }
    return { ...row, gap, lose }
  })
}

export default function GmbEvaluationPage() {
  const t = useT()
  const { locale } = useLocale()
  const lc: GmbLocale = locale === 'es' ? 'es' : 'en'
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  const ui = (k: string, p: Record<string, string | number> = {}) => gmbInterpolate(GMB_UI[lc][k] ?? k, p)

  const [businessName, setBusinessName] = useState('')
  const [city, setCity] = useState('')
  const [website, setWebsite] = useState('')
  const [keywords, setKeywords] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<EvalDetail | null>(null)
  const [history, setHistory] = useState<ListItem[]>([])
  const [downloading, setDownloading] = useState(false)
  const [viewing, setViewing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [usage, setUsage] = useState<{ used: number; cap: number; remaining: number; resetsAt: string | null } | null>(null)

  const loadHistory = useCallback(async () => {
    const resp = await apiFetch<{ items: ListItem[]; total: number }>('/api/partner/gmb-evaluations')
      .catch(() => ({ items: [], total: 0 }))
    setHistory(resp.items)
  }, [])
  const loadUsage = useCallback(async () => {
    setUsage(await apiFetch<{ used: number; cap: number; remaining: number; resetsAt: string | null }>('/api/partner/gmb-evaluations/usage').catch(() => null))
  }, [])
  useEffect(() => { void loadHistory(); void loadUsage() }, [loadHistory, loadUsage])

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  async function runEvaluation(e: React.FormEvent) {
    e.preventDefault()
    if (!businessName.trim() || !city.trim()) return
    setRunning(true); setError(null)
    try {
      const kw = keywords.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 5)
      const data = await apiFetch<{ id: string; createdAt: string; result: AuditResult; shareToken?: string | null }>(
        '/api/partner/gmb-evaluations',
        { method: 'POST', body: JSON.stringify({ businessName: businessName.trim(), city: city.trim(), website: website.trim() || undefined, keywords: kw.length ? kw : undefined }) },
      )
      setCurrent({ id: data.id, businessName: businessName.trim(), city: city.trim(), website: website.trim() || null, keywords: kw, overallScore: data.result.overallScore, createdAt: data.createdAt, result: data.result, shareToken: data.shareToken })
      setExpanded(new Set())
      await loadHistory(); await loadUsage()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('gmbEval.errorGeneric'))
    } finally { setRunning(false) }
  }

  async function openEvaluation(id: string) {
    setError(null)
    try {
      const data = await apiFetch<EvalDetail>(`/api/partner/gmb-evaluations/${id}`)
      setCurrent(data); setExpanded(new Set())
    } catch { setError(t('gmbEval.errorGeneric')) }
  }

  async function removeEvaluation(id: string) {
    if (!window.confirm(t('gmbEval.deleteConfirm'))) return
    try {
      await apiFetch<{ deleted: boolean }>(`/api/partner/gmb-evaluations/${id}`, { method: 'DELETE' })
      if (current?.id === id) setCurrent(null)
      await loadHistory()
    } catch { setError(t('gmbEval.errorGeneric')) }
  }

  async function exportPdf(open: boolean) {
    if (!current) return
    open ? setViewing(true) : setDownloading(true)
    try {
      const res = await apiFetchRaw(`/api/partner/gmb-evaluations/${current.id}/export.pdf?locale=${locale}`)
      const url = URL.createObjectURL(await res.blob())
      if (open) { window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000) }
      else {
        const a = document.createElement('a')
        a.href = url; a.download = `gmb-evaluation-${current.businessName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      }
    } finally { open ? setViewing(false) : setDownloading(false) }
  }

  function IssueRow({ it }: { it: Issue }) {
    const { title, fix } = gmbIssueText(lc, it.key, it.params)
    return (
      <div className="flex gap-2.5 py-1.5">
        <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: SEV_COLOR[it.severity] }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</span>
            <span className="text-[11px] whitespace-nowrap px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
              {ui('estTime')}: {GMB_TIME_LABELS[lc][it.timeTier] ?? it.timeTier}
            </span>
          </div>
          {fix && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}><span style={{ color: TEAL }}>{ui('fix')}:</span> {fix}</p>}
        </div>
      </div>
    )
  }

  const r = current?.result
  const isV2 = !!r?.categories?.length

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{t('gmbEval.title')}</h1>
        {usage && (
          <div className="text-right shrink-0">
            <div className="flex items-baseline gap-1 justify-end">
              <span className="text-2xl font-bold" style={{ color: usage.remaining <= 3 ? SEV_COLOR.critical : TEAL }}>{usage.remaining}</span>
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>/ {usage.cap}</span>
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{t('gmbEval.usageRemaining')}</div>
            <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {t('gmbEval.usageNote')}{usage.resetsAt ? ` · ${t('gmbEval.resetsOn', { date: new Date(usage.resetsAt).toLocaleDateString(dateLocale) })}` : ''}
            </div>
          </div>
        )}
      </div>
      <p className="text-sm mb-5" style={{ color: 'var(--text-tertiary)' }}>{t('gmbEval.subtitle')}</p>

      {/* Form */}
      <form onSubmit={runEvaluation} className="rounded-xl p-4 mb-6" style={{ border: '1px solid var(--border-subtle)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([['businessName', businessName, setBusinessName, true], ['city', city, setCity, true], ['website', website, setWebsite, false], ['keywords', keywords, setKeywords, false]] as const).map(([field, val, set, req]) => (
            <label key={field} className="flex flex-col gap-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t(`gmbEval.${field}`)}
              <input value={val} onChange={(e) => set(e.target.value)} required={req}
                placeholder={t(`gmbEval.${field}Placeholder`)}
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }} />
            </label>
          ))}
        </div>
        <button type="submit" disabled={running || !businessName.trim() || !city.trim()}
          className="mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ background: TEAL }}>
          {running ? t('gmbEval.running') : t('gmbEval.runButton')}
        </button>
        {error && <p className="mt-2 text-sm" style={{ color: SEV_COLOR.critical }}>{error}</p>}
      </form>

      {/* Result */}
      {current && r && (
        <div className="rounded-xl p-5 mb-6" style={{ border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{current.businessName}</h2>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{current.city}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => exportPdf(true)} disabled={viewing} className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40" style={{ border: `1px solid ${TEAL}`, color: TEAL }}>{viewing ? t('gmbEval.preparing') : t('gmbEval.viewReport')}</button>
              <button onClick={() => exportPdf(false)} disabled={downloading} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ background: TEAL }}>{downloading ? t('gmbEval.preparing') : t('gmbEval.downloadReport')}</button>
            </div>
          </div>

          {/* Customer-facing shareable link */}
          {current.shareToken && r.found && (() => {
            const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/report/${current.shareToken}`
            return (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg" style={{ background: 'oklch(55% 0.11 193 / 0.07)', border: '1px solid var(--border-subtle)' }}>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-tertiary)' }}>{t('gmbEval.customerLink')}</span>
                <code className="text-xs flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{link}</code>
                <a href={link} target="_blank" rel="noopener" className="text-xs shrink-0 px-2 py-1 rounded" style={{ color: TEAL }}>{t('gmbEval.open')}</a>
                <button onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800) }}
                  className="text-xs shrink-0 px-2.5 py-1 rounded font-medium text-white" style={{ background: TEAL }}>
                  {copied ? t('gmbEval.copied') : t('gmbEval.copyLink')}
                </button>
              </div>
            )
          })()}

          {!r.found ? (
            <p className="text-sm py-4" style={{ color: SEV_COLOR.warn }}>{t('gmbEval.notFound')}</p>
          ) : (
            <>
              {/* Executive summary — the hook */}
              {isV2 && r.summary && (
                <div className="mb-5 p-4 rounded-lg" style={{ border: '1px solid var(--border-subtle)', background: 'oklch(58% 0.18 25 / 0.05)' }}>
                  <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>{ui('execSummary')}</h3>
                  <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
                    {r.summary.invisiblePct !== null && r.summary.invisiblePct > 0 && <li>• {ui('summaryInvisible', { pct: r.summary.invisiblePct })}</li>}
                    {r.summary.top3Pct !== null && <li>• {ui('summaryTop3', { pct: r.summary.top3Pct })}</li>}
                    {r.competitorGap?.leaderName && r.competitorGap.reasons.length > 0 && (
                      <li>• {ui('beatingWhy', { leader: r.competitorGap.leaderName, why: r.competitorGap.reasons.map((rk) => GMB_REASON_LABELS[lc][rk] ?? rk).join(', ') })}</li>
                    )}
                    {r.summary.fastWinCount > 0 && <li style={{ color: 'oklch(55% 0.14 152)' }}>• {ui('summaryFastWins', { count: r.summary.fastWinCount })}</li>}
                  </ul>
                </div>
              )}

              {/* Score band */}
              <div className="flex items-center gap-4 mb-5 p-4 rounded-lg" style={{ background: 'oklch(55% 0.11 193 / 0.08)' }}>
                <div className="text-4xl font-bold" style={{ color: scoreColor(r.overallScore) }}>
                  {r.overallScore}<span className="text-base font-normal" style={{ color: 'var(--text-tertiary)' }}>/100</span>
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <div className="font-medium">{ui('overallScore')}</div>
                  <div style={{ color: 'var(--text-tertiary)' }}>{r.mapPackPosition ? ui('mapPackHeadline', { position: r.mapPackPosition }) : ui('notRanking')}</div>
                </div>
              </div>

              {!isV2 ? (
                <p className="text-sm py-2" style={{ color: 'var(--text-tertiary)' }}>{t('gmbEval.legacyRerun')}</p>
              ) : (
                <>
                  {/* Heat map */}
                  {r.heatMap && r.heatMap.points.length > 0 && (
                    <div className="mb-5">
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ui('heatMapTitle')}</h3>
                      <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{ui('heatMapSub', { keyword: r.heatMap.keyword })}</p>
                      <div className="flex flex-wrap gap-4 mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span><span style={{ color: 'var(--text-tertiary)' }}>{ui('avgRank')}:</span> <b>{r.heatMap.avgRank ?? '—'}</b></span>
                        <span><span style={{ color: 'var(--text-tertiary)' }}>{ui('top3Coverage')}:</span> <b style={{ color: scoreColor(r.heatMap.top3Pct) }}>{r.heatMap.top3Pct}%</b></span>
                        <span><span style={{ color: 'var(--text-tertiary)' }}>{ui('top10Coverage')}:</span> <b>{r.heatMap.top10Pct}%</b></span>
                        <span><span style={{ color: 'var(--text-tertiary)' }}>{ui('invisible')}:</span> <b style={{ color: r.heatMap.invisiblePct > 0 ? SEV_COLOR.critical : 'var(--text-secondary)' }}>{r.heatMap.invisiblePct}%</b></span>
                      </div>
                      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${r.heatMap.gridSize}, 1fr)`, maxWidth: 308 }}>
                        {[...r.heatMap.points].sort((a, b) => a.row - b.row || a.col - b.col).map((p, i) => (
                          <div key={i} className="aspect-square rounded flex items-center justify-center text-[11px] font-semibold"
                            style={{ background: HEAT_COLOR[p.bucket], color: heatTextColor(p.bucket) }}>
                            {p.rank ?? ''}
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        {(['green', 'yellow', 'orange', 'red', 'none'] as const).map((b) => (
                          <span key={b} className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: HEAT_COLOR[b] }} />
                            {ui(b === 'green' ? 'heatGreen' : b === 'yellow' ? 'heatYellow' : b === 'orange' ? 'heatOrange' : b === 'red' ? 'heatRed' : 'heatGray')}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>{ui('fastWinsNote')}</p>
                    </div>
                  )}

                  {/* Who's beating you + scorecard */}
                  {r.competitorDetails && r.competitorDetails.length > 0 && r.competitorGap && (
                    <div className="mb-5">
                      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{ui('whoBeating')}</h3>
                      {r.competitorGap.leaderName && r.competitorGap.reasons.length > 0 && (
                        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                          {ui('beatingWhy', { leader: r.competitorGap.leaderName, why: r.competitorGap.reasons.map((rk) => GMB_REASON_LABELS[lc][rk] ?? rk).join(', ') })}
                        </p>
                      )}
                      <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
                        <table className="w-full text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <thead>
                            <tr style={{ background: 'var(--surface-overlay)' }}>
                              <th className="text-left px-3 py-1.5 font-medium">{ui('metric')}</th>
                              <th className="text-right px-3 py-1.5 font-medium" style={{ color: 'oklch(55% 0.11 193)' }}>{ui('youLabel')}</th>
                              {r.competitorDetails.map((c, i) => <th key={i} className="text-right px-3 py-1.5 font-medium truncate" style={{ maxWidth: 120 }}>{c.name}</th>)}
                              <th className="text-right px-3 py-1.5 font-medium">{ui('gap')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {buildScorecard(r).map((row) => {
                              const fmt = (v: number | null) => v == null ? '—' : (row.dec ? v.toFixed(row.dec) : v)
                              return (
                                <tr key={row.k} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                  <td className="px-3 py-1.5">{GMB_SCORECARD_LABELS[lc][row.k] ?? row.k}</td>
                                  <td className="text-right px-3 py-1.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(row.you)}</td>
                                  {row.comps.map((c, i) => <td key={i} className="text-right px-3 py-1.5">{fmt(c)}</td>)}
                                  <td className="text-right px-3 py-1.5 font-semibold" style={{ color: row.lose ? SEV_COLOR.critical : 'oklch(55% 0.14 152)' }}>
                                    {row.gap == null ? '—' : `${row.gap > 0 ? '+' : ''}${row.dec ? row.gap.toFixed(row.dec) : row.gap}`}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Top priorities */}
                  {r.topGaps && r.topGaps.length > 0 && (
                    <div className="mb-5">
                      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{ui('topGaps')}</h3>
                      <div className="rounded-lg px-3 py-1" style={{ background: 'var(--surface-overlay)' }}>
                        {r.topGaps.map((g, i) => <IssueRow key={`${g.key}-${i}`} it={g} />)}
                      </div>
                    </div>
                  )}

                  {/* Category scores chart */}
                  {(() => {
                    const data = r.categories!.filter((c) => c.score !== null).map((c) => ({
                      name: GMB_CATEGORY_LABELS[lc][c.key] ?? c.key, score: c.score as number, fill: scoreColor(c.score),
                    }))
                    if (!data.length) return null
                    return (
                      <div className="mb-5">
                        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{ui('categoryScores')}</h3>
                        <ResponsiveContainer width="100%" height={data.length * 30 + 16}>
                          <BarChart layout="vertical" data={data} margin={{ top: 0, right: 36, bottom: 0, left: 8 }} barCategoryGap={6}>
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis type="category" dataKey="name" width={132} tickLine={false} axisLine={false}
                              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                            <ReferenceLine x={75} stroke="var(--border-subtle)" strokeDasharray="3 3" />
                            <Bar dataKey="score" radius={[3, 3, 3, 3]} isAnimationActive={false}>
                              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                              <LabelList dataKey="score" position="right" style={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )
                  })()}

                  {/* Category cards */}
                  <div className="space-y-2">
                    {r.categories!.map((c) => {
                      const open = expanded.has(c.key)
                      const pct = c.score === null ? 0 : c.score
                      return (
                        <div key={c.key} className="rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
                          <button onClick={() => toggle(c.key)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                            <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{GMB_CATEGORY_LABELS[lc][c.key] ?? c.key}</span>
                            {(c.status === 'deferred' || c.status === 'needsConnect') && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>{GMB_STATUS_LABELS[lc][c.status]}</span>
                            )}
                            <span className="w-28 h-1.5 rounded-full overflow-hidden hidden sm:block" style={{ background: 'var(--surface-overlay)' }}>
                              <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: scoreColor(c.score) }} />
                            </span>
                            <span className="text-sm font-semibold w-16 text-right" style={{ color: scoreColor(c.score) }}>
                              {c.score === null ? '—' : `${c.score}`}<span className="text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>{c.score === null ? '' : '/100'}</span>
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{open ? '▾' : '▸'}</span>
                          </button>
                          {open && (
                            <div className="px-3 pb-2 pt-0.5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                              <p className="text-[11px] mt-1.5 mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{ui('target', { expected: c.expected })} · {GMB_STATUS_LABELS[lc][c.status]}</p>
                              {c.issues.length === 0
                                ? <p className="text-xs py-1" style={{ color: 'oklch(58% 0.14 152)' }}>✓</p>
                                : c.issues.map((it, i) => <IssueRow key={`${it.key}-${i}`} it={it} />)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Recommended action plan */}
                  {(() => {
                    const plan = buildActionPlan(r.categories!.flatMap((c) => c.issues))
                    const buckets: Array<[string, typeof plan.p1]> = [['priority1', plan.p1], ['priority2', plan.p2], ['priority3', plan.p3], ['priority4', plan.p4]]
                    const tag: Record<string, string> = { priority1: ui('thirtyDay'), priority2: ui('ninetyDay'), priority3: ui('ninetyDay'), priority4: ui('ninetyDay') }
                    if (!buckets.some(([, list]) => list.length)) return null
                    return (
                      <div className="mt-6">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ui('actionPlan')}</h3>
                        <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>{ui('actionPlanLead')}</p>
                        <div className="space-y-3">
                          {buckets.filter(([, list]) => list.length).map(([key, list]) => (
                            <div key={key} className="rounded-lg px-3 py-2" style={{ border: '1px solid var(--border-subtle)' }}>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{ui(key)}</span>
                                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>{tag[key]}</span>
                              </div>
                              {list.map((it, i) => <IssueRow key={`${it.key}-${i}`} it={it as unknown as Issue} />)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Competitors */}
                  {r.competitors && r.competitors.length > 0 && (
                    <div className="mt-5">
                      <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{ui('competitors')}</h3>
                      <div className="space-y-1">
                        {r.competitors.map((c) => (
                          <div key={c.position} className="flex items-center gap-2 text-sm">
                            <span className="w-6 text-center font-semibold" style={{ color: TEAL }}>#{c.position}</span>
                            <span style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                            {c.ratingCount != null && <span style={{ color: 'var(--text-tertiary)' }}>{c.rating ? `${c.rating}★ · ` : ''}{ui('reviewsCount', { count: c.ratingCount })}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Data sources */}
                  {r.meta?.dataSources && r.meta.dataSources.length > 0 && (
                    <p className="text-[11px] mt-4" style={{ color: 'var(--text-tertiary)' }}>
                      {ui('dataSources')}: {r.meta.dataSources.map((s) => GMB_DATA_SOURCE_LABELS[lc][s] ?? s).join(' · ')}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('gmbEval.recentTitle')}</h2>
          <div className="space-y-1">
            {history.map((h) => (
              <div key={h.id} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
                <button onClick={() => openEvaluation(h.id)} className="flex-1 flex items-center justify-between gap-3 text-left">
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{h.businessName} <span style={{ color: 'var(--text-tertiary)' }}>· {h.city}</span></span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm font-semibold" style={{ color: scoreColor(h.overallScore) }}>{h.overallScore}</span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(h.createdAt).toLocaleDateString(dateLocale)}</span>
                  </span>
                </button>
                <button onClick={() => removeEvaluation(h.id)} title={t('gmbEval.delete')} aria-label={t('gmbEval.delete')}
                  className="shrink-0 p-1.5 rounded-md" style={{ color: 'var(--text-tertiary)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
