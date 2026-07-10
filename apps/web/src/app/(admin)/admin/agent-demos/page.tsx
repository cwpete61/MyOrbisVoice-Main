'use client'

/**
 * MyOrbisAgents — custom agent demo builder (operator console). Platform-admin,
 * agents host only. Paste an agent + up to 3 listings → we provision a per-agent
 * demo tenant (Orby + listings + enrichment) → review the enriched preview →
 * (Lane D) email the agent a live demo + promo. Calls /api/admin/agent-demos/*.
 * Admin-facing → English only.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, API_BASE } from '@/hooks/useApi'
import { getAccessToken } from '@/lib/auth'
import { DEFAULT_SAMPLE_LISTINGS, DEFAULT_SAMPLE_MARKET } from './sample-listings'

const TEAL = 'oklch(55% 0.11 193)'

interface AgentDemoRow {
  id: string; agentName: string; brokerage: string | null; market: string; agentEmail: string
  agentPhone: string | null; pin: string; micrositeSlug: string; recommendedTier: string
  status: string; listingCount: number; expiresAt: string | null; sentAt: string | null; createdAt: string
}

const TIER_LABEL: Record<string, string> = { '297': 'Solo Capture ($297/mo)', '497': 'Solo Power ($497/mo)' }
const statusStyle = (s: string) =>
  s === 'READY'      ? { color: 'oklch(55% 0.15 150)', border: 'oklch(55% 0.15 150)' }
  : s === 'GENERATING' ? { color: 'oklch(60% 0.14 75)', border: 'oklch(60% 0.14 75)' }
  : s === 'SENT'       ? { color: TEAL, border: TEAL }
  : s === 'CLAIMED'    ? { color: 'oklch(55% 0.16 145)', border: 'oklch(55% 0.16 145)' }
  : { color: 'var(--text-tertiary)', border: 'var(--border-subtle)' }

export default function AgentDemosPage() {
  const [agentName, setAgentName]   = useState('')
  const [brokerage, setBrokerage]   = useState('')
  const [market, setMarket]         = useState(DEFAULT_SAMPLE_MARKET)
  const [agentEmail, setAgentEmail] = useState('')
  const [agentPhone, setAgentPhone] = useState('')
  const [specialties, setSpecialties] = useState('')
  const [l1, setL1] = useState(DEFAULT_SAMPLE_LISTINGS[0])
  const [l2, setL2] = useState(DEFAULT_SAMPLE_LISTINGS[1])
  const [l3, setL3] = useState(DEFAULT_SAMPLE_LISTINGS[2])
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState('')
  const [rows, setRows] = useState<AgentDemoRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try { setRows(await apiFetch<AgentDemoRow[]>('/api/admin/agent-demos')) } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

  // Poll while anything is still generating (background enrichment).
  useEffect(() => {
    const generating = rows.some(r => r.status === 'GENERATING')
    if (generating && !pollRef.current) {
      pollRef.current = setInterval(load, 4000)
    } else if (!generating && pollRef.current) {
      clearInterval(pollRef.current); pollRef.current = null
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [rows, load])

  async function create() {
    setErr('')
    const listings = [l1, l2, l3].map(s => s.trim()).filter(Boolean)
    if (agentName.trim().length < 2 || market.trim().length < 2 || !agentEmail.includes('@') || listings.length === 0) {
      setErr('Agent name, market, a valid email, and at least one listing are required.')
      return
    }
    setBusy(true)
    try {
      await apiFetch('/api/admin/agent-demos', {
        method: 'POST',
        body: JSON.stringify({
          agentName: agentName.trim(), brokerage: brokerage.trim() || undefined, market: market.trim(),
          agentEmail: agentEmail.trim(), agentPhone: agentPhone.trim() || undefined,
          specialties: specialties.trim() || undefined, listings,
        }),
      })
      setAgentName(''); setBrokerage(''); setMarket(DEFAULT_SAMPLE_MARKET); setAgentEmail(''); setAgentPhone('')
      setSpecialties(''); resetListings()
      await load()
    } catch (e) {
      setErr((e as Error).message || 'Could not create the demo.')
    } finally { setBusy(false) }
  }

  async function send(id: string) {
    try { await apiFetch(`/api/admin/agent-demos/${id}/send`, { method: 'POST' }); await load() }
    catch (e) { setErr((e as Error).message || 'Send failed.') }
  }
  async function remove(id: string) {
    if (!window.confirm('Delete this demo? Removes it from the list and its throwaway demo workspace. (Claimed demos can’t be deleted here.)')) return
    setRows(rs => rs.filter(r => r.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    try { await apiFetch(`/api/admin/agent-demos/${id}`, { method: 'DELETE' }); await load() }
    catch (e) { setErr((e as Error).message || 'Delete failed.'); await load() }
  }

  // Default sample listings — editable. "Reset" restores the 3 samples;
  // "Clear" blanks all three for a fully custom demo.
  function resetListings() { setL1(DEFAULT_SAMPLE_LISTINGS[0]); setL2(DEFAULT_SAMPLE_LISTINGS[1]); setL3(DEFAULT_SAMPLE_LISTINGS[2]) }
  function clearListings() { setL1(''); setL2(''); setL3('') }

  // Bulk selection — CLAIMED demos aren't selectable (can't be deleted here).
  const selectableIds = rows.filter(r => r.status !== 'CLAIMED').map(r => r.id)
  const allSelected   = selectableIds.length > 0 && selectableIds.every(id => selected.has(id))
  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(selectableIds)) }
  async function bulkRemove() {
    if (!selected.size) return
    if (!window.confirm(`Delete ${selected.size} demo(s)? Claimed demos are skipped.`)) return
    const ids = [...selected]
    setRows(rs => rs.filter(r => !selected.has(r.id)))   // optimistic
    setSelected(new Set())
    try { await apiFetch('/api/admin/agent-demos/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }) }
    catch (e) { setErr((e as Error).message || 'Bulk delete failed.') }
    finally { await load() }   // reconciles any skipped/claimed rows back in
  }

  // Bulk import from an uploaded .xlsx / .csv — parsed server-side.
  async function onImportFile(file: File) {
    setImportMsg(''); setImportBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      // Chunked base64 so large files don't blow the call stack.
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      const dataBase64 = btoa(bin)
      const r = await apiFetch<{ createdCount: number; failedCount: number; failed: { row: number; reason: string }[] }>(
        '/api/admin/agent-demos/import', { method: 'POST', body: JSON.stringify({ dataBase64, filename: file.name }) })
      const skipped = r.failed.length
        ? ` · ${r.failedCount} skipped (${r.failed.slice(0, 3).map(f => `row ${f.row}: ${f.reason}`).join('; ')}${r.failed.length > 3 ? '…' : ''})`
        : ''
      setImportMsg(`Imported ${r.createdCount} demo${r.createdCount === 1 ? '' : 's'}${skipped}`)
      await load()
    } catch (e) {
      setImportMsg((e as Error).message || 'Import failed.')
    } finally {
      setImportBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  async function downloadTemplate() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/agent-demos/import-template`, {
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      })
      if (!res.ok) { setImportMsg('Could not download the template.'); return }
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a'); a.href = url; a.download = 'agent-demos-template.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } catch { setImportMsg('Could not download the template.') }
  }

  const micrositeUrl = (slug: string) => `https://app.myorbisagents.com/agent-demo/${slug}`
  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13,
    background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '8px 0 60px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Custom agent demos</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
        Paste a real-estate agent + up to 3 of their listings. We build a live Orby demo loaded with their
        properties, score their tier, and enrich the listings so Orby can answer area questions.
      </p>

      {/* Create form */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 18, marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Agent name
            <input style={inp} value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="Jane Realtor" /></label>
          <label style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Brokerage
            <input style={inp} value={brokerage} onChange={e => setBrokerage(e.target.value)} placeholder="Austin Realtors" /></label>
          <label style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Market
            <input style={inp} value={market} onChange={e => setMarket(e.target.value)} placeholder="Austin metro" /></label>
          <label style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Specialties
            <input style={inp} value={specialties} onChange={e => setSpecialties(e.target.value)} placeholder="luxury, first-time buyers" /></label>
          <label style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Agent email
            <input style={inp} value={agentEmail} onChange={e => setAgentEmail(e.target.value)} placeholder="jane@brokerage.com" /></label>
          <label style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Agent phone <span style={{ opacity: 0.7 }}>(caller-ID routing)</span>
            <input style={inp} value={agentPhone} onChange={e => setAgentPhone(e.target.value)} placeholder="(555) 123-4567" /></label>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {[[l1, setL1], [l2, setL2], [l3, setL3]].map(([v, set], i) => (
            <label key={i} style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Listing {i + 1}{i > 0 ? ' (optional)' : ''}
              <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={v as string}
                onChange={e => (set as (s: string) => void)(e.target.value)}
                placeholder="Paste the listing — address, price, beds/baths, highlights…" /></label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
          <button type="button" onClick={resetListings}
            style={{ background: 'none', border: 'none', color: TEAL, cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}>
            Reset to sample listings
          </button>
          <button type="button" onClick={clearListings}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}>
            Clear listings
          </button>
        </div>
        {err && <p style={{ color: 'oklch(55% 0.2 25)', fontSize: 13, marginTop: 10 }}>{err}</p>}
        <button onClick={create} disabled={busy}
          style={{ marginTop: 14, padding: '9px 18px', borderRadius: 8, background: TEAL, color: '#fff',
                   fontSize: 13, fontWeight: 600, border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Building demo…' : 'Build demo'}
        </button>
      </div>

      {/* Bulk import from file */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16, marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Bulk import from a file</div>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
          Upload an .xlsx or .csv — one demo per row. Columns: agent_name, brokerage, market, agent_email, agent_phone, specialties, listing_1, listing_2, listing_3.
        </p>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" disabled={importBusy}
            onChange={e => { const f = e.target.files?.[0]; if (f) onImportFile(f) }}
            style={{ fontSize: 12 }} />
          <button type="button" onClick={downloadTemplate}
            style={{ background: 'none', border: 'none', color: TEAL, cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}>
            Download sample template (.xlsx)
          </button>
          {importBusy && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Importing…</span>}
        </div>
        {importMsg && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{importMsg}</p>}
      </div>

      {/* List */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', margin: 0 }}>Demos</h2>
        {selectableIds.length > 0 && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all
          </label>
        )}
        {selected.size > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{selected.size} selected</span>
            <button onClick={bulkRemove}
              style={{ padding: '5px 12px', borderRadius: 6, background: '#dc2626', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Delete selected
            </button>
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No demos yet. Build one above.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map(r => {
            const st = statusStyle(r.status)
            return (
              <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {r.status !== 'CLAIMED' && (
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label="Select demo" />
                    )}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{r.agentName}{r.brokerage ? <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> · {r.brokerage}</span> : null}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.market} · {r.agentEmail}{r.agentPhone ? ` · ${r.agentPhone}` : ''} · {r.listingCount} listing{r.listingCount === 1 ? '' : 's'}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: st.color, border: `1px solid ${st.border}` }}>{r.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
                  <span>Tier: <strong style={{ color: 'var(--text-primary)' }}>{TIER_LABEL[r.recommendedTier] ?? r.recommendedTier}</strong></span>
                  <span>Call PIN: <strong style={{ color: 'var(--text-primary)', letterSpacing: '0.1em' }}>{r.pin}</strong></span>
                  <a href={micrositeUrl(r.micrositeSlug)} target="_blank" rel="noreferrer" style={{ color: TEAL }}>Preview microsite →</a>
                  {r.status === 'CLAIMED' ? (
                    <span style={{ opacity: 0.7 }}>claimed 🎉</span>
                  ) : r.status === 'GENERATING' ? (
                    <span style={{ opacity: 0.6 }}>enriching…</span>
                  ) : (
                    <button onClick={() => send(r.id)}
                      style={{ background: 'none', border: 'none', color: TEAL, cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}>
                      {r.status === 'SENT' ? 'Resend email' : 'Send email →'}
                    </button>
                  )}
                  {r.status === 'SENT' && <span style={{ opacity: 0.6 }}>sent</span>}
                  {r.status !== 'CLAIMED' && (
                    <button onClick={() => remove(r.id)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, padding: 0, marginLeft: 'auto', textDecoration: 'underline' }}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
