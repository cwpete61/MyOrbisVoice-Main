'use client'
/* Admin: Agent Qualifier — "Targets" view. Scorecards (result vs target), verdict,
 * accept/override, plus per-row Edit + Delete and Select-all / bulk delete. */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'

type Row = { label: string; target: string; result: string; pass: boolean }
type App = {
  id: string; type: string; fullName: string; email: string; phone?: string; market?: string; notes?: string
  score: number; verdict: 'QUALIFIED' | 'BORDERLINE' | 'PASS'; status: 'NEW' | 'ACCEPTED' | 'REJECTED'
  scoreJson?: { rows: Row[]; recommendedTier: string }
  proposal?: { id: string; status: string } | null; createdAt: string
}
const vColor: Record<string, string> = { QUALIFIED: '#34c759', BORDERLINE: '#ffb347', PASS: '#ff5c5c' }

export default function AgentQualifierPage() {
  const [apps, setApps] = useState<App[]>([])
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [editId, setEditId] = useState<string | null>(null)
  const [ef, setEf] = useState<Record<string, string>>({})

  async function load() {
    try { setApps(await apiFetch<App[]>('/api/admin/agent-applications' + (filter ? `?status=${filter}` : ''))); setSel(new Set()) } catch { /* ignore */ }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [filter])

  async function decide(id: string, status: 'ACCEPTED' | 'REJECTED') {
    setBusy(id)
    try { await apiFetch(`/api/admin/agent-applications/${id}/decision`, { method: 'POST', body: JSON.stringify({ status }) }); await load() }
    catch { /* ignore */ } finally { setBusy(null) }
  }
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSelected = apps.length > 0 && sel.size === apps.length
  const selectAll = () => setSel(allSelected ? new Set() : new Set(apps.map(a => a.id)))
  async function del(ids: string[]) {
    if (!ids.length || !confirm(`Delete ${ids.length} application${ids.length > 1 ? 's' : ''}? This can't be undone.`)) return
    setBusy('bulk')
    try { await apiFetch('/api/admin/agent-applications/delete', { method: 'POST', body: JSON.stringify({ ids }) }); await load() }
    catch { /* ignore */ } finally { setBusy(null) }
  }
  function startEdit(a: App) { setEditId(a.id); setEf({ fullName: a.fullName, email: a.email, phone: a.phone ?? '', market: a.market ?? '', notes: a.notes ?? '' }) }
  async function saveEdit(id: string) {
    setBusy(id)
    try { await apiFetch(`/api/admin/agent-applications/${id}`, { method: 'PATCH', body: JSON.stringify(ef) }); setEditId(null); await load() }
    catch { /* ignore */ } finally { setBusy(null) }
  }

  const card = { background: 'var(--surface-1,#0f1c30)', border: '1px solid var(--border,#22344f)', borderRadius: 14, padding: 18, marginBottom: 12 } as const
  const pill = (bg: string) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: bg + '22', color: bg, border: `1px solid ${bg}55` }) as const
  const btn = (bg: string, fg: string) => ({ padding: '8px 14px', borderRadius: 9, border: bg === 'transparent' ? '1px solid var(--border,#22344f)' : 0, cursor: 'pointer', fontWeight: 700, fontSize: 13, background: bg, color: fg }) as const
  const einp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border,#22344f)', background: 'var(--surface-2,#0c1626)', color: 'var(--text-primary,#e8eef7)', fontSize: 13, marginTop: 6 } as const

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Agent Qualifier</h1>
        <Link href="/admin/proposals" style={{ marginLeft: 'auto', fontSize: 14, color: '#1fc3c3', fontWeight: 700 }}>Proposals →</Link>
      </div>
      <p style={{ color: 'var(--text-secondary,#9fb0c7)', marginTop: 0, fontSize: 14 }}>Applicants scored against the qualification targets. Accepting a lead auto-drafts a proposal.</p>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0 14px', alignItems: 'center', flexWrap: 'wrap' }}>
        {['', 'NEW', 'ACCEPTED', 'REJECTED'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ ...pill(filter === s ? '#1fc3c3' : '#9fb0c7'), cursor: 'pointer' }}>{s || 'All'}</button>
        ))}
        {apps.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8, fontSize: 13, color: 'var(--text-secondary,#9fb0c7)', cursor: 'pointer' }}>
            <input type="checkbox" checked={allSelected} onChange={selectAll} /> Select all
          </label>
        )}
        {sel.size > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary,#9fb0c7)' }}>{sel.size} selected</span>
            <button disabled={busy === 'bulk'} onClick={() => del([...sel])} style={btn('#c0392b', '#fff')}>Delete selected</button>
          </div>
        )}
      </div>

      {apps.length === 0 && <p style={{ color: '#9fb0c7' }}>No applications yet.</p>}

      {apps.map(a => (
        <div key={a.id} style={{ ...card, outline: sel.has(a.id) ? '2px solid #1fc3c3' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id)} />
            <b style={{ fontSize: 16 }}>{a.fullName}</b>
            <span style={pill(a.type === 'TEAM' ? '#5fc46a' : '#1fc3c3')}>{a.type === 'TEAM' ? 'Team / Broker' : 'Individual'}</span>
            <span style={pill(vColor[a.verdict] ?? '#9fb0c7')}>{a.verdict} · {a.score}</span>
            {a.status !== 'NEW' && <span style={pill(a.status === 'ACCEPTED' ? '#34c759' : '#ff5c5c')}>{a.status}</span>}
            <span style={{ marginLeft: 'auto', color: '#7a8aa0', fontSize: 13 }}>{a.email}{a.market ? ` · ${a.market}` : ''}</span>
          </div>

          {editId === a.id ? (
            <div style={{ marginTop: 12 }}>
              {(['fullName', 'email', 'phone', 'market', 'notes'] as const).map(k => (
                <label key={k} style={{ display: 'block', fontSize: 12, color: '#7a8aa0' }}>{k}<input style={einp} value={ef[k] ?? ''} onChange={e => setEf(p => ({ ...p, [k]: e.target.value }))} /></label>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button disabled={busy === a.id} onClick={() => saveEdit(a.id)} style={btn('#1fc3c3', '#03201f')}>Save</button>
                <button onClick={() => setEditId(null)} style={btn('transparent', '#9fb0c7')}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <button onClick={() => setOpen(open === a.id ? null : a.id)} style={{ marginTop: 10, background: 'none', border: 'none', color: '#1fc3c3', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
                {open === a.id ? 'Hide analysis' : 'Show analysis'}
              </button>
              {open === a.id && a.scoreJson && (
                <table style={{ width: '100%', borderCollapse: 'collapse', margin: '12px 0', fontSize: 13.5 }}>
                  <thead><tr style={{ color: '#7a8aa0', textAlign: 'left' }}><th style={{ padding: '6px 8px' }}>Metric</th><th style={{ padding: '6px 8px' }}>Target</th><th style={{ padding: '6px 8px' }}>Theirs</th><th></th></tr></thead>
                  <tbody>
                    {a.scoreJson.rows.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #22344f' }}>
                        <td style={{ padding: '6px 8px', color: '#c9d6e6' }}>{r.label}</td>
                        <td style={{ padding: '6px 8px', color: '#9fb0c7' }}>{r.target}</td>
                        <td style={{ padding: '6px 8px', color: '#e8eef7', fontWeight: 600 }}>{r.result}</td>
                        <td style={{ padding: '6px 8px' }}>{r.pass ? '✅' : '❌'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {a.status === 'NEW' ? (
                  <>
                    <button disabled={busy === a.id} onClick={() => decide(a.id, 'ACCEPTED')} style={btn('#1fc3c3', '#03201f')}>Accept → draft proposal</button>
                    <button disabled={busy === a.id} onClick={() => decide(a.id, 'REJECTED')} style={btn('transparent', '#ff8a80')}>Reject</button>
                  </>
                ) : a.status === 'ACCEPTED' && a.proposal ? (
                  <Link href="/admin/proposals" style={{ fontSize: 13, color: '#34c759', fontWeight: 700 }}>Proposal drafted ({a.proposal.status}) →</Link>
                ) : (
                  <button disabled={busy === a.id} onClick={() => decide(a.id, a.status === 'REJECTED' ? 'ACCEPTED' : 'REJECTED')} style={btn('transparent', '#9fb0c7')}>Override → {a.status === 'REJECTED' ? 'Accept' : 'Reject'}</button>
                )}
                <button onClick={() => startEdit(a)} style={btn('transparent', '#9fb0c7')}>Edit</button>
                <button disabled={busy === a.id} onClick={() => del([a.id])} style={{ ...btn('transparent', '#ff8a80'), marginLeft: 'auto' }}>Delete</button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
