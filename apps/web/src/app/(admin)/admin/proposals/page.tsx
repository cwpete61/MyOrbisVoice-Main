'use client'
/* Admin: Proposals — full proposals auto-drafted for accepted agent leads.
 * Recommended tier, pricing (per-seat for teams), an ROI projection from their
 * own numbers, and onboarding steps. Editable summary + status (draft → sent). */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'

type Proposal = {
  id: string; tier: string; status: string; publicToken?: string | null
  heading?: string; intro?: string; summary?: string; paymentLink?: string | null; paymentLinkMonthly?: string | null
  pricingJson: { plan: string; monthly: number; annual?: number | null; setup?: number; seats?: number; perSeat?: number }
  roiJson: { avgPrice: number; gciPct: number; commissionPerDeal: number; missedCallsMo: number; annualCost: number }
  onboardingJson?: string[]; whatOrbyJson?: string[]; nextStepsJson?: string[]
  linksJson?: { basicDemoUrl?: string; demoNumber?: string; micrositeUrl?: string }
  application: { fullName: string; email: string; type: string; market?: string; score: number }
  createdAt: string
}

const money = (n: number) => '$' + Math.round(n).toLocaleString()
const PROPOSAL_ORIGIN = process.env.NEXT_PUBLIC_WEB_ORIGIN ?? (typeof window !== 'undefined' ? window.location.origin : '')

export default function ProposalsPage() {
  const [rows, setRows] = useState<Proposal[]>([])
  const [edit, setEdit] = useState<string | null>(null)
  const [ef, setEf] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())

  async function load() { try { setRows(await apiFetch<Proposal[]>('/api/admin/agent-proposals')); setSel(new Set()) } catch { /* ignore */ } }
  useEffect(() => { load() }, [])

  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSelected = rows.length > 0 && sel.size === rows.length
  const selectAll = () => setSel(allSelected ? new Set() : new Set(rows.map(r => r.id)))
  async function del(ids: string[]) {
    if (!ids.length || !confirm(`Delete ${ids.length} proposal${ids.length > 1 ? 's' : ''}? This can't be undone.`)) return
    setBusy('bulk')
    try { await apiFetch('/api/admin/agent-proposals/delete', { method: 'POST', body: JSON.stringify({ ids }) }); await load() }
    catch { /* ignore */ } finally { setBusy(null) }
  }

  async function save(id: string, data: Record<string, unknown>) {
    setBusy(id)
    try { await apiFetch(`/api/admin/agent-proposals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); setEdit(null); await load() }
    catch { /* ignore */ } finally { setBusy(null) }
  }
  function startEdit(p: Proposal) {
    setEdit(p.id)
    setEf({
      heading: p.heading ?? '', intro: p.intro ?? '', summary: p.summary ?? '',
      tier: p.tier, monthly: String(p.pricingJson.monthly ?? ''), annual: String(p.pricingJson.annual ?? ''), setup: String(p.pricingJson.setup ?? ''),
      demoNumber: p.linksJson?.demoNumber ?? '', basicDemoUrl: p.linksJson?.basicDemoUrl ?? '', paymentLink: p.paymentLink ?? '', paymentLinkMonthly: p.paymentLinkMonthly ?? '',
      whatOrby: (p.whatOrbyJson ?? []).join('\n'), nextSteps: (p.nextStepsJson ?? []).join('\n'),
    })
  }
  async function saveEdit(p: Proposal) {
    const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean)
    const data: Record<string, unknown> = {
      heading: ef.heading, intro: ef.intro, summary: ef.summary, tier: ef.tier, paymentLink: ef.paymentLink || null, paymentLinkMonthly: ef.paymentLinkMonthly || null,
      pricingJson: { ...p.pricingJson, monthly: Number(ef.monthly) || p.pricingJson.monthly, annual: ef.annual ? Number(ef.annual) : null, setup: ef.setup ? Number(ef.setup) : p.pricingJson.setup },
      linksJson: { ...(p.linksJson ?? {}), demoNumber: ef.demoNumber, basicDemoUrl: ef.basicDemoUrl },
      whatOrbyJson: lines(ef.whatOrby ?? ''), nextStepsJson: lines(ef.nextSteps ?? ''),
    }
    await save(p.id, data)
  }
  async function sendProposal(p: Proposal) {
    if (!confirm(`Email this proposal to ${p.application.email} and mark it sent?`)) return
    setBusy(p.id)
    try { await apiFetch(`/api/admin/agent-proposals/${p.id}/send`, { method: 'POST' }); await load() }
    catch { alert('Send failed — check the email address and try again.') } finally { setBusy(null) }
  }
  function copyLink(p: Proposal) {
    if (!p.publicToken) return
    const url = `${PROPOSAL_ORIGIN}/proposal/${p.publicToken}`
    navigator.clipboard?.writeText(url).then(() => { setCopied(p.id); setTimeout(() => setCopied(null), 1500) }).catch(() => {})
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

      {rows.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0 14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary,#9fb0c7)', cursor: 'pointer' }}>
            <input type="checkbox" checked={allSelected} onChange={selectAll} /> Select all
          </label>
          {sel.size > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary,#9fb0c7)' }}>{sel.size} selected</span>
              <button disabled={busy === 'bulk'} onClick={() => del([...sel])} style={{ padding: '8px 14px', borderRadius: 9, border: 0, cursor: 'pointer', fontWeight: 700, fontSize: 13, background: '#c0392b', color: '#fff' }}>Delete selected</button>
            </div>
          )}
        </div>
      )}

      {rows.length === 0 && <p style={{ color: '#9fb0c7' }}>No proposals yet — accept a qualified lead to draft one.</p>}

      {rows.map(p => (
        <div key={p.id} style={{ ...card, outline: sel.has(p.id) ? '2px solid #1fc3c3' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
            <b style={{ fontSize: 17 }}>{p.application.fullName}</b>
            <span style={pill(p.application.type === 'TEAM' ? '#5fc46a' : '#1fc3c3')}>{p.application.type === 'TEAM' ? 'Team / Broker' : 'Individual'}</span>
            <span style={pill('#8fe0e0')}>{p.tier}</span>
            <span style={pill(stColor[p.status] ?? '#9fb0c7')}>{p.status}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
              {p.publicToken && <a href={`/proposal/${p.publicToken}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#1fc3c3', fontWeight: 700 }}>View ↗</a>}
              {p.publicToken && <button onClick={() => copyLink(p)} style={{ background: 'none', border: 0, color: copied === p.id ? '#34c759' : '#9fb0c7', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{copied === p.id ? 'Copied ✓' : 'Copy link'}</button>}
            </span>
          </div>
          <div style={{ color: '#7a8aa0', fontSize: 12.5, marginTop: 2 }}>{p.application.email}</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '16px 0' }}>
            <div style={{ background: '#0c1626', border: '1px solid #22344f', borderRadius: 10, padding: 14 }}>
              <div style={{ color: '#7a8aa0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Pricing</div>
              {typeof p.pricingJson.annual === 'number' ? (
                <>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#e8eef7' }}>{money(p.pricingJson.annual)}<span style={{ fontSize: 13, color: '#9fb0c7', fontWeight: 500 }}>/yr</span></div>
                  <div style={{ color: '#9fb0c7', fontSize: 13, marginTop: 4 }}>{p.pricingJson.plan} · 50% for life · or {money(p.pricingJson.monthly)}/mo</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#e8eef7' }}>{money(p.pricingJson.monthly)}<span style={{ fontSize: 13, color: '#9fb0c7', fontWeight: 500 }}>/mo</span></div>
                  <div style={{ color: '#9fb0c7', fontSize: 13, marginTop: 4 }}>{p.pricingJson.plan}{p.pricingJson.seats ? ` · ${p.pricingJson.seats} seats × ${money(p.pricingJson.perSeat ?? 0)}` : ''}</div>
                </>
              )}
            </div>
            <div style={{ background: '#0c1626', border: '1px solid #22344f', borderRadius: 10, padding: 14 }}>
              <div style={{ color: '#7a8aa0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Value</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#34c759' }}>{money(p.roiJson.commissionPerDeal)}<span style={{ fontSize: 13, color: '#9fb0c7', fontWeight: 500 }}>/deal</span></div>
              <div style={{ color: '#9fb0c7', fontSize: 13, marginTop: 4 }}>one saved deal covers ~{Math.max(1, Math.round(p.roiJson.commissionPerDeal / (p.roiJson.annualCost || 1)))} yr · ~{p.roiJson.missedCallsMo} calls/mo missed</div>
            </div>
          </div>

          {edit === p.id ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {([['heading', 'Heading'], ['intro', 'Intro'], ['tier', 'Plan / tier'], ['monthly', 'Monthly $'], ['annual', 'Annual $ (blank = none)'], ['setup', 'Setup $'], ['demoNumber', 'Demo phone'], ['basicDemoUrl', 'Basic demo URL'], ['paymentLink', 'Payment link — annual (Stripe)'], ['paymentLinkMonthly', 'Payment link — monthly (Stripe)']] as const).map(([k, lbl]) => (
                <label key={k} style={{ fontSize: 12, color: '#7a8aa0' }}>{lbl}<input value={ef[k] ?? ''} onChange={e => setEf(p2 => ({ ...p2, [k]: e.target.value }))} style={{ width: '100%', background: '#0c1626', border: '1px solid #22344f', color: '#e8eef7', borderRadius: 8, padding: '8px 10px', fontSize: 13, marginTop: 4 }} /></label>
              ))}
              {([['whatOrby', 'What Orby does (one per line)'], ['nextSteps', 'Next steps (one per line)'], ['summary', 'Summary']] as const).map(([k, lbl]) => (
                <label key={k} style={{ fontSize: 12, color: '#7a8aa0' }}>{lbl}<textarea value={ef[k] ?? ''} onChange={e => setEf(p2 => ({ ...p2, [k]: e.target.value }))} rows={k === 'summary' ? 3 : 4} style={{ width: '100%', background: '#0c1626', border: '1px solid #22344f', color: '#e8eef7', borderRadius: 8, padding: 10, fontSize: 13, marginTop: 4 }} /></label>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button disabled={busy === p.id} onClick={() => saveEdit(p)} style={{ padding: '8px 16px', borderRadius: 9, border: 0, cursor: 'pointer', fontWeight: 700, background: '#1fc3c3', color: '#03201f' }}>Save</button>
                <button onClick={() => setEdit(null)} style={{ padding: '8px 16px', borderRadius: 9, cursor: 'pointer', background: 'transparent', color: '#9fb0c7', border: '1px solid #22344f' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ color: '#7a8aa0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>Summary</div>
              <p style={{ color: '#c9d6e6', fontSize: 14, lineHeight: 1.5, margin: '0 0 12px' }}>{p.summary}</p>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {edit !== p.id && <button onClick={() => startEdit(p)} style={{ padding: '8px 14px', borderRadius: 9, cursor: 'pointer', background: 'transparent', color: '#9fb0c7', border: '1px solid #22344f', fontWeight: 600 }}>Edit</button>}
            {p.status === 'DRAFT' && <button disabled={busy === p.id} onClick={() => sendProposal(p)} style={{ padding: '8px 16px', borderRadius: 9, border: 0, cursor: 'pointer', fontWeight: 700, background: '#1fc3c3', color: '#03201f' }}>Email + mark sent</button>}
            {p.status === 'SENT' && (
              <>
                <button disabled={busy === p.id} onClick={() => save(p.id, { status: 'ACCEPTED' })} style={{ padding: '8px 16px', borderRadius: 9, border: 0, cursor: 'pointer', fontWeight: 700, background: '#34c759', color: '#04210f' }}>Mark accepted</button>
                <button disabled={busy === p.id} onClick={() => save(p.id, { status: 'DECLINED' })} style={{ padding: '8px 14px', borderRadius: 9, cursor: 'pointer', background: 'transparent', color: '#ff8a80', border: '1px solid #ff5c5c55', fontWeight: 600 }}>Declined</button>
              </>
            )}
            <button disabled={busy === p.id} onClick={() => del([p.id])} style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 9, cursor: 'pointer', background: 'transparent', color: '#ff8a80', border: '1px solid #ff5c5c55', fontWeight: 600 }}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}
