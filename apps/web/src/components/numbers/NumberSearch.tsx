'use client'

/**
 * NumberSearch — shared search/shortlist/buy component used on:
 *   - Tenant /phone-numbers (purchase transfers number to subaccount)
 *   - Admin /admin/phone-numbers (purchase keeps number on master account)
 *
 * The parent provides the search + purchase backend functions and a
 * shortlist key (admin or tenant scope). Component handles all the
 * client-side UX: filter form, memorability scoring, sortable results,
 * "find more like this" buttons, persistent shortlist drawer.
 */

import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/lib/i18n/I18nProvider'
import { scoreNumber, similaritySuggestions, sortComparators, type MemorabilityScore } from '@/lib/numberScoring'

export interface SearchResult {
  phoneNumber:       string
  friendlyName?:     string
  locality?:         string | null
  region?:           string | null
  capabilities:      { voice: boolean; sms: boolean; mms: boolean }
  monthlyPriceCents: number
}

interface ScoredResult extends SearchResult {
  _score: MemorabilityScore
}

export interface SearchFilters {
  areaCode?: string
  pattern?:  string
  country:   string
  limit:     number
}

interface NumberSearchProps {
  /** Backend search call (tenant or admin) */
  search:        (filters: SearchFilters) => Promise<SearchResult[]>
  /** Backend purchase call. Returns the persisted phone number on success, or throws */
  purchase:      (phoneNumber: string) => Promise<{ phoneNumber: string }>
  /** localStorage key for the shortlist (e.g. "admin" or `tenant-${tenantId}`) */
  shortlistKey:  string
  /** Called after a successful purchase so parent can refresh its inventory */
  onPurchase:    (phoneNumber: string) => void
  /** Optional plan cap (tenant-side) — shows "X of Y used" hint */
  maxAllowed?:   number
  currentCount?: number
}

const STORAGE_PREFIX = 'mov.numbers.shortlist.'

function CapBadge({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium" style={{
      background: on ? 'oklch(95% 0.05 145)' : 'var(--surface-overlay)',
      color:      on ? 'oklch(35% 0.16 145)' : 'var(--text-tertiary)',
    }}>{label}</span>
  )
}

function ScoreTag({ tagKey, t }: { tagKey: string; t: (k: string) => string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    repeated:     { bg: 'oklch(95% 0.10 290)', fg: 'oklch(35% 0.18 290)' },
    sequential:   { bg: 'oklch(95% 0.08 200)', fg: 'oklch(35% 0.16 200)' },
    repeatedPair: { bg: 'oklch(95% 0.08 280)', fg: 'oklch(35% 0.14 280)' },
    round:        { bg: 'oklch(95% 0.08 75)',  fg: 'oklch(35% 0.16 75)'  },
    palindrome:   { bg: 'oklch(95% 0.08 145)', fg: 'oklch(35% 0.16 145)' },
    tripletEnd:   { bg: 'oklch(95% 0.08 320)', fg: 'oklch(35% 0.16 320)' },
  }
  const c = colors[tagKey] ?? { bg: 'var(--surface-overlay)', fg: 'var(--text-secondary)' }
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: c.bg, color: c.fg }}>
      {t(`numberSearch.tags.${tagKey}`)}
    </span>
  )
}

function fmtMoney(cents: number) { return `$${(cents / 100).toFixed(2)}/mo` }

export function NumberSearch({ search, purchase, shortlistKey, onPurchase, maxAllowed, currentCount }: NumberSearchProps) {
  const t = useT()
  const storageKey = STORAGE_PREFIX + shortlistKey

  // Filters
  const [areaCode, setAreaCode]       = useState('')
  const [pattern, setPattern]         = useState('')
  const [searching, setSearching]     = useState(false)
  const [results, setResults]         = useState<ScoredResult[]>([])
  const [sortKey, setSortKey]         = useState<keyof typeof sortComparators>('scoreDesc')
  const [message, setMessage]         = useState('')

  // Shortlist (localStorage-persisted)
  const [shortlist, setShortlist] = useState<SearchResult[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(shortlist))
    }
  }, [shortlist, storageKey])

  const [busy, setBusy] = useState<string | null>(null)
  const [shortlistOpen, setShortlistOpen] = useState(true)

  async function runSearch(filters?: SearchFilters) {
    setSearching(true)
    setMessage('')
    try {
      const f = filters ?? {
        areaCode: areaCode || undefined,
        pattern:  pattern  || undefined,
        country:  'US',
        limit:    50,
      }
      // Sync filter state when called from "find similar"
      if (filters) {
        setAreaCode(filters.areaCode ?? '')
        setPattern(filters.pattern  ?? '')
      }
      const raw = await search(f)
      setResults(raw.map(r => ({ ...r, _score: scoreNumber(r.phoneNumber) })))
    } catch (e) {
      setMessage((e as Error).message)
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const sortedResults = useMemo(() => [...results].sort(sortComparators[sortKey]!), [results, sortKey])

  const shortlistKeys = useMemo(() => new Set(shortlist.map(s => s.phoneNumber)), [shortlist])

  function toggleSave(num: SearchResult) {
    setShortlist(prev => {
      if (prev.some(p => p.phoneNumber === num.phoneNumber)) {
        return prev.filter(p => p.phoneNumber !== num.phoneNumber)
      }
      return [...prev, num]
    })
  }

  async function handlePurchase(num: SearchResult, source: 'results' | 'shortlist') {
    if (!confirm(t('numberSearch.purchase.confirm', { phone: num.phoneNumber, price: fmtMoney(num.monthlyPriceCents) }))) return
    setBusy(num.phoneNumber)
    setMessage('')
    try {
      await purchase(num.phoneNumber)
      setMessage(t('numberSearch.purchase.success', { phone: num.phoneNumber }))
      // Drop from shortlist + results — number's no longer available to buy
      setShortlist(prev => prev.filter(p => p.phoneNumber !== num.phoneNumber))
      if (source === 'results') setResults(prev => prev.filter(p => p.phoneNumber !== num.phoneNumber))
      onPurchase(num.phoneNumber)
    } catch (e) {
      const msg = (e as Error).message
      // Twilio race condition — number sold to someone else between save and click
      if (/no longer available|not available|21422/i.test(msg)) {
        setMessage(t('numberSearch.purchase.unavailable', { phone: num.phoneNumber }))
        setShortlist(prev => prev.filter(p => p.phoneNumber !== num.phoneNumber))
      } else {
        setMessage(`${t('numberSearch.purchase.error')}: ${msg}`)
      }
    } finally {
      setBusy(null)
    }
  }

  function findSimilar(num: SearchResult, suggestion: { areaCode?: string; pattern?: string }) {
    runSearch({
      areaCode: suggestion.areaCode,
      pattern:  suggestion.pattern,
      country:  'US',
      limit:    50,
    })
    void num
  }

  const capInfoText = (maxAllowed != null && currentCount != null)
    ? t('numberSearch.planCap', { current: currentCount, max: maxAllowed })
    : null

  return (
    <div className="space-y-4">
      {/* Filter form */}
      <div className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('numberSearch.areaCode')}</label>
            <input
              value={areaCode}
              onChange={e => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="610"
              className="px-3 py-1.5 rounded-lg text-sm w-24"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
              {t('numberSearch.pattern')}
              <span className="ml-1.5 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{t('numberSearch.patternHint')}</span>
            </label>
            <input
              value={pattern}
              onChange={e => setPattern(e.target.value)}
              placeholder="*1234"
              className="px-3 py-1.5 rounded-lg text-sm w-40"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>
          <button
            onClick={() => runSearch()}
            disabled={searching}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: 'oklch(55% 0.11 193)', color: 'white' }}
          >
            {searching ? t('numberSearch.searching') : t('numberSearch.search')}
          </button>
          {results.length > 0 && (
            <div className="ml-auto">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('numberSearch.sortBy')}</label>
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as keyof typeof sortComparators)}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                <option value="scoreDesc">{t('numberSearch.sort.byScore')}</option>
                <option value="phoneAsc">{t('numberSearch.sort.byPhoneAsc')}</option>
                <option value="phoneDesc">{t('numberSearch.sort.byPhoneDesc')}</option>
                <option value="last4Asc">{t('numberSearch.sort.byLast4')}</option>
              </select>
            </div>
          )}
        </div>
        {capInfoText && (
          <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>{capInfoText}</p>
        )}
      </div>

      {message && (
        <div className="rounded-lg p-3 text-sm" style={{
          background: message.startsWith('✓') || message.includes('success') ? 'oklch(96% 0.05 145)' : 'oklch(95% 0.05 25)',
          color:      message.startsWith('✓') || message.includes('success') ? 'oklch(35% 0.16 145)' : 'oklch(35% 0.18 25)',
        }}>{message}</div>
      )}

      {/* Two-column layout: results left, shortlist drawer right */}
      <div className="flex gap-4">
        {/* Results */}
        <div className="flex-1 min-w-0">
          {sortedResults.length === 0 ? (
            <div className="rounded-xl p-5 text-sm text-center" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
              {searching ? t('numberSearch.searching') : t('numberSearch.results.empty')}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedResults.map(num => {
                const saved = shortlistKeys.has(num.phoneNumber)
                const suggestions = similaritySuggestions(num.phoneNumber)
                return (
                  <div key={num.phoneNumber} className="rounded-lg p-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{num.phoneNumber}</p>
                          {num._score.tags.map(tag => <ScoreTag key={tag} tagKey={tag} t={t} />)}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs flex-wrap" style={{ color: 'var(--text-tertiary)' }}>
                          <span>{[num.locality, num.region].filter(Boolean).join(', ') || 'US'}</span>
                          <span>·</span>
                          <span>{fmtMoney(num.monthlyPriceCents)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <CapBadge on={num.capabilities.voice} label="V" />
                        <CapBadge on={num.capabilities.sms}   label="S" />
                        <CapBadge on={num.capabilities.mms}   label="M" />
                        <button
                          onClick={() => toggleSave(num)}
                          className="text-xs px-2.5 py-1 rounded font-medium ml-2"
                          style={{
                            background: saved ? 'oklch(55% 0.18 25 / 0.1)' : 'transparent',
                            color:      saved ? 'oklch(50% 0.18 25)' : 'oklch(55% 0.11 193)',
                            border:     `1px solid ${saved ? 'oklch(50% 0.18 25 / 0.5)' : 'oklch(55% 0.11 193)'}`,
                          }}
                        >
                          {saved ? t('numberSearch.results.saved') : t('numberSearch.results.save')}
                        </button>
                        <button
                          onClick={() => handlePurchase(num, 'results')}
                          disabled={busy === num.phoneNumber}
                          className="text-xs px-3 py-1 rounded font-semibold"
                          style={{ background: 'oklch(55% 0.18 145)', color: 'white' }}
                        >
                          {busy === num.phoneNumber ? t('numberSearch.results.buying') : t('numberSearch.results.buy')}
                        </button>
                      </div>
                    </div>
                    {suggestions.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{t('numberSearch.results.findMoreLike')}</span>
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => findSimilar(num, s.filters)}
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                          >
                            {t(s.labelKey)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Shortlist drawer */}
        {shortlistOpen ? (
          <div className="w-72 flex-shrink-0">
            <div className="rounded-xl p-4 sticky top-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('numberSearch.shortlist.title')}
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>({shortlist.length})</span>
                </h3>
                <button onClick={() => setShortlistOpen(false)} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('numberSearch.shortlist.collapse')}</button>
              </div>
              {shortlist.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('numberSearch.shortlist.empty')}</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {shortlist.map(num => {
                      const sc = scoreNumber(num.phoneNumber)
                      return (
                        <div key={num.phoneNumber} className="rounded p-2.5" style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)' }}>
                          <p className="font-mono text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{num.phoneNumber}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {sc.tags.map(tag => <ScoreTag key={tag} tagKey={tag} t={t} />)}
                          </div>
                          <div className="flex gap-1.5 mt-2">
                            <button
                              onClick={() => handlePurchase(num, 'shortlist')}
                              disabled={busy === num.phoneNumber}
                              className="text-[10px] px-2 py-1 rounded font-semibold flex-1"
                              style={{ background: 'oklch(55% 0.18 145)', color: 'white' }}
                            >
                              {busy === num.phoneNumber ? t('numberSearch.results.buying') : t('numberSearch.shortlist.buy')}
                            </button>
                            <button
                              onClick={() => toggleSave(num)}
                              className="text-[10px] px-2 py-1 rounded font-medium"
                              style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}
                            >
                              {t('numberSearch.shortlist.remove')}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setShortlist([])}
                    className="text-xs mt-3 w-full"
                    style={{ color: 'oklch(55% 0.18 25)' }}
                  >
                    {t('numberSearch.shortlist.clearAll')}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShortlistOpen(true)}
            className="self-start text-xs px-3 py-2 rounded-lg font-medium"
            style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            {t('numberSearch.shortlist.show', { n: shortlist.length })}
          </button>
        )}
      </div>
    </div>
  )
}
