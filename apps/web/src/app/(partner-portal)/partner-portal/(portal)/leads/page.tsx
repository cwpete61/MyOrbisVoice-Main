'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch, apiFetchRaw } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'

const TEAL = 'oklch(55% 0.11 193)'

type SearchStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
type ReviewStatus = 'NEW' | 'SAVED' | 'REJECTED' | 'PROMOTED'

interface LeadSearch {
  id:          string
  industry:    string
  location:    string
  resultCount: number
  status:      SearchStatus
  leadCount:   number
  emailCount:  number
  errorReason: string | null
  createdAt:   string
}

interface Lead {
  id:           string
  businessName: string
  ownerName:    string | null
  ownerTitle:   string | null
  email:        string | null
  phone:        string | null
  website:      string | null
  address:      string | null
  latitude:     number | null
  longitude:    number | null
  rating:       number | null
  reviewCount:  number | null
  mapRank:      number | null
  category:     string | null
  socialsJson:  Record<string, string> | null
  score:        number
  reviewStatus: ReviewStatus
}

interface SearchDetail {
  search: LeadSearch
  leads:  Lead[]
}

const COUNT_OPTIONS = [10, 25, 50]

type GeoPoint = { lat: number; lng: number }

// Order stops shortest-first with a nearest-neighbor heuristic — plenty for a
// dozen nearby businesses; full TSP isn't worth it at this scale.
function orderByNearestNeighbor(points: GeoPoint[]): GeoPoint[] {
  if (points.length === 0) return []
  const remaining = [...points]
  const route: GeoPoint[] = [remaining.shift()!]
  while (remaining.length > 0) {
    const last = route[route.length - 1]!
    let bestIdx = 0
    let bestDist = Infinity
    remaining.forEach((p, i) => {
      const d = (p.lat - last.lat) ** 2 + (p.lng - last.lng) ** 2
      if (d < bestDist) { bestDist = d; bestIdx = i }
    })
    route.push(remaining.splice(bestIdx, 1)[0]!)
  }
  return route
}

// A Google Maps directions URL for an optimized run of stops. Capped at 10 —
// the consumer Maps directions URL handles roughly that many.
function googleMapsRouteUrl(stops: GeoPoint[]): string {
  const ordered = orderByNearestNeighbor(stops).slice(0, 10)
  const origin = ordered[0]!
  const destination = ordered[ordered.length - 1]!
  const waypoints = ordered.slice(1, -1)
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
  })
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(w => `${w.lat},${w.lng}`).join('|'))
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export default function PartnerLeadsPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'

  const [credits, setCredits]   = useState<number | null>(null)
  const [searches, setSearches] = useState<LeadSearch[]>([])
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [count, setCount]       = useState(25)
  const [wide, setWide]         = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)

  const [activeSearchId, setActiveSearchId] = useState<string | null>(null)
  const [activeSearch, setActiveSearch]     = useState<SearchDetail | null>(null)
  const [detailError, setDetailError]       = useState<string | null>(null)
  const [busyLeadId, setBusyLeadId]         = useState<string | null>(null)
  const [reloadKey, setReloadKey]           = useState(0)
  const [selected, setSelected]             = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy]             = useState(false)
  const [introLead, setIntroLead]           = useState<Lead | null>(null)

  const fetchCredits = useCallback(async () => {
    try {
      const res = await apiFetch<{ credits: number }>('/api/partner/leads/credits')
      setCredits(res.credits)
    } catch { /* non-fatal — the meter just won't show */ }
  }, [])

  const fetchSearches = useCallback(async () => {
    try {
      setSearches(await apiFetch<LeadSearch[]>('/api/partner/leads/searches'))
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => {
    void fetchCredits()
    void fetchSearches()
  }, [fetchCredits, fetchSearches])

  // Load the open search; while it is still running, poll every 3s. A terminal
  // status refreshes credits + history so refunds and counts land in the UI.
  useEffect(() => {
    if (!activeSearchId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function load() {
      try {
        const detail = await apiFetch<SearchDetail>(`/api/partner/leads/searches/${activeSearchId}`)
        if (cancelled) return
        setActiveSearch(detail)
        setDetailError(null)
        if (detail.search.status === 'RUNNING' || detail.search.status === 'PENDING') {
          timer = setTimeout(load, 3000)
        } else {
          void fetchCredits()
          void fetchSearches()
        }
      } catch (e) {
        if (!cancelled) setDetailError((e as Error).message || 'load_failed')
      }
    }

    setActiveSearch(null)
    setDetailError(null)
    setSelected(new Set())
    void load()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [activeSearchId, reloadKey, fetchCredits, fetchSearches])

  async function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || !industry.trim() || !location.trim()) return
    setSubmitting(true)
    setFormError(null)
    try {
      const search = await apiFetch<LeadSearch>('/api/partner/leads/searches', {
        method: 'POST',
        body:   JSON.stringify({ industry: industry.trim(), location: location.trim(), count, wide }),
      })
      setIndustry('')
      setLocation('')
      await fetchCredits()
      await fetchSearches()
      setActiveSearchId(search.id)
    } catch (e) {
      setFormError((e as Error).message || 'search_failed')
    } finally {
      setSubmitting(false)
    }
  }

  function patchLead(leadId: string, reviewStatus: ReviewStatus) {
    setActiveSearch(prev => prev && {
      ...prev,
      leads: prev.leads.map(l => (l.id === leadId ? { ...l, reviewStatus } : l)),
    })
  }

  async function rejectLead(leadId: string) {
    setBusyLeadId(leadId)
    try {
      await apiFetch(`/api/partner/leads/${leadId}/review`, {
        method: 'PATCH',
        body:   JSON.stringify({ status: 'REJECTED' }),
      })
      patchLead(leadId, 'REJECTED')
    } catch { /* leave the row as-is on failure */ }
    finally { setBusyLeadId(null) }
  }

  async function promoteLead(leadId: string) {
    setBusyLeadId(leadId)
    try {
      await apiFetch(`/api/partner/leads/${leadId}/promote`, { method: 'POST' })
      patchLead(leadId, 'PROMOTED')
    } catch { /* leave the row as-is on failure */ }
    finally { setBusyLeadId(null) }
  }

  async function saveToggle(leadId: string, current: ReviewStatus) {
    const next: ReviewStatus = current === 'SAVED' ? 'NEW' : 'SAVED'
    setBusyLeadId(leadId)
    try {
      await apiFetch(`/api/partner/leads/${leadId}/review`, {
        method: 'PATCH',
        body:   JSON.stringify({ status: next }),
      })
      patchLead(leadId, next)
    } catch { /* leave the row as-is on failure */ }
    finally { setBusyLeadId(null) }
  }

  function toggleLead(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Select-all toggle: if every id is already selected, clear; else select
  // them all. Passing [] always clears (used by the "Clear" button).
  function toggleAll(ids: string[]) {
    setSelected(prev => (ids.length > 0 && ids.every(id => prev.has(id)) ? new Set() : new Set(ids)))
  }

  async function bulkPromote() {
    const ids = [...selected]
    if (ids.length === 0 || bulkBusy) return
    setBulkBusy(true)
    try {
      const res = await apiFetch<{ promoted: string[]; failed: { leadId: string }[] }>(
        '/api/partner/leads/promote-batch',
        { method: 'POST', body: JSON.stringify({ leadIds: ids }) },
      )
      const failedSet = new Set(res.failed.map(f => f.leadId))
      setActiveSearch(prev => prev && {
        ...prev,
        leads: prev.leads.map(l =>
          ids.includes(l.id) && !failedSet.has(l.id)
            ? { ...l, reviewStatus: 'PROMOTED' as ReviewStatus }
            : l),
      })
      setSelected(new Set())
    } catch { /* leave rows as-is on failure */ }
    finally { setBulkBusy(false) }
  }

  const statusLabel: Record<SearchStatus, string> = {
    PENDING:   t('partnerLeads.statusPending'),
    RUNNING:   t('partnerLeads.statusRunning'),
    COMPLETED: t('partnerLeads.statusCompleted'),
    FAILED:    t('partnerLeads.statusFailed'),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {t('partnerLeads.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('partnerLeads.subtitle')}
          </p>
        </div>
        {credits !== null && (
          <div
            className="text-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
            style={{ background: 'oklch(55% 0.11 193 / 0.1)', color: TEAL, fontWeight: 600 }}
          >
            {credits.toLocaleString(dateLocale)} {t('partnerLeads.credits')}
          </div>
        )}
      </div>

      {/* New search */}
      <form
        onSubmit={submitSearch}
        className="rounded-xl p-4"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
      >
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('partnerLeads.newSearch')}
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('partnerLeads.industry')}</span>
            <input
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder={t('partnerLeads.industryPlaceholder')}
              maxLength={120}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--surface-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('partnerLeads.location')}</span>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder={t('partnerLeads.locationPlaceholder')}
              maxLength={120}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--surface-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('partnerLeads.results')}</span>
            <select
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--surface-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              {COUNT_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button
            type="submit"
            disabled={submitting || !industry.trim() || !location.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: TEAL, color: 'white' }}
          >
            {submitting ? t('partnerLeads.searching') : t('partnerLeads.searchButton')}
          </button>
        </div>
        <label className="flex items-center gap-2 mt-3 text-xs cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={wide} onChange={e => setWide(e.target.checked)} />
          {t('partnerLeads.wideSearch')}
        </label>
        {formError && <p className="text-xs mt-2" style={{ color: 'oklch(55% 0.18 25)' }}>{formError}</p>}
        <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          {t('partnerLeads.complianceNote')}
        </p>
      </form>

      {activeSearchId
        ? <SearchResults
            t={t}
            statusLabel={statusLabel}
            detail={activeSearch}
            error={detailError}
            busyLeadId={busyLeadId}
            selected={selected}
            bulkBusy={bulkBusy}
            onBack={() => { setActiveSearchId(null); setActiveSearch(null) }}
            onRetry={() => setReloadKey(k => k + 1)}
            onReject={rejectLead}
            onPromote={promoteLead}
            onSaveToggle={saveToggle}
            onEmailIntro={setIntroLead}
            onToggleLead={toggleLead}
            onToggleAll={toggleAll}
            onBulkPromote={bulkPromote}
          />
        : <SearchHistory
            t={t}
            dateLocale={dateLocale}
            statusLabel={statusLabel}
            searches={searches}
            onOpen={setActiveSearchId}
          />
      }

      {introLead && (
        <IntroModal lead={introLead} t={t} onClose={() => setIntroLead(null)} />
      )}
    </div>
  )
}

function SearchHistory(props: {
  t: (k: string) => string
  dateLocale: string
  statusLabel: Record<SearchStatus, string>
  searches: LeadSearch[]
  onOpen: (id: string) => void
}) {
  const { t, dateLocale, statusLabel, searches, onOpen } = props
  return (
    <div>
      <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
        {t('partnerLeads.history')}
      </p>
      {searches.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
          {t('partnerLeads.noHistory')}
        </p>
      ) : (
        <div className="space-y-1.5">
          {searches.map(s => (
            <button
              key={s.id}
              onClick={() => onOpen(s.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-left"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {s.industry} · {s.location}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {new Date(s.createdAt).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })}
                  {s.status === 'COMPLETED' &&
                    ` · ${s.leadCount} ${t('partnerLeads.leadsCount')} · ${s.emailCount} ${t('partnerLeads.withEmail')}`}
                </p>
              </div>
              <StatusPill status={s.status} label={statusLabel[s.status]} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SearchResults(props: {
  t: (k: string) => string
  statusLabel: Record<SearchStatus, string>
  detail: SearchDetail | null
  error: string | null
  busyLeadId: string | null
  selected: Set<string>
  bulkBusy: boolean
  onBack: () => void
  onRetry: () => void
  onReject: (id: string) => void
  onPromote: (id: string) => void
  onSaveToggle: (id: string, current: ReviewStatus) => void
  onEmailIntro: (lead: Lead) => void
  onToggleLead: (id: string) => void
  onToggleAll: (ids: string[]) => void
  onBulkPromote: () => void
}) {
  const { t, statusLabel, detail, error, busyLeadId, selected, bulkBusy,
          onBack, onRetry, onReject, onPromote, onSaveToggle, onEmailIntro,
          onToggleLead, onToggleAll, onBulkPromote } = props
  const [savedOnly, setSavedOnly] = useState(false)

  async function exportCsv(searchId: string) {
    const res = await apiFetchRaw(`/api/partner/leads/searches/${searchId}/export`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${searchId}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="text-xs mb-3 flex items-center gap-1"
        style={{ color: TEAL, fontWeight: 500 }}
      >
        ← {t('partnerLeads.backToHistory')}
      </button>

      {error && (
        <div className="py-8 text-center">
          <p className="text-sm" style={{ color: 'oklch(55% 0.18 25)' }}>
            {t('partnerLeads.loadError')}
          </p>
          <button
            onClick={onRetry}
            className="text-xs mt-2 px-3 py-1 rounded font-medium"
            style={{ border: '1px solid var(--border-subtle)', color: TEAL }}
          >
            {t('partnerLeads.retry')}
          </button>
        </div>
      )}

      {!error && !detail && (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
          {t('partnerLeads.searching')}
        </p>
      )}

      {!error && detail && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {detail.search.industry} · {detail.search.location}
            </p>
            <StatusPill status={detail.search.status} label={statusLabel[detail.search.status]} />
          </div>

          {detail.search.status === 'FAILED' && (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: 'oklch(55% 0.18 25)' }}>
                {t('partnerLeads.searchFailedBody')}
              </p>
              {detail.search.errorReason && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  {detail.search.errorReason}
                </p>
              )}
            </div>
          )}

          {detail.search.status === 'COMPLETED' && detail.leads.length === 0 && (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
              {t('partnerLeads.noResults')}
            </p>
          )}

          {detail.leads.length > 0 && (() => {
            const shown = savedOnly
              ? detail.leads.filter(l => l.reviewStatus === 'SAVED')
              : detail.leads
            const selectableIds = shown
              .filter(l => l.reviewStatus === 'NEW' || l.reviewStatus === 'SAVED')
              .map(l => l.id)
            const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id))
            const routableSelected = detail.leads.filter(
              l => selected.has(l.id) && l.latitude != null && l.longitude != null,
            )
            return (
            <>
            <div className="flex items-center gap-1 mb-2">
              {([['all', false], ['saved', true]] as const).map(([key, on]) => (
                <button
                  key={key}
                  onClick={() => { setSavedOnly(on); onToggleAll([]) }}
                  className="text-xs px-2.5 py-1 rounded"
                  style={savedOnly === on
                    ? { background: TEAL, color: 'white' }
                    : { background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                >
                  {t(key === 'saved' ? 'partnerLeads.filterSaved' : 'partnerLeads.filterAll')}
                </button>
              ))}
              <button
                onClick={() => exportCsv(detail.search.id)}
                className="ml-auto text-xs px-2.5 py-1 rounded"
                style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                {t('partnerLeads.exportCsv')}
              </button>
            </div>
            {selected.size > 0 && (
              <div className="flex items-center gap-3 mb-2 px-3 py-2 rounded-lg" style={{ background: 'oklch(55% 0.11 193 / 0.1)' }}>
                <span className="text-xs font-medium" style={{ color: TEAL }}>
                  {selected.size} {t('partnerLeads.selectedSuffix')}
                </span>
                <button
                  onClick={onBulkPromote}
                  disabled={bulkBusy}
                  className="text-xs px-3 py-1 rounded font-medium disabled:opacity-40"
                  style={{ background: TEAL, color: 'white' }}
                >
                  {bulkBusy ? t('partnerLeads.bulkSending') : t('partnerLeads.bulkSend')}
                </button>
                <button
                  onClick={() => {
                    if (routableSelected.length < 2) return
                    const stops = routableSelected.map(l => ({ lat: l.latitude!, lng: l.longitude! }))
                    window.open(googleMapsRouteUrl(stops), '_blank', 'noopener,noreferrer')
                  }}
                  disabled={routableSelected.length < 2}
                  className="text-xs px-3 py-1 rounded font-medium disabled:opacity-40"
                  style={{ background: 'var(--surface-raised)', color: TEAL, border: '1px solid var(--border-subtle)' }}
                  title={t('partnerLeads.planRoute')}
                >
                  {t('partnerLeads.planRoute')}
                </button>
                <button onClick={() => onToggleAll([])} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('partnerLeads.clearSelection')}
                </button>
              </div>
            )}
            <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-raised)' }}>
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        disabled={selectableIds.length === 0}
                        onChange={() => onToggleAll(selectableIds)}
                        aria-label="select all"
                      />
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerLeads.colBusiness')}</th>
                    <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerLeads.colOwner')}</th>
                    <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerLeads.colContact')}</th>
                    <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerLeads.colSocial')}</th>
                    <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerLeads.colMapRank')}</th>
                    <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerLeads.colRating')}</th>
                    <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerLeads.colScore')}</th>
                    <th className="text-right px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerLeads.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(lead => (
                    <tr key={lead.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-2.5 align-top">
                        {(lead.reviewStatus === 'NEW' || lead.reviewStatus === 'SAVED') && (
                          <input
                            type="checkbox"
                            checked={selected.has(lead.id)}
                            onChange={() => onToggleLead(lead.id)}
                            aria-label={'select ' + lead.businessName}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{lead.businessName}</p>
                        {lead.address && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{lead.address}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {lead.ownerName ? (
                          <>
                            <p style={{ color: 'var(--text-secondary)' }}>{lead.ownerName}</p>
                            {lead.ownerTitle && (
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{lead.ownerTitle}</p>
                            )}
                          </>
                        ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {lead.email && <p style={{ color: 'var(--text-secondary)' }}>{lead.email}</p>}
                        {lead.phone && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{lead.phone}</p>}
                        {!lead.email && !lead.phone && <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <SocialIcons socials={lead.socialsJson} />
                      </td>
                      <td className="px-3 py-2.5 align-top" style={{ color: 'var(--text-secondary)' }}>
                        {lead.mapRank != null ? `#${lead.mapRank}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top" style={{ color: 'var(--text-secondary)' }}>
                        {lead.rating != null ? `${lead.rating.toFixed(1)}★` : '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-semibold"
                          style={{ background: 'oklch(55% 0.11 193 / 0.12)', color: TEAL }}
                        >
                          {lead.score}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top text-right whitespace-nowrap">
                        {lead.reviewStatus === 'PROMOTED' ? (
                          <span className="text-xs font-medium" style={{ color: 'oklch(50% 0.13 150)' }}>
                            ✓ {t('partnerLeads.promoted')}
                          </span>
                        ) : lead.reviewStatus === 'REJECTED' ? (
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {t('partnerLeads.rejected')}
                          </span>
                        ) : (
                          <span className="inline-flex gap-1.5">
                            <button
                              onClick={() => onSaveToggle(lead.id, lead.reviewStatus)}
                              disabled={busyLeadId === lead.id}
                              className="text-xs px-1.5 py-1 rounded disabled:opacity-40"
                              style={lead.reviewStatus === 'SAVED'
                                ? { background: 'oklch(55% 0.11 193 / 0.15)', color: TEAL }
                                : { border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                              title={t('partnerLeads.save')}
                            >
                              {lead.reviewStatus === 'SAVED' ? '★' : '☆'}
                            </button>
                            <button
                              onClick={() => onEmailIntro(lead)}
                              className="text-xs px-1.5 py-1 rounded"
                              style={{ border: '1px solid var(--border-subtle)', color: TEAL }}
                              title={t('partnerLeads.emailIntro')}
                            >
                              ✦
                            </button>
                            <button
                              onClick={() => onReject(lead.id)}
                              disabled={busyLeadId === lead.id}
                              className="text-xs px-2 py-1 rounded disabled:opacity-40"
                              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                            >
                              {t('partnerLeads.reject')}
                            </button>
                            <button
                              onClick={() => onPromote(lead.id)}
                              disabled={busyLeadId === lead.id}
                              className="text-xs px-2 py-1 rounded font-medium disabled:opacity-40"
                              style={{ background: TEAL, color: 'white' }}
                            >
                              {busyLeadId === lead.id ? t('partnerLeads.promoting') : t('partnerLeads.promote')}
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
            )
          })()}
        </>
      )}
    </div>
  )
}

const SOCIAL_META: Record<string, { label: string; color: string }> = {
  facebook:  { label: 'FB', color: 'oklch(48% 0.18 265)' },
  instagram: { label: 'IG', color: 'oklch(55% 0.20 350)' },
  twitter:   { label: 'X',  color: 'var(--text-primary)' },
  youtube:   { label: 'YT', color: 'oklch(55% 0.22 25)' },
  linkedin:  { label: 'LI', color: 'oklch(45% 0.13 245)' },
  tiktok:    { label: 'TT', color: 'var(--text-primary)' },
}

function SocialIcons({ socials }: { socials: Record<string, string> | null }) {
  const entries = socials ? Object.entries(socials).filter(([k]) => SOCIAL_META[k]) : []
  if (entries.length === 0) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
  return (
    <span className="inline-flex gap-1 flex-wrap">
      {entries.map(([platform, url]) => {
        const meta = SOCIAL_META[platform]!
        return (
          <a
            key={platform}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={platform}
            className="text-[10px] font-bold px-1 py-0.5 rounded"
            style={{ background: 'var(--surface-raised)', color: meta.color, border: '1px solid var(--border-subtle)' }}
          >
            {meta.label}
          </a>
        )
      })}
    </span>
  )
}

function IntroModal({ lead, t, onClose }: {
  lead: Lead
  t: (k: string) => string
  onClose: () => void
}) {
  const [text, setText]       = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [copied, setCopied]   = useState(false)

  const generate = useCallback(async () => {
    setLoading(true); setError(false); setCopied(false)
    try {
      const res = await apiFetch<{ intro: string }>(
        `/api/partner/leads/${lead.id}/email-intro`,
        { method: 'POST' },
      )
      setText(res.intro)
    } catch { setError(true) }
    finally { setLoading(false) }
  }, [lead.id])

  useEffect(() => { void generate() }, [generate])

  function copy() {
    navigator.clipboard.writeText(text)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => { /* clipboard blocked — user can select manually */ })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl p-5"
        style={{ background: 'var(--surface-base)', border: '1px solid var(--border-subtle)' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('partnerLeads.introTitle')}
        </p>
        <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>{lead.businessName}</p>

        <div
          className="rounded-lg p-3 text-sm"
          style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)', lineHeight: 1.6, minHeight: 120 }}
        >
          {loading
            ? t('partnerLeads.introGenerating')
            : error
              ? <span style={{ color: 'oklch(55% 0.18 25)' }}>{t('partnerLeads.introError')}</span>
              : text}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => void generate()}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded disabled:opacity-40"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            {t('partnerLeads.regenerate')}
          </button>
          <button
            onClick={copy}
            disabled={loading || error || !text}
            className="text-xs px-3 py-1.5 rounded font-medium disabled:opacity-40"
            style={{ background: TEAL, color: 'white' }}
          >
            {copied ? t('partnerLeads.copied') : t('partnerLeads.copy')}
          </button>
          <button
            onClick={onClose}
            className="ml-auto text-xs px-3 py-1.5 rounded"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('partnerLeads.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status, label }: { status: SearchStatus; label: string }) {
  const palette: Record<SearchStatus, { bg: string; fg: string }> = {
    PENDING:   { bg: 'oklch(95% 0.03 260)', fg: 'oklch(50% 0.10 260)' },
    RUNNING:   { bg: 'oklch(95% 0.05 75)',  fg: 'oklch(50% 0.14 75)' },
    COMPLETED: { bg: 'oklch(95% 0.05 150)', fg: 'oklch(45% 0.13 150)' },
    FAILED:    { bg: 'oklch(95% 0.05 25)',  fg: 'oklch(52% 0.16 25)' },
  }
  const c = palette[status]
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ background: c.bg, color: c.fg }}
    >
      {label}
    </span>
  )
}
