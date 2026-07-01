'use client'

/**
 * MyOrbisAgents — agent prospect scorer (operator console). Platform-admin.
 * Paste a raw Zillow agent profile → AI extracts the fields → a deterministic
 * rubric scores fit (A/B/C) → save as a ranked target with a light pipeline.
 * Calls /api/admin/agent-prospects/*. Admin-facing → English only.
 */

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

const TEAL = 'oklch(55% 0.11 193)'

interface Fields {
  name: string; brokerage?: string | null; market?: string | null; email?: string | null; phone?: string | null
  salesLast12?: number | null; totalSales?: number | null; isTeam?: boolean; teamSize?: string | null
  avgPriceUsd?: number | null; priceRange?: string | null; yearsExp?: number | null; reviews?: number | null
  premierAgent?: boolean; language?: string | null
}
interface Evald { fields: Fields; score: number; tier: string; recommendedTier: string; reasons: string[]; pitchAngle: string; redFlags: string }
interface Prospect {
  id: string; name: string; market: string | null; salesLast12: number | null; premierAgent: boolean
  score: number; tier: string; recommendedTier: string | null; pitchAngle: string | null; redFlags: string | null; status: string
}

const STATUSES = ['TARGET', 'CONTACTED', 'DEMO', 'WON', 'LOST', 'SKIP']
const tierStyle = (t: string) => t === 'A' ? { color: 'oklch(55% 0.15 150)', border: 'oklch(55% 0.15 150)' }
  : t === 'B' ? { color: 'oklch(60% 0.14 75)', border: 'oklch(60% 0.14 75)' } : { color: 'var(--text-tertiary)', border: 'var(--border-subtle)' }

export default function ProspectsPage() {
  const [raw, setRaw] = useState('')
  const [ev, setEv] = useState<Evald | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<Prospect[]>([])

  const load = useCallback(async () => {
    try { const d = await apiFetch<{ items: Prospect[] }>('/api/admin/agent-prospects'); setRows(d.items ?? []) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed to load') }
  }, [])
  useEffect(() => { load() }, [load])

  const evaluate = async () => {
    setErr(''); setEv(null); setBusy(true)
    try { setEv(await apiFetch<Evald>('/api/admin/agent-prospects/evaluate', { method: 'POST', body: JSON.stringify({ rawText: raw }) })) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(false) }
  }
  const save = async () => {
    if (!ev) return; setBusy(true)
    try {
      await apiFetch('/api/admin/agent-prospects', { method: 'POST', body: JSON.stringify({ fields: ev.fields, score: ev.score, tier: ev.tier, recommendedTier: ev.recommendedTier, pitchAngle: ev.pitchAngle, redFlags: ev.redFlags, rawText: raw }) })
      setEv(null); setRaw(''); await load()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }
  const setStatus = async (id: string, status: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))
    try { await apiFetch(`/api/admin/agent-prospects/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }) } catch { /* revert-on-fail skipped */ }
  }
  const remove = async (id: string) => {
    if (!window.confirm('Delete this prospect?')) return
    setRows((rs) => rs.filter((r) => r.id !== id))
    try { await apiFetch(`/api/admin/agent-prospects/${id}`, { method: 'DELETE' }) } catch { /* */ }
  }

  const input = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', color: 'var(--text-primary)', fontSize: 14 } as const
  const card = { background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 18, marginBottom: 16 } as const
  const mini = { background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 7, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>MyOrbisAgents — Prospects</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 20px' }}>Paste a real-estate agent&apos;s Zillow profile. AI extracts the details, a fixed rubric scores fit, keep the good ones as targets.</p>

      {err && <div style={{ background: 'oklch(60% 0.18 25 / 0.12)', color: 'oklch(50% 0.18 25)', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{err}</div>}

      <div style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>Score an agent</h2>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6} style={{ ...input, width: '100%', resize: 'vertical' }}
          placeholder="Paste the agent's Zillow profile (name, brokerage, sales last 12 months, reviews, price range, language, Premier Agent, etc.)" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <button onClick={evaluate} disabled={busy || raw.trim().length < 10}
            style={{ background: TEAL, color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: busy || raw.trim().length < 10 ? 0.6 : 1 }}>
            {busy ? 'Scoring…' : 'Evaluate'}
          </button>
        </div>

        {ev && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 16, paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{ev.score}<span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>/100</span></span>
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, border: `1px solid ${tierStyle(ev.tier).border}`, color: tierStyle(ev.tier).color }}>Tier {ev.tier}</span>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Pitch: <b>${ev.recommendedTier}</b> ({ev.recommendedTier === '497' ? 'Solo Power' : 'Solo Capture'})</span>
            </div>
            <div style={{ fontSize: 14, marginTop: 8, color: 'var(--text-primary)' }}><b>{ev.fields.name}</b>{ev.fields.brokerage ? ` · ${ev.fields.brokerage}` : ''}{ev.fields.market ? ` · ${ev.fields.market}` : ''}</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 3 }}>
              {ev.fields.salesLast12 != null && `${ev.fields.salesLast12} sales/12mo · `}
              {ev.fields.reviews != null && `${ev.fields.reviews} reviews · `}
              {ev.fields.avgPriceUsd != null && `avg $${ev.fields.avgPriceUsd.toLocaleString()} · `}
              {ev.fields.teamSize && `${ev.fields.teamSize} · `}
              {ev.fields.premierAgent && <span style={{ color: TEAL }}>Premier Agent · </span>}
              {ev.fields.language}
            </div>
            {ev.pitchAngle && <p style={{ fontSize: 14, marginTop: 8, color: 'var(--text-secondary)' }}>💬 {ev.pitchAngle}</p>}
            {ev.redFlags && <p style={{ fontSize: 13, marginTop: 4, color: 'oklch(55% 0.18 25)' }}>⚠ {ev.redFlags}</p>}
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{ev.reasons.join(' · ')}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={save} disabled={busy} style={{ ...mini, color: TEAL }}>Save as target</button>
              <button onClick={() => setEv(null)} style={mini}>Discard</button>
            </div>
          </div>
        )}
      </div>

      <div style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>Targets ({rows.length})</h2>
        {rows.length === 0 ? <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No prospects yet. Score one above.</p> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ padding: '1px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, border: `1px solid ${tierStyle(r.tier).border}`, color: tierStyle(r.tier).color }}>{r.tier} · {r.score}</span>
                    {r.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{[r.market, r.salesLast12 != null ? `${r.salesLast12} sales/yr` : null, r.premierAgent ? 'Premier' : null, `$${r.recommendedTier}`].filter(Boolean).join(' · ')}{r.redFlags ? ` · ⚠ ${r.redFlags}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} style={{ ...input, padding: '5px 8px', fontSize: 13 }}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => remove(r.id)} style={{ ...mini, color: 'oklch(55% 0.18 25)' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
