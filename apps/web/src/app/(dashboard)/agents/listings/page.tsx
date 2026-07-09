'use client'

/**
 * MyOrbisAgents — Listings (Step 3). Mobile-first. Paste a listing → AI formats
 * it Fair-Housing-safe → agent reviews/edits → save. Saved listings become
 * knowledge Orby answers from. CRUD over /api/listings.
 */

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

type Status = 'ACTIVE' | 'COMING_SOON' | 'PENDING' | 'SOLD' | 'RENTED' | 'POCKET' | 'OFF_MARKET'

interface Draft {
  address: string; headline: string | null; priceUsd: number | null
  beds: number | null; baths: number | null; sqft: number | null
  propertyType: string | null; description: string | null; highlights: string[]
}
interface TrackingNumber { id: string; e164Number: string; displayLabel: string | null }
interface Listing extends Draft {
  id: string; status: Status; isActive: boolean
  trackingNumber: TrackingNumber | null; callCount: number
  avmUsd: number | null; compsCount: number
}
interface AvailNumber { id: string; e164Number: string; displayLabel: string | null; isInboundEnabled: boolean }

const STATUSES: Status[] = ['ACTIVE', 'COMING_SOON', 'PENDING', 'SOLD', 'RENTED', 'POCKET', 'OFF_MARKET']
const emptyDraft: Draft = { address: '', headline: '', priceUsd: null, beds: null, baths: null, sqft: null, propertyType: '', description: '', highlights: [] }

export default function ListingsPage() {
  const t = useT()
  const [raw, setRaw] = useState('')
  const [draft, setDraft] = useState<(Draft & { status: Status }) | null>(null)
  const [rows, setRows] = useState<Listing[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [avail, setAvail] = useState<AvailNumber[]>([])
  const [entitled, setEntitled] = useState(false)
  const [assignFor, setAssignFor] = useState<string | null>(null) // listingId being assigned
  const [enriching, setEnriching] = useState<string | null>(null) // listingId being enriched

  const statusLabel = (s: Status) => t(`tenantAgentListings.status${s.split('_').map((w) => w[0] + w.slice(1).toLowerCase()).join('')}` as string)

  const load = useCallback(async () => {
    try { const d = await apiFetch<{ items: Listing[] }>('/api/listings'); setRows(d.items ?? []) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed to load') }
  }, [])
  const loadNumbers = useCallback(async () => {
    try { const d = await apiFetch<{ numbers: AvailNumber[]; entitled: boolean }>('/api/listings/available-numbers'); setAvail(d.numbers ?? []); setEntitled(!!d.entitled) }
    catch { /* non-fatal */ }
  }, [])
  useEffect(() => { load(); loadNumbers() }, [load, loadNumbers])

  const assignNumber = async (listingId: string, phoneNumberId: string) => {
    try {
      const tn = await apiFetch<TrackingNumber>(`/api/listings/${listingId}/tracking-number`, { method: 'POST', body: JSON.stringify({ phoneNumberId }) })
      setRows((rs) => rs.map((r) => (r.id === listingId ? { ...r, trackingNumber: tn } : r)))
      setAssignFor(null); await loadNumbers()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to assign') }
  }
  const removeNumber = async (listingId: string, phoneNumberId: string) => {
    setRows((rs) => rs.map((r) => (r.id === listingId ? { ...r, trackingNumber: null } : r)))
    try { await apiFetch(`/api/listings/${listingId}/tracking-number`, { method: 'DELETE', body: JSON.stringify({ phoneNumberId }) }); await loadNumbers() } catch { /* */ }
  }
  const enrich = async (id: string) => {
    setEnriching(id); setErr('')
    try {
      const e = await apiFetch<{ avmUsd: number | null; comps: unknown[] }>(`/api/listings/${id}/enrich`, { method: 'POST', body: JSON.stringify({}) })
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, avmUsd: e.avmUsd, compsCount: Array.isArray(e.comps) ? e.comps.length : 0 } : r)))
    } catch (er) { setErr(er instanceof Error ? er.message : t('tenantAgentListings.enrichLocked')) } finally { setEnriching(null) }
  }

  const openDraft = (d: Draft) => setDraft({ ...emptyDraft, ...d, status: 'ACTIVE' })

  const format = async () => {
    setErr(''); setBusy(true)
    try { openDraft(await apiFetch<Draft>('/api/listings/format', { method: 'POST', body: JSON.stringify({ rawText: raw }) })) }
    catch { setErr(t('tenantAgentListings.formatError')); openDraft({ ...emptyDraft }) }
    finally { setBusy(false) }
  }

  const save = async () => {
    if (!draft || draft.address.trim().length < 3) return
    setBusy(true); setErr('')
    try {
      await apiFetch('/api/listings', { method: 'POST', body: JSON.stringify({
        address: draft.address.trim(), headline: draft.headline || null, priceUsd: draft.priceUsd,
        beds: draft.beds, baths: draft.baths, sqft: draft.sqft, propertyType: draft.propertyType || null,
        description: draft.description || null, highlights: draft.highlights, status: draft.status,
        rawText: raw || null,
      }) })
      setDraft(null); setRaw(''); await load()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to save') } finally { setBusy(false) }
  }

  const remove = async (id: string) => {
    if (!window.confirm(t('tenantAgentListings.deleteConfirm'))) return
    setRows((rs) => rs.filter((r) => r.id !== id))
    try { await apiFetch(`/api/listings/${id}`, { method: 'DELETE' }) } catch { /* */ }
  }
  const setStatus = async (id: string, status: Status) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))
    try { await apiFetch(`/api/listings/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }) } catch { /* */ }
  }

  const field = 'w-full rounded-lg px-3 py-2.5 text-base'
  const fieldStyle = { background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' } as const
  const label = 'block text-xs font-medium mb-1'
  const labelStyle = { color: 'var(--text-tertiary)' } as const
  const upd = (patch: Partial<Draft & { status: Status }>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v))

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentListings.title')}</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('tenantAgentListings.subtitle')}</p>

      {err && <div className="mt-4 rounded-lg px-3 py-2.5 text-sm" style={{ background: 'oklch(60% 0.18 25 / 0.12)', color: 'oklch(50% 0.18 25)' }}>{err}</div>}

      {/* Paste + format */}
      {!draft && (
        <div className="mt-6 rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('tenantAgentListings.pasteLabel')}</label>
          <textarea className={field} style={{ ...fieldStyle, resize: 'vertical' }} rows={5} value={raw} onChange={(e) => setRaw(e.target.value)}
            placeholder={t('tenantAgentListings.pastePlaceholder')} />
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={format} disabled={busy || raw.trim().length < 10}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white" style={{ background: 'var(--accent, #0d9488)', opacity: busy || raw.trim().length < 10 ? 0.6 : 1 }}>
              {busy ? t('tenantAgentListings.formatting') : t('tenantAgentListings.formatBtn')}
            </button>
            <button onClick={() => openDraft({ ...emptyDraft })} className="rounded-lg px-4 py-2.5 text-sm font-semibold"
              style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
              {t('tenantAgentListings.manualAdd')}
            </button>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantAgentListings.fairHousingNote')}</p>
        </div>
      )}

      {/* Review + save */}
      {draft && (
        <div className="mt-6 rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentListings.confirmTitle')}</h2>
          <div className="grid gap-3">
            <div><label className={label} style={labelStyle}>{t('tenantAgentListings.addressLabel')} *</label>
              <input className={field} style={fieldStyle} value={draft.address} onChange={(e) => upd({ address: e.target.value })} /></div>
            <div><label className={label} style={labelStyle}>{t('tenantAgentListings.headlineLabel')}</label>
              <input className={field} style={fieldStyle} value={draft.headline ?? ''} onChange={(e) => upd({ headline: e.target.value })} /></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><label className={label} style={labelStyle}>{t('tenantAgentListings.priceLabel')}</label>
                <input className={field} style={fieldStyle} inputMode="numeric" value={draft.priceUsd ?? ''} onChange={(e) => upd({ priceUsd: numOrNull(e.target.value) })} /></div>
              <div><label className={label} style={labelStyle}>{t('tenantAgentListings.bedsLabel')}</label>
                <input className={field} style={fieldStyle} inputMode="decimal" value={draft.beds ?? ''} onChange={(e) => upd({ beds: numOrNull(e.target.value) })} /></div>
              <div><label className={label} style={labelStyle}>{t('tenantAgentListings.bathsLabel')}</label>
                <input className={field} style={fieldStyle} inputMode="decimal" value={draft.baths ?? ''} onChange={(e) => upd({ baths: numOrNull(e.target.value) })} /></div>
              <div><label className={label} style={labelStyle}>{t('tenantAgentListings.sqftLabel')}</label>
                <input className={field} style={fieldStyle} inputMode="numeric" value={draft.sqft ?? ''} onChange={(e) => upd({ sqft: numOrNull(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label} style={labelStyle}>{t('tenantAgentListings.typeLabel')}</label>
                <input className={field} style={fieldStyle} value={draft.propertyType ?? ''} onChange={(e) => upd({ propertyType: e.target.value })} /></div>
              <div><label className={label} style={labelStyle}>{t('tenantAgentListings.statusLabel')}</label>
                <select className={field} style={fieldStyle} value={draft.status} onChange={(e) => upd({ status: e.target.value as Status })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select></div>
            </div>
            <div><label className={label} style={labelStyle}>{t('tenantAgentListings.descriptionLabel')}</label>
              <textarea className={field} style={{ ...fieldStyle, resize: 'vertical' }} rows={3} value={draft.description ?? ''} onChange={(e) => upd({ description: e.target.value })} /></div>
            <div><label className={label} style={labelStyle}>{t('tenantAgentListings.highlightsLabel')}</label>
              <textarea className={field} style={{ ...fieldStyle, resize: 'vertical' }} rows={3} value={draft.highlights.join('\n')} onChange={(e) => upd({ highlights: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={busy || draft.address.trim().length < 3}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white" style={{ background: 'var(--accent, #0d9488)', opacity: busy || draft.address.trim().length < 3 ? 0.6 : 1 }}>
              {busy ? t('tenantAgentListings.saving') : t('tenantAgentListings.saveBtn')}
            </button>
            <button onClick={() => setDraft(null)} className="rounded-lg px-4 py-2.5 text-sm font-semibold"
              style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
              {t('tenantAgentListings.cancelBtn')}
            </button>
          </div>
        </div>
      )}

      {/* Book */}
      <div className="mt-8">
        <h2 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentListings.bookTitle')} ({rows.length})</h2>
        {rows.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('tenantAgentListings.empty')}</p> : (
          <div className="grid gap-3">
            {rows.map((l) => (
              <div key={l.id} className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{l.headline || l.address}</div>
                    <div className="text-sm truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {[l.priceUsd != null ? `$${l.priceUsd.toLocaleString('en-US')}` : null, l.beds != null ? `${l.beds} bd` : null, l.baths != null ? `${l.baths} ba` : null, l.sqft != null ? `${l.sqft.toLocaleString('en-US')} sqft` : null].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select value={l.status} onChange={(e) => setStatus(l.id, e.target.value as Status)} className="rounded-lg px-2 py-1.5 text-xs" style={fieldStyle}>
                      {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                    </select>
                    <button onClick={() => remove(l.id)} className="text-sm px-2 py-1.5 rounded-lg" style={{ color: 'oklch(55% 0.18 25)' }}>✕</button>
                  </div>
                </div>
                {l.description && <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{l.description}</p>}

                {/* Tracking number + call attribution */}
                <div className="mt-3 pt-3 flex items-center gap-3 flex-wrap text-sm" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: l.callCount > 0 ? 'var(--accent, #0d9488)' : 'var(--text-tertiary)' }}>
                    📞 {l.callCount} {l.callCount === 1 ? t('tenantAgentListings.callsOne') : t('tenantAgentListings.calls')}
                  </span>
                  {l.trackingNumber ? (
                    <span className="inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>{t('tenantAgentListings.trackingLabel')}:</span>
                      <b style={{ color: 'var(--text-primary)' }}>{l.trackingNumber.e164Number}</b>
                      <button onClick={() => removeNumber(l.id, l.trackingNumber!.id)} className="text-xs underline" style={{ color: 'var(--text-tertiary)' }}>{t('tenantAgentListings.removeTracking')}</button>
                    </span>
                  ) : assignFor === l.id ? (
                    avail.length === 0 ? (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('tenantAgentListings.noSpareNumbers')}</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <select className="rounded-lg px-2 py-1 text-xs" style={fieldStyle} defaultValue="" onChange={(e) => e.target.value && assignNumber(l.id, e.target.value)}>
                          <option value="" disabled>{t('tenantAgentListings.assignTitle')}</option>
                          {avail.map((n) => <option key={n.id} value={n.id}>{n.e164Number}{n.displayLabel ? ` (${n.displayLabel})` : ''}</option>)}
                        </select>
                        <button onClick={() => setAssignFor(null)} className="text-xs underline" style={{ color: 'var(--text-tertiary)' }}>{t('tenantAgentListings.cancel')}</button>
                      </span>
                    )
                  ) : entitled ? (
                    <button onClick={() => setAssignFor(l.id)} className="text-xs font-semibold" style={{ color: 'var(--accent, #0d9488)' }}>+ {t('tenantAgentListings.addTracking')}</button>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }} title={t('tenantAgentListings.trackingLocked')}>🔒 {t('tenantAgentListings.trackingLabel')}</span>
                  )}

                  {/* Enrichment — estimated value + comps */}
                  <span style={{ marginLeft: 'auto' }} className="inline-flex items-center gap-2">
                    {l.avmUsd != null ? (
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {t('tenantAgentListings.estValue')} <b style={{ color: 'var(--text-primary)' }}>${l.avmUsd.toLocaleString('en-US')}</b>
                        {l.compsCount > 0 && <span style={{ color: 'var(--text-tertiary)' }}> · {l.compsCount} {t('tenantAgentListings.compsN')}</span>}
                      </span>
                    ) : entitled ? (
                      <button onClick={() => enrich(l.id)} disabled={enriching === l.id} className="text-xs font-semibold" style={{ color: 'var(--accent, #0d9488)', opacity: enriching === l.id ? 0.6 : 1 }}>
                        {enriching === l.id ? t('tenantAgentListings.enriching') : t('tenantAgentListings.enrichBtn')}
                      </button>
                    ) : null}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
