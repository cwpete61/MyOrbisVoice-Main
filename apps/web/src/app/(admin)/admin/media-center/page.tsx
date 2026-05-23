'use client'

// Media Center — single pane of glass for everything that goes to partners.
// Phase A of the combined Media Center + Social Content Engine build. Reads
// the same MarketingKitVideo data as /admin/marketing-kit but presents it as
// an operations dashboard: counts/health, filters, activity feed, QC queue,
// per-row quick actions. No new endpoints — every action reuses the
// /api/admin/marketing-kit/* CRUD surface already in production.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'

type Intent =
  | 'pitch-product' | 'recruit-partners' | 'how-to-sell' | 'social-cuts'
  | 'social-posts' | 'reels-shorts-tiktok' | 'audio' | 'youtube-longform'
type Aspect = 'horizontal' | 'vertical'
type MediaType = 'video' | 'image' | 'audio' | 'carousel'

interface VideoRow {
  id:            string
  intent:        Intent
  titleEn:       string
  titleEs:       string
  descriptionEn: string
  descriptionEs: string
  filename:      string | null
  durationSec:   number
  aspectRatio:   Aspect
  comingSoon:    boolean
  visible:       boolean
  sortOrder:     number
  mediaType:     MediaType
  mimeType:      string | null
  secondaryFilenames: string[]
  captionsJson:  unknown
  track:         string | null
  createdAt:     string
  updatedAt:     string
}

const INTENT_LABEL: Record<Intent, string> = {
  'pitch-product':       'Pitch Product',
  'recruit-partners':    'Recruit Partners',
  'how-to-sell':         'How to Sell',
  'social-cuts':         'Social Cuts',
  'social-posts':        'Social Posts',
  'reels-shorts-tiktok': 'Reels / Shorts / TikTok',
  'audio':               'Audio',
  'youtube-longform':    'YouTube Long-form',
}
const INTENTS = Object.keys(INTENT_LABEL) as Intent[]

type StatusFilter = 'any' | 'visible' | 'hidden' | 'coming-soon' | 'no-file'
type LangFilter   = 'any' | 'en-only' | 'es-only' | 'both' | 'missing-either'
type MediaFilter  = 'any' | MediaType

interface Filters {
  intent: 'any' | Intent
  status: StatusFilter
  lang:   LangFilter
  media:  MediaFilter
  search: string
}
const DEFAULT_FILTERS: Filters = { intent: 'any', status: 'any', lang: 'any', media: 'any', search: '' }

// ── QC rules: returns reasons the row needs attention ───────────────────────
function qcReasons(v: VideoRow): string[] {
  const reasons: string[] = []
  const en = !!v.titleEn?.trim() && !!v.descriptionEn?.trim()
  const es = !!v.titleEs?.trim() && !!v.descriptionEs?.trim()
  if (!en && !es) reasons.push('No copy in either language')
  if (v.visible && !v.filename && !v.comingSoon) reasons.push('Visible but no file attached')
  if (!v.visible) reasons.push('Hidden from partners')
  if (v.comingSoon && v.filename) reasons.push('Marked Coming Soon but has a file (anomaly)')
  // 90-day stale: published rows untouched for a long time may need a refresh.
  const days = (Date.now() - new Date(v.updatedAt).getTime()) / 86_400_000
  if (v.visible && v.filename && days > 90) reasons.push(`Untouched for ${Math.floor(days)} days`)
  return reasons
}

function fmtDuration(s: number): string {
  if (!s) return '—'
  const m = Math.floor(s / 60); const r = s % 60
  return m > 0 ? `${m}:${r.toString().padStart(2, '0')}` : `0:${r.toString().padStart(2, '0')}`
}
function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = ms / 60_000
  if (min < 1)    return 'just now'
  if (min < 60)   return `${Math.floor(min)}m ago`
  if (min < 1440) return `${Math.floor(min / 60)}h ago`
  return `${Math.floor(min / 1440)}d ago`
}

export default function MediaCenterPage() {
  const [rows, setRows] = useState<VideoRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [tab, setTab] = useState<'all' | 'qc' | 'activity'>('all')

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<VideoRow[]>('/api/admin/marketing-kit/videos')
      setRows(data); setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
  }, [])
  useEffect(() => { load() }, [load])

  // ── Derived collections ────────────────────────────────────────────────────
  const filtered = useMemo<VideoRow[]>(() => {
    if (!rows) return []
    return rows.filter(v => {
      if (filters.intent !== 'any' && v.intent !== filters.intent) return false
      if (filters.media  !== 'any' && v.mediaType !== filters.media) return false

      const en = !!v.titleEn?.trim() && !!v.descriptionEn?.trim()
      const es = !!v.titleEs?.trim() && !!v.descriptionEs?.trim()
      if (filters.lang === 'en-only'        && !(en && !es)) return false
      if (filters.lang === 'es-only'        && !(es && !en)) return false
      if (filters.lang === 'both'           && !(en && es))  return false
      if (filters.lang === 'missing-either' && (en && es))   return false

      if (filters.status === 'visible'     && !v.visible)                 return false
      if (filters.status === 'hidden'      && v.visible)                  return false
      if (filters.status === 'coming-soon' && !v.comingSoon)              return false
      if (filters.status === 'no-file'     && !!v.filename)               return false

      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase()
        const hay = `${v.titleEn} ${v.titleEs} ${v.descriptionEn} ${v.descriptionEs}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, filters])

  const qcRows = useMemo(() => (rows ?? []).map(v => ({ v, reasons: qcReasons(v) })).filter(x => x.reasons.length > 0), [rows])
  const activityRows = useMemo(() => (rows ?? []).slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 25), [rows])

  // ── Health metrics ─────────────────────────────────────────────────────────
  const health = useMemo(() => {
    const all = rows ?? []
    const total = all.length
    const visible = all.filter(v => v.visible).length
    const withFile = all.filter(v => !!v.filename).length
    const bilingual = all.filter(v => v.titleEn?.trim() && v.titleEs?.trim() && v.descriptionEn?.trim() && v.descriptionEs?.trim()).length
    const flagged = qcRows.length
    return { total, visible, withFile, bilingual, flagged }
  }, [rows, qcRows])

  if (error)  return <p className="text-sm" style={{ color: 'oklch(55% 0.2 25)' }}>{error}</p>
  if (!rows)  return <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>

  // ── Action handlers — reuse existing /api/admin/marketing-kit endpoints ───
  async function toggle(v: VideoRow, field: 'visible' | 'comingSoon') {
    try {
      const updated = await apiFetch<VideoRow>(`/api/admin/marketing-kit/videos/${v.id}`, {
        method: 'PATCH', body: JSON.stringify({ [field]: !v[field] }),
      })
      setRows(prev => prev?.map(x => x.id === v.id ? updated : x) ?? null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
  }
  async function remove(v: VideoRow) {
    if (!confirm(`Delete "${v.titleEn || v.titleEs}"? The Bunny file will be removed.`)) return
    try {
      await apiFetch(`/api/admin/marketing-kit/videos/${v.id}`, { method: 'DELETE' })
      setRows(prev => prev?.filter(x => x.id !== v.id) ?? null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Delete failed') }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const COUNT = {
    all: rows.length,
    qc: qcRows.length,
    activity: activityRows.length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Media Center</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Everything partners see. Filter, audit, fix. Jumps to the Marketing Kit editor for full edits.
        </p>
      </div>

      {/* Health cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Metric label="Total assets"    value={health.total}     accent="oklch(55% 0.11 193)" />
        <Metric label="Visible"         value={`${health.visible} / ${health.total}`} accent="oklch(45% 0.15 145)" />
        <Metric label="With file"       value={`${health.withFile} / ${health.total}`} accent="oklch(55% 0.13 220)" />
        <Metric label="Bilingual"       value={`${health.bilingual} / ${health.total}`} accent="oklch(50% 0.15 80)" />
        <Metric label="QC flags"        value={health.flagged}   accent={health.flagged ? 'oklch(55% 0.2 25)' : 'oklch(45% 0.15 145)'} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {(['all', 'qc', 'activity'] as const).map(k => {
          const active = tab === k
          const labels = { all: 'All media', qc: 'QC queue', activity: 'Activity feed' }
          return (
            <button key={k} onClick={() => setTab(k)}
              className="px-4 py-2 text-sm font-medium relative"
              style={{ color: active ? 'oklch(55% 0.11 193)' : 'var(--text-tertiary)' }}>
              {labels[k]} <span style={{ opacity: 0.7, marginLeft: 4 }}>{COUNT[k]}</span>
              {active && <span className="absolute left-3 right-3 -bottom-px h-0.5 rounded" style={{ background: 'oklch(55% 0.11 193)' }} />}
            </button>
          )
        })}
      </div>

      {tab === 'all'      && <AllMediaPanel filtered={filtered} filters={filters} setFilters={setFilters} onToggle={toggle} onRemove={remove} />}
      {tab === 'qc'       && <QcPanel qcRows={qcRows} onToggle={toggle} />}
      {tab === 'activity' && <ActivityPanel rows={activityRows} />}
    </div>
  )
}

// ── Tab panels ────────────────────────────────────────────────────────────────

function AllMediaPanel({ filtered, filters, setFilters, onToggle, onRemove }: {
  filtered: VideoRow[]
  filters: Filters
  setFilters: (f: Filters) => void
  onToggle: (v: VideoRow, field: 'visible' | 'comingSoon') => void
  onRemove: (v: VideoRow) => void
}) {
  return (
    <>
      <div className="rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <FilterSel label="Tab"
          value={filters.intent}
          onChange={(v) => setFilters({ ...filters, intent: v as 'any' | Intent })}
          options={[{ value: 'any', label: 'Any tab' }, ...INTENTS.map(i => ({ value: i, label: INTENT_LABEL[i] }))]} />
        <FilterSel label="Status"
          value={filters.status}
          onChange={(v) => setFilters({ ...filters, status: v as StatusFilter })}
          options={[
            { value: 'any',         label: 'Any status' },
            { value: 'visible',     label: 'Visible to partners' },
            { value: 'hidden',      label: 'Hidden (draft)' },
            { value: 'coming-soon', label: 'Coming soon' },
            { value: 'no-file',     label: 'No file attached' },
          ]} />
        <FilterSel label="Language"
          value={filters.lang}
          onChange={(v) => setFilters({ ...filters, lang: v as LangFilter })}
          options={[
            { value: 'any',            label: 'Any language' },
            { value: 'en-only',        label: 'EN only' },
            { value: 'es-only',        label: 'ES only' },
            { value: 'both',           label: 'EN + ES' },
            { value: 'missing-either', label: 'Missing either' },
          ]} />
        <FilterSel label="Media type"
          value={filters.media}
          onChange={(v) => setFilters({ ...filters, media: v as MediaFilter })}
          options={[
            { value: 'any',      label: 'Any media' },
            { value: 'video',    label: 'Video' },
            { value: 'image',    label: 'Image' },
            { value: 'audio',    label: 'Audio' },
            { value: 'carousel', label: 'Carousel' },
          ]} />
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Search</label>
          <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="title or description…"
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{filtered.length} match{filtered.length === 1 ? '' : 'es'}</p>
          <button onClick={() => setFilters(DEFAULT_FILTERS)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-tertiary)' }}>Reset filters</button>
        </div>
        {filtered.length === 0
          ? <p className="px-4 py-8 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>No assets match those filters.</p>
          : <RowTable rows={filtered} onToggle={onToggle} onRemove={onRemove} />}
      </div>
    </>
  )
}

function QcPanel({ qcRows, onToggle }: {
  qcRows: { v: VideoRow; reasons: string[] }[]
  onToggle: (v: VideoRow, field: 'visible' | 'comingSoon') => void
}) {
  if (qcRows.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-sm font-semibold" style={{ color: 'oklch(45% 0.15 145)' }}>✓ Nothing flagged.</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Every asset has copy, the right file state, and was touched recently.</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {qcRows.map(({ v, reasons }) => (
        <div key={v.id} className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid oklch(55% 0.2 25 / 0.3)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{v.titleEn?.trim() || v.titleEs?.trim() || '— untitled —'}</p>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
                  {INTENT_LABEL[v.intent]}
                </span>
              </div>
              <ul className="text-xs space-y-0.5" style={{ color: 'oklch(45% 0.18 25)' }}>
                {reasons.map((r, i) => <li key={i}>⚠ {r}</li>)}
              </ul>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button onClick={() => onToggle(v, 'visible')} className="text-xs px-2 py-1 rounded font-medium" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}>
                {v.visible ? 'Hide' : 'Publish'}
              </button>
              <Link href={`/admin/marketing-kit#${v.id}`} className="text-xs px-2 py-1 rounded font-semibold" style={{ background: 'oklch(55% 0.11 193)', color: '#fff' }}>Open in editor →</Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ActivityPanel({ rows }: { rows: VideoRow[] }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
      <div className="px-4 py-3" style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Last 25 edits / uploads</p>
      </div>
      <table className="w-full text-sm">
        <thead style={{ background: 'var(--surface-raised)' }}>
          <tr>
            <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>When</th>
            <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Title</th>
            <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Tab</th>
            <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Status</th>
            <th className="text-right px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v, i) => (
            <tr key={v.id} style={{ borderTop: '1px solid var(--border-subtle)', background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)' }}>
              <td className="px-3 py-2 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{fmtAgo(v.updatedAt)}</td>
              <td className="px-3 py-2"><p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{v.titleEn?.trim() || v.titleEs?.trim() || '— untitled —'}</p></td>
              <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{INTENT_LABEL[v.intent]}</td>
              <td className="px-3 py-2"><StatusPill v={v} /></td>
              <td className="px-3 py-2 text-right">
                <Link href={`/admin/marketing-kit#${v.id}`} className="text-xs px-2 py-1 rounded font-semibold" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Shared row table for the All tab ─────────────────────────────────────────
function RowTable({ rows, onToggle, onRemove }: {
  rows: VideoRow[]
  onToggle: (v: VideoRow, field: 'visible' | 'comingSoon') => void
  onRemove: (v: VideoRow) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead style={{ background: 'var(--surface-raised)' }}>
          <tr>
            <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Title</th>
            <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Tab</th>
            <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Media</th>
            <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Aspect</th>
            <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Duration</th>
            <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Status</th>
            <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Updated</th>
            <th className="text-right px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v, i) => {
            const en = !!v.titleEn?.trim() && !!v.descriptionEn?.trim()
            const es = !!v.titleEs?.trim() && !!v.descriptionEs?.trim()
            const langBadge = en && es ? 'EN+ES' : (en ? 'EN' : (es ? 'ES' : '—'))
            const display = en && es ? v.titleEn : (v.titleEn?.trim() || v.titleEs?.trim() || '— untitled —')
            return (
              <tr key={v.id} style={{ borderTop: '1px solid var(--border-subtle)', background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)' }}>
                <td className="px-3 py-2 align-top">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{display}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                      style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>{langBadge}</span>
                  </div>
                </td>
                <td className="px-3 py-2 align-top text-xs" style={{ color: 'var(--text-secondary)' }}>{INTENT_LABEL[v.intent]}</td>
                <td className="px-3 py-2 align-top text-xs" style={{ color: 'var(--text-secondary)' }}>{v.mediaType}</td>
                <td className="px-3 py-2 align-top text-xs" style={{ color: 'var(--text-secondary)' }}>{v.aspectRatio === 'horizontal' ? '16:9' : '9:16'}</td>
                <td className="px-3 py-2 align-top text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{fmtDuration(v.durationSec)}</td>
                <td className="px-3 py-2 align-top"><StatusPill v={v} /></td>
                <td className="px-3 py-2 align-top text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmtAgo(v.updatedAt)}</td>
                <td className="px-3 py-2 align-top text-right whitespace-nowrap">
                  <button onClick={() => onToggle(v, 'visible')} className="text-xs px-2 py-1 rounded font-medium mr-1" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}>
                    {v.visible ? 'Hide' : 'Publish'}
                  </button>
                  <Link href={`/admin/marketing-kit#${v.id}`} className="text-xs px-2 py-1 rounded font-medium mr-1" style={{ background: 'oklch(55% 0.11 193)', color: '#fff' }}>Edit</Link>
                  <button onClick={() => onRemove(v)} className="text-xs px-2 py-1 rounded font-medium" style={{ background: 'oklch(95% 0.05 25)', color: 'oklch(35% 0.18 25)' }}>Delete</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StatusPill({ v }: { v: VideoRow }) {
  if (v.comingSoon) return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'oklch(94% 0.06 80)', color: 'oklch(40% 0.15 80)' }}>Coming soon</span>
  if (!v.visible)   return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'oklch(95% 0.02 0)',  color: 'var(--text-tertiary)' }}>Hidden</span>
  if (!v.filename)  return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'oklch(95% 0.05 25)', color: 'oklch(35% 0.18 25)' }}>No file</span>
  return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'oklch(96% 0.05 145)', color: 'oklch(35% 0.16 145)' }}>Live</span>
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: accent, fontFamily: 'system-ui' }}>{value}</p>
    </div>
  )
}

function FilterSel({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
