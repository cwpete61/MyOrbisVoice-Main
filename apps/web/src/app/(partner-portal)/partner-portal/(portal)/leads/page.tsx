'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
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
  email:        string | null
  phone:        string | null
  website:      string | null
  address:      string | null
  rating:       number | null
  reviewCount:  number | null
  category:     string | null
  score:        number
  reviewStatus: ReviewStatus
}

interface SearchDetail {
  search: LeadSearch
  leads:  Lead[]
}

const COUNT_OPTIONS = [10, 25, 50]

export default function PartnerLeadsPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'

  const [credits, setCredits]   = useState<number | null>(null)
  const [searches, setSearches] = useState<LeadSearch[]>([])
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [count, setCount]       = useState(25)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)

  const [activeSearchId, setActiveSearchId] = useState<string | null>(null)
  const [activeSearch, setActiveSearch]     = useState<SearchDetail | null>(null)
  const [detailError, setDetailError]       = useState<string | null>(null)
  const [busyLeadId, setBusyLeadId]         = useState<string | null>(null)
  const [reloadKey, setReloadKey]           = useState(0)

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
        body:   JSON.stringify({ industry: industry.trim(), location: location.trim(), count }),
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
            onBack={() => { setActiveSearchId(null); setActiveSearch(null) }}
            onRetry={() => setReloadKey(k => k + 1)}
            onReject={rejectLead}
            onPromote={promoteLead}
          />
        : <SearchHistory
            t={t}
            dateLocale={dateLocale}
            statusLabel={statusLabel}
            searches={searches}
            onOpen={setActiveSearchId}
          />
      }
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
  onBack: () => void
  onRetry: () => void
  onReject: (id: string) => void
  onPromote: (id: string) => void
}) {
  const { t, statusLabel, detail, error, busyLeadId, onBack, onRetry, onReject, onPromote } = props

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

          {detail.leads.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-raised)' }}>
                    <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerLeads.colBusiness')}</th>
                    <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerLeads.colContact')}</th>
                    <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerLeads.colRating')}</th>
                    <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerLeads.colScore')}</th>
                    <th className="text-right px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('partnerLeads.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.leads.map(lead => (
                    <tr key={lead.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-3 py-2.5 align-top">
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{lead.businessName}</p>
                        {lead.address && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{lead.address}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {lead.email && <p style={{ color: 'var(--text-secondary)' }}>{lead.email}</p>}
                        {lead.phone && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{lead.phone}</p>}
                        {!lead.email && !lead.phone && <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
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
          )}
        </>
      )}
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
