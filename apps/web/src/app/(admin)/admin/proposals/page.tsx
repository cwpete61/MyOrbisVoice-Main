'use client'
/* Admin: Proposals — full proposals auto-drafted for accepted agent leads.
 * Recommended tier, pricing (per-seat for teams), an ROI projection from their
 * own numbers, and onboarding steps. Editable summary + status (draft → sent). */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'

type Proposal = {
  id: string; tier: string; status: string; summary?: string
  pricingJson: { plan: string; monthly: number; seats?: number; perSeat?: number }
  roiJson: { missedCallsMo: number; avgPrice: number; gciPct: number; recoveredMo: number }
  onboardingJson: string[]
  application: { fullName: string; email: string; type: string; market?: string; score: number }
  createdAt: string
}

const money = (n: number) => '$' + Math.round(n).toLocaleString()

export default function ProposalsPage() {
  const [rows, setRows] = useState<Proposal[]>([])
  const [edit, setEdit] = useState<string | null>(null)
  const [draftSummary, setDraftSummary] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  async function load() { try { setRows(await apiFetch<Proposal[]>('/api/admin/agent-proposals')) } catch { /* ignore */ } }
  useEffect(() => { load() }, [])

  async function save(id: string, data: Record<string, unknown>) {
    setBusy(id)
    try { await apiFetch(`/api/admin/agent-proposals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); setEdit(null); await load() }
    catch { /* ignore */ } finally { setBusy(null) }
  }

  const card = { background: 'var(--surface-1,#0f1c30)', border: '1px solid var(--border,#22344f)', borderRadius: 14, padding: 20, marginBottom: 14 } as const
  const pill = (bg: string) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: bg + '22', color: bg, border: `1px solid ${bg}55` }) as const
  const stColor: Record<string, string> = { DRAFT: '#ffb347', SENT: '#1fc3c3', ACCEPTED: '#34c759', DECLINED: '#ff5c5c' }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Proposals</h1>
        <Link href="/admin/agent-qualifier" style={{ marginLeft: 'auto', fontSize: 14, color: '#1fc3c3', fontWeight: 700 }}>← Agent Qualifier</Link>
      </div>
      <p style={{ color: 'var(--text-secondary,#9fb0c7)', marginTop: 4, fontSize: 14 }}>Auto-drafted when you accept a lead. Edit the summary, then mark it sent.</p>

      {rows.length === 0 && <p style={{ color: '#9fb0c7' }}>No proposals yet — accept a qualified lead to draft one.</p>}

      {rows.map(p => (
        <div key={p.id} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 17 }}>{p.application.fullName}</b>
            <span style={pill(p.application.type === 'TEAM' ? '#5fc46a' : '#1fc3c3')}>{p.application.type === 'TEAM' ? 'Team / Broker' : 'Individual'}</span>
            <span style={pill('#8fe0e0')}>{p.tier}</span>
            <span style={pill(stColor[p.status] ?? '#9fb0c7')}>{p.status}</span>
            <span style={{ marginLeft: 'auto', color: '#7a8aa0', fontSize: 13 }}>{p.application.email}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '16px 0' }}>
            <div style={{ background: '#0c1626', border: '1px solid #22344f', borderRadius: 10, padding: 14 }}>
              <div style={{ color: '#7a8aa0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Pricing</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#e8eef7' }}>{money(p.pricingJson.monthly)}<span style={{ fontSize: 14, color: '#9fb0c7', fontWeight: 500 }}>/mo</span></div>
              <div style={{ color: '#9fb0c7', fontSize: 13, marginTop: 4 }}>
                {p.pricingJson.plan}{p.pricingJson.seats ? ` · ${p.pricingJson.seats} seats × ${money(p.pricingJson.perSeat ?? 0)}` : ''}
              </div>
            </div>
            <div style={{ background: '#0c1626', border: '1px solid #22344f', borderRadius: 10, padding: 14 }}>
              <div style={{ color: '#7a8aa0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>ROI projection</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#34c759' }}>{money(p.roiJson.recoveredMo)}<span style={{ fontSize: 14, color: '#9fb0c7', fontWeight: 500 }}>/mo</span></div>
              <div style={{ color: '#9fb0c7', fontSize: 13, marginTop: 4 }}>~{p.roiJson.missedCallsMo} missed calls/mo × {money(p.roiJson.avgPrice)} × {p.roiJson.gciPct}%</div>
            </div>
          </div>

          <div style={{ color: '#7a8aa0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>Onboarding</div>
          <ol style={{ margin: '0 0 14px', paddingLeft: 20, color: '#c9d6e6', fontSize: 14 }}>
            {p.onboardingJson.map((s, i) => <li key={i} style={{ margin: '3px 0' }}>{s}</li>)}
          </ol>

          <div style={{ color: '#7a8aa0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>Summary</div>
          {edit === p.id ? (
            <>
              <textarea value={draftSummary} onChange={e => setDraftSummary(e.target.value)} rows={4}
                style={{ width: '100%', background: '#0c1626', border: '1px solid #22344f', color: '#e8eef7', borderRadius: 10, padding: 12, fontSize: 14 }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button disabled={busy === p.id} onClick={() => save(p.id, { summary: draftSummary })} style={{ padding: '8px 16px', borderRadius: 9, border: 0, cursor: 'pointer', fontWeight: 700, background: '#1fc3c3', color: '#03201f' }}>Save</button>
                <button onClick={() => setEdit(null)} style={{ padding: '8px 16px', borderRadius: 9, cursor: 'pointer', background: 'transparent', color: '#9fb0c7', border: '1px solid #22344f' }}>Cancel</button>
              </div>
            </>
          ) : (
            <p style={{ color: '#c9d6e6', fontSize: 14, lineHeight: 1.5, margin: '0 0 12px' }}>{p.summary}</p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {edit !== p.id && <button onClick={() => { setEdit(p.id); setDraftSummary(p.summary ?? '') }} style={{ padding: '8px 14px', borderRadius: 9, cursor: 'pointer', background: 'transparent', color: '#9fb0c7', border: '1px solid #22344f', fontWeight: 600 }}>Edit summary</button>}
            {p.status === 'DRAFT' && <button disabled={busy === p.id} onClick={() => save(p.id, { status: 'SENT' })} style={{ padding: '8px 16px', borderRadius: 9, border: 0, cursor: 'pointer', fontWeight: 700, background: '#1fc3c3', color: '#03201f' }}>Mark sent</button>}
            {p.status === 'SENT' && (
              <>
                <button disabled={busy === p.id} onClick={() => save(p.id, { status: 'ACCEPTED' })} style={{ padding: '8px 16px', borderRadius: 9, border: 0, cursor: 'pointer', fontWeight: 700, background: '#34c759', color: '#04210f' }}>Mark accepted</button>
                <button disabled={busy === p.id} onClick={() => save(p.id, { status: 'DECLINED' })} style={{ padding: '8px 14px', borderRadius: 9, cursor: 'pointer', background: 'transparent', color: '#ff8a80', border: '1px solid #ff5c5c55', fontWeight: 600 }}>Declined</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
