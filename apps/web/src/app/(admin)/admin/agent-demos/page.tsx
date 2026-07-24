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
  videoStatus?: string; videoUrl?: string | null
  stages?: { talked: boolean; contact: boolean; qualified: boolean; booked: boolean }
}

const TIER_LABEL: Record<string, string> = { '297': 'Solo Capture ($297/mo)', '497': 'Solo Power ($497/mo)' }
const statusStyle = (s: string) =>
  s === 'READY'      ? { color: 'oklch(55% 0.15 150)', border: 'oklch(55% 0.15 150)' }
  : s === 'GENERATING' ? { color: 'oklch(60% 0.14 75)', border: 'oklch(60% 0.14 75)' }
  : s === 'SENT'       ? { color: TEAL, border: TEAL }
  : s === 'CLAIMED'    ? { color: 'oklch(55% 0.16 145)', border: 'oklch(55% 0.16 145)' }
  : { color: 'var(--text-tertiary)', border: 'var(--border-subtle)' }

interface QaCall {
  conversationId: string; agentName: string; micrositeSlug: string | null; createdAt: string
  durationSecs: number; hasRecording: boolean; recordingToken: string | null; score: number
  flags: { code: string; label: string; severity: string; regression: boolean }[]; regressions: string[]
  tokens: number | null; promptTokens: number | null; costUsd: number | null
}
// Call-QA panel — automated per-call anomaly/quality tracking with regression flags.
function QaPanel() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<{ calls: QaCall[]; regressionTally: Record<string, number>; spend?: { totalCostUsd: number; callsWithUsage: number; callsTotal: number } } | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  async function load() {
    setBusy(true)
    setLoadErr(null)
    // Never swallow the error — a silent catch here renders an empty box and
    // makes the panel look "broken" with zero signal about why.
    try { setData(await apiFetch<{ calls: QaCall[]; regressionTally: Record<string, number>; spend?: { totalCostUsd: number; callsWithUsage: number; callsTotal: number } }>('/api/admin/agent-demos/call-qa')) }
    catch (e) { setLoadErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  useEffect(() => { if (open && !data) void load() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const scoreColor = (s: number) => (s >= 85 ? '#16a34a' : s >= 60 ? '#d97706' : '#dc2626')
  return (
    <div style={{ marginBottom: 20, border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'var(--surface-raised)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
        {open ? '▾' : '▸'} Call QA — anomaly &amp; quality tracking{data ? ` · ${data.calls.length} analyzed calls` : ''}
      </button>
      {open && (
        <div style={{ padding: 16 }}>
          {busy && !data && <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</div>}
          {loadErr && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#991b1b' }}>
              Failed to load Call QA: <strong>{loadErr}</strong>
              <button onClick={load} style={{ marginLeft: 10, background: 'none', border: 'none', color: '#991b1b', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}>retry</button>
            </div>
          )}
          {data && Object.keys(data.regressionTally).length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#991b1b' }}>
              ⚠ Regressions in recent calls: {Object.entries(data.regressionTally).map(([k, v]) => `${k} (${v})`).join(' · ')}
            </div>
          )}
          {data?.spend && (
            <div style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
              💸 Gemini spend on these calls: <strong style={{ color: 'var(--text-primary)' }}>${data.spend.totalCostUsd.toFixed(4)}</strong>
              {' '}· measured on {data.spend.callsWithUsage}/{data.spend.callsTotal} calls
              {data.spend.callsWithUsage < data.spend.callsTotal && <span style={{ color: 'var(--text-tertiary)' }}> (older calls predate token logging)</span>}
              <span style={{ color: 'var(--text-tertiary)' }}> · cost is an estimate — verify rates against Google&apos;s pricing</span>
            </div>
          )}
          {data && data.calls.length === 0 && <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No analyzed calls yet.</div>}
          {data && data.calls.map(c => (
            <div key={c.conversationId} style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 0' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: scoreColor(c.score), borderRadius: 6, padding: '2px 8px', minWidth: 34, textAlign: 'center' }}>{c.score}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.agentName} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>· {new Date(c.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {c.durationSecs}s
                    {c.costUsd != null && (
                      <> · <span title={`${c.tokens?.toLocaleString()} tokens (${c.promptTokens?.toLocaleString()} prompt)`} style={{ color: c.costUsd >= 0.5 ? '#dc2626' : 'var(--text-tertiary)', fontWeight: 600 }}>
                        ${c.costUsd.toFixed(3)} · {((c.tokens ?? 0) / 1000).toFixed(0)}k tok
                      </span></>
                    )}
                  </span></div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {c.flags.length === 0 && <span style={{ fontSize: 12, color: '#16a34a' }}>clean ✅</span>}
                    {c.flags.map((f, i) => (
                      <span key={i} title={f.label}
                        style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: f.regression ? '#fef2f2' : 'var(--surface-app)', color: f.regression ? '#dc2626' : 'var(--text-secondary)', border: `1px solid ${f.regression ? '#fecaca' : 'var(--border-subtle)'}` }}>
                        {f.regression ? '⚠ ' : ''}{f.code}
                      </span>
                    ))}
                  </div>
                </div>
                {c.hasRecording && c.micrositeSlug && (
                  <button onClick={() => setPlaying(p => (p === c.conversationId ? null : c.conversationId))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: TEAL, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                    {playing === c.conversationId ? '▾ hide recording' : '▶ recording'}
                  </button>
                )}
              </div>
              {playing === c.conversationId && c.hasRecording && c.micrositeSlug && (
                <audio controls autoPlay preload="none" crossOrigin="anonymous"
                  src={`https://api.myorbisagents.com/api/public/agent-demo/${c.micrositeSlug}/recording/${c.conversationId}${c.recordingToken ? `?t=${encodeURIComponent(c.recordingToken)}` : ''}`}
                  style={{ width: '100%', marginTop: 8, height: 38 }} />
              )}
              <CallReviewBlock conversationId={c.conversationId} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Learned prompt rules (Phase 2 apply loop) ────────────────────────────────
// Approving a finding drafts a rule here. PUBLISHING is the only thing that puts
// text into Orby's live prompt — and it's always a human. Retire = instant rollback.
interface PromptRule {
  id: string; category: string; text: string
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED'
  sourceConversationId: string | null
  createdAt: string; activatedAt: string | null
}
const RULE_STATUS: Record<PromptRule['status'], { bg: string; fg: string; bd: string }> = {
  DRAFT:   { bg: '#faf5ff', fg: '#7c3aed', bd: '#e9d5ff' },
  ACTIVE:  { bg: '#f0fdf4', fg: '#16a34a', bd: '#bbf7d0' },
  RETIRED: { bg: 'var(--surface-app)', fg: 'var(--text-tertiary)', bd: 'var(--border-subtle)' },
}

// Preview + pick copy — renders all 4 variants with the agent's real listings,
// lets you read them, then send the one you choose.
interface PreviewVariant { variant: string; label: string; subject: string; html: string }
function EmailPreviewModal({ demoId, onClose, onSend }: { demoId: string; onClose: () => void; onSend: (variant: string) => void }) {
  const [locale, setLocale] = useState<'en' | 'es'>('en')
  const [data, setData] = useState<{ variants: PreviewVariant[] } | null>(null)
  const [pick, setPick] = useState('A')
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    setData(null)
    apiFetch<{ variants: PreviewVariant[] }>(`/api/admin/agent-demos/${demoId}/email-preview?locale=${locale}`)
      .then(setData).catch(e => setErr(e instanceof Error ? e.message : String(e)))
  }, [demoId, locale])
  const current = data?.variants.find(v => v.variant === pick)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-raised)', borderRadius: 12, width: 'min(720px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>Choose the demo email</strong>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setLocale(l => l === 'en' ? 'es' : 'en')} style={{ fontSize: 12, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer' }}>{locale === 'en' ? 'Español' : 'English'}</button>
            <button onClick={onClose} style={{ fontSize: 18, border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>×</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '10px 18px 0', flexWrap: 'wrap' }}>
          {data?.variants.map(v => (
            <button key={v.variant} onClick={() => setPick(v.variant)}
              style={{ padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${pick === v.variant ? TEAL : 'var(--border-subtle)'}`,
                background: pick === v.variant ? TEAL : 'transparent', color: pick === v.variant ? '#fff' : 'var(--text-secondary)' }}>
              {v.variant} · {v.label}
            </button>
          ))}
        </div>
        <div style={{ padding: 18, overflow: 'auto', flex: 1 }}>
          {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
          {!data && !err && <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</div>}
          {current && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>Subject</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>{current.subject}</div>
              <div style={{ background: '#fff', borderRadius: 8, padding: 16, color: '#111', border: '1px solid var(--border-subtle)' }} dangerouslySetInnerHTML={{ __html: current.html }} />
            </>
          )}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSend(pick)} disabled={!current} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: TEAL, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Send variant {pick}</button>
        </div>
      </div>
    </div>
  )
}

// A/B scoreboard — which demo-email argument earns the most claims.
interface AbVariant { variant: string; label: string; sent: number; claimed: number; claimRate: number | null }
function AbScoreboard() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<{ variants: AbVariant[]; totalSent: number; conclusive: boolean; note: string | null } | null>(null)
  const load = useCallback(async () => {
    try { setData(await apiFetch('/api/admin/agent-demos/ab-results')) } catch { /* ignore */ }
  }, [])
  useEffect(() => { if (open && !data) void load() }, [open, data, load])

  const best = data && data.conclusive
    ? data.variants.filter(v => v.claimRate != null).sort((a, b) => (b.claimRate! - a.claimRate!))[0]
    : null

  return (
    <div style={{ marginBottom: 20, border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'var(--surface-raised)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
        {open ? '▾' : '▸'} Demo email A/B — which argument wins{data ? ` · ${data.totalSent} sent` : ''}
      </button>
      {open && (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Claim rate per email argument. <strong>Auto</strong> sends round-robin so the test balances itself. Winner isn&apos;t called until ~15 sent per arm.
          </div>
          {data?.note && <div style={{ fontSize: 12, color: '#d97706', marginBottom: 10 }}>{data.note}</div>}
          {best && <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, marginBottom: 10 }}>Leading: {best.label} — {best.claimRate}% claim rate</div>}
          {data?.variants.map(v => (
            <div key={v.variant} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, width: 16, color: 'var(--text-primary)' }}>{v.variant}</span>
              <span style={{ fontSize: 13, flex: 1, color: 'var(--text-primary)' }}>{v.label}</span>
              <div style={{ flex: 2, height: 8, background: 'var(--surface-app)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                <div style={{ width: `${v.claimRate ?? 0}%`, height: '100%', background: TEAL }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 110, textAlign: 'right' }}>
                {v.claimRate != null ? `${v.claimRate}%` : '—'} · {v.claimed}/{v.sent}
              </span>
            </div>
          ))}
          {data && data.totalSent === 0 && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No demo emails sent yet. Send a few (Auto) and results appear here.</div>}
        </div>
      )}
    </div>
  )
}

function LearnedRulesPanel() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<{ rules: PromptRule[]; activeCount: number; maxActive: number } | null>(null)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadErr(null)
    try { setData(await apiFetch<{ rules: PromptRule[]; activeCount: number; maxActive: number }>('/api/admin/prompt-rules')) }
    catch (e) { setLoadErr(e instanceof Error ? e.message : String(e)) }
  }, [])
  useEffect(() => { if (open && !data) void load() }, [open, data, load])

  async function act(id: string, action: 'publish' | 'retire' | 'reopen') {
    if (action === 'publish' && !confirm('Publish this rule? It goes into Orby\'s live prompt on the very next call.')) return
    setBusy(true)
    try { await apiFetch(`/api/admin/prompt-rules/${id}/${action}`, { method: 'POST' }); await load() }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(false) }
  }
  async function saveEdit() {
    if (!editing) return
    setBusy(true)
    try { await apiFetch(`/api/admin/prompt-rules/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ text: editing.text }) }); setEditing(null); await load() }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(false) }
  }

  const drafts = data?.rules.filter(r => r.status === 'DRAFT') ?? []
  const active = data?.rules.filter(r => r.status === 'ACTIVE') ?? []
  const retired = data?.rules.filter(r => r.status === 'RETIRED') ?? []

  return (
    <div style={{ marginBottom: 20, border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'var(--surface-raised)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
        {open ? '▾' : '▸'} Learned rules — Orby prompt corrections
        {data ? ` · ${data.activeCount}/${data.maxActive} live${drafts.length ? ` · ${drafts.length} awaiting publish` : ''}` : ''}
      </button>
      {open && (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Approving a Call-QA finding drafts a rule here. <strong>Publishing</strong> is what puts it into Orby&apos;s live prompt — nothing goes live on its own. <strong>Retire</strong> removes it on the next call.
          </div>
          {loadErr && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#991b1b' }}>
              Failed to load rules: <strong>{loadErr}</strong>
              <button onClick={load} style={{ marginLeft: 10, background: 'none', border: 'none', color: '#991b1b', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}>retry</button>
            </div>
          )}

          {[{ label: `Awaiting publish (${drafts.length})`, list: drafts },
            { label: `Live in Orby's prompt (${active.length})`, list: active },
            { label: `Retired (${retired.length})`, list: retired }].map(({ label, list }) => (
            list.length === 0 ? null : (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 6 }}>{label}</div>
                {list.map(r => {
                  const s = RULE_STATUS[r.status]
                  return (
                    <div key={r.id} style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 0' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999, background: s.bg, color: s.fg, border: `1px solid ${s.bd}` }}>{r.status}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.category}</span>
                      </div>
                      {editing?.id === r.id ? (
                        <>
                          <textarea value={editing.text} onChange={e => setEditing({ id: r.id, text: e.target.value })} rows={3} maxLength={500}
                            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--surface-app)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit' }} />
                          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            <button onClick={saveEdit} disabled={busy} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: TEAL, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                            <button onClick={() => setEditing(null)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>{r.text}</div>
                      )}
                      {editing?.id !== r.id && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {r.status === 'DRAFT' && <>
                            <button onClick={() => setEditing({ id: r.id, text: r.text })} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => act(r.id, 'publish')} disabled={busy} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Publish to Orby</button>
                          </>}
                          {r.status === 'ACTIVE' && (
                            <button onClick={() => act(r.id, 'retire')} disabled={busy} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #fecaca', background: 'transparent', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Retire (rollback)</button>
                          )}
                          {r.status === 'RETIRED' && (
                            <button onClick={() => act(r.id, 'reopen')} disabled={busy} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Reopen as draft</button>
                          )}
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {r.activatedAt ? `live since ${new Date(r.activatedAt).toLocaleDateString()}` : `drafted ${new Date(r.createdAt).toLocaleDateString()}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          ))}
          {data && data.rules.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No rules yet. Approve a finding in Call QA to draft one.</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Multi-agent cross-model review for one call ──────────────────────────────
interface ReviewFinding {
  id: string; category: string; severity: string; title: string; detail: string | null; quote: string | null
  disposition: 'CONFIRMED' | 'REFUTED' | 'DISPUTED'; confidence: number
  votesJson: { raisedBy?: string[]; verifierModel?: string; refuted?: boolean; verifierReason?: string | null } | null
  proposedFix: string | null; reviewStatus: 'OPEN' | 'APPROVED' | 'REJECTED' | 'APPLIED'; reviewNotes: string | null
}
interface CallReview {
  id: string; status: string; score: number | null; confidence: number | null
  modelsUsed: string[]; summary: string | null; error: string | null; findings: ReviewFinding[]
}

const DISPO: Record<ReviewFinding['disposition'], { label: string; bg: string; fg: string; bd: string }> = {
  CONFIRMED: { label: 'confirmed',       bg: '#fef2f2', fg: '#dc2626', bd: '#fecaca' },
  DISPUTED:  { label: 'needs your call', bg: '#faf5ff', fg: '#7c3aed', bd: '#e9d5ff' },
  REFUTED:   { label: 'refuted',         bg: 'var(--surface-app)', fg: 'var(--text-tertiary)', bd: 'var(--border-subtle)' },
}

function CallReviewBlock({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false)
  const [review, setReview] = useState<CallReview | null>(null)
  const [busy, setBusy] = useState(false)
  const [showRefuted, setShowRefuted] = useState(false)

  async function fetchReview() {
    try { setReview(await apiFetch<CallReview | null>(`/api/admin/agent-demos/call-review/${conversationId}`)) } catch { /* ignore */ }
  }
  useEffect(() => { if (open && review === null) void fetchReview() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function run() {
    setBusy(true)
    try { setReview(await apiFetch<CallReview>(`/api/admin/agent-demos/call-review/${conversationId}`, { method: 'POST' })) }
    catch (e) { alert(e instanceof Error ? e.message : 'Review failed') }
    finally { setBusy(false) }
  }
  async function decide(id: string, status: 'APPROVED' | 'REJECTED') {
    try {
      const updated = await apiFetch<ReviewFinding>(`/api/admin/agent-demos/call-review/finding/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setReview(r => r ? { ...r, findings: r.findings.map(f => f.id === id ? updated : f) } : r)
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
  }

  const visible = review?.findings.filter(f => showRefuted || f.disposition !== 'REFUTED') ?? []
  const refutedCount = review?.findings.filter(f => f.disposition === 'REFUTED').length ?? 0

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: TEAL, fontWeight: 600 }}>
        {open ? '▾' : '▸'} Multi-agent review{review ? ` · ${review.status === 'DONE' ? `${review.findings.filter(f => f.disposition !== 'REFUTED').length} findings` : review.status.toLowerCase()}` : ''}
      </button>
      {open && (
        <div style={{ marginTop: 8, padding: 12, background: 'var(--surface-app)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          {!review && (
            <button onClick={run} disabled={busy}
              style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: TEAL, color: '#fff', fontWeight: 600, fontSize: 12, cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? 'Analyzing… (cross-model panel, ~15s)' : 'Run cross-model review'}
            </button>
          )}
          {review?.status === 'FAILED' && <div style={{ fontSize: 12, color: '#dc2626' }}>Review failed: {review.error}</div>}
          {review && review.status === 'DONE' && (
            <>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                <span>Panel: <strong style={{ color: 'var(--text-primary)' }}>{review.modelsUsed.join(' + ') || '—'}</strong></span>
                {review.score != null && <span>Quality <strong style={{ color: 'var(--text-primary)' }}>{review.score}</strong></span>}
                {review.confidence != null && <span>Agreement <strong style={{ color: 'var(--text-primary)' }}>{review.confidence}%</strong></span>}
                <button onClick={run} disabled={busy} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: TEAL, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>{busy ? '…' : 're-run'}</button>
              </div>
              {visible.length === 0 && <div style={{ fontSize: 12, color: '#16a34a' }}>Panel found nothing actionable — clean call ✅</div>}
              {visible.map(f => {
                const d = DISPO[f.disposition]
                return (
                  <div key={f.id} style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 0' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999, background: d.bg, color: d.fg, border: `1px solid ${d.bd}` }}>{d.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{f.category} · {f.severity} · {f.confidence}%</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{f.title}</span>
                    </div>
                    {f.detail && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.detail}</div>}
                    {f.quote && <blockquote style={{ margin: '4px 0', padding: '6px 10px', borderLeft: '3px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>“{f.quote}”</blockquote>}
                    {f.votesJson && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                        raised by {(f.votesJson.raisedBy ?? []).join(', ') || '—'}
                        {f.votesJson.verifierModel && <> · verified by {f.votesJson.verifierModel}{f.votesJson.verifierReason ? `: ${f.votesJson.verifierReason}` : ''}</>}
                      </div>
                    )}
                    {f.proposedFix && (
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>
                        <strong>Proposed fix:</strong> {f.proposedFix}
                      </div>
                    )}
                    {f.reviewStatus === 'OPEN' ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => decide(f.id, 'APPROVED')} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Approve fix</button>
                        <button onClick={() => decide(f.id, 'REJECTED')} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Reject</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 600, color: f.reviewStatus === 'APPROVED' ? '#16a34a' : 'var(--text-tertiary)' }}>
                        {f.reviewStatus === 'APPROVED' ? '✓ approved' : f.reviewStatus === 'APPLIED' ? '✓ applied' : '✕ rejected'}
                      </span>
                    )}
                  </div>
                )
              })}
              {refutedCount > 0 && (
                <button onClick={() => setShowRefuted(s => !s)} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}>
                  {showRefuted ? 'hide' : 'show'} {refutedCount} refuted (filtered by the panel)
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

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
  const [edit, setEdit] = useState<{ id: string; agentName: string; brokerage: string; market: string; agentEmail: string; agentPhone: string } | null>(null)
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

  // Variant per row: 'auto' (round-robin, the default that runs the A/B itself) or a
  // forced A/B/C/D. Nothing to pass = auto.
  const [sendVar, setSendVar] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<string | null>(null) // demo id whose preview modal is open
  async function send(id: string, forceVariant?: string) {
    const v = forceVariant ?? sendVar[id]
    const body = v && v !== 'auto' ? JSON.stringify({ variant: v }) : undefined
    try { await apiFetch(`/api/admin/agent-demos/${id}/send`, { method: 'POST', body }); setPreview(null); await load() }
    catch (e) { setErr((e as Error).message || 'Send failed.') }
  }
  async function genVideo(id: string) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, videoStatus: 'GENERATING' } : r))
    try { await apiFetch(`/api/admin/agent-demos/${id}/generate-video`, { method: 'POST' }); await load() }
    catch (e) { setErr((e as Error).message || 'Video generation failed.'); await load() }
  }
  async function saveEdit() {
    if (!edit) return
    if (edit.agentName.trim().length < 2 || edit.market.trim().length < 2 || !edit.agentEmail.includes('@')) {
      setErr('Agent name, market, and a valid email are required.'); return
    }
    try {
      await apiFetch(`/api/admin/agent-demos/${edit.id}`, { method: 'PATCH', body: JSON.stringify({
        agentName: edit.agentName.trim(), brokerage: edit.brokerage.trim(), market: edit.market.trim(),
        agentEmail: edit.agentEmail.trim(), agentPhone: edit.agentPhone.trim(),
      }) })
      setEdit(null); await load()
    } catch (e) { setErr((e as Error).message || 'Update failed.') }
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
  async function bulkSend() {
    if (!selected.size) return
    if (!window.confirm(`Send the demo email to ${selected.size} agent(s)?`)) return
    const ids = [...selected]
    setImportMsg(''); setImportBusy(true)
    try {
      const r = await apiFetch<{ sentCount: number; failedCount: number; failed: { id: string; reason: string }[] }>(
        '/api/admin/agent-demos/bulk-send', { method: 'POST', body: JSON.stringify({ ids }) })
      const skipped = r.failed.length ? ` · ${r.failedCount} skipped` : ''
      setImportMsg(`Sent ${r.sentCount} demo email${r.sentCount === 1 ? '' : 's'}${skipped}`)
      setSelected(new Set())
    } catch (e) {
      setErr((e as Error).message || 'Bulk send failed.')
    } finally { setImportBusy(false); await load() }
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
      {preview && <EmailPreviewModal demoId={preview} onClose={() => setPreview(null)} onSend={(v) => send(preview, v)} />}
      <QaPanel />
      <AbScoreboard />
      <LearnedRulesPanel />
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
            <button onClick={bulkSend} disabled={importBusy}
              style={{ padding: '5px 12px', borderRadius: 6, background: TEAL, color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Send selected
            </button>
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
                      {r.stages && (
                        <div style={{ fontSize: 11, marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 10, color: 'var(--text-secondary)' }}>
                          <span>{r.stages.talked ? '✅' : '⬜️'} Talked to Orby</span>
                          <span>{r.stages.contact ? '✅' : '⬜️'} Left contact info</span>
                          <span>{r.stages.qualified ? '✅' : '⬜️'} Qualified</span>
                          <span>{r.stages.booked ? '✅' : '⬜️'} Booked a showing</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: st.color, border: `1px solid ${st.border}` }}>{r.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
                  <span>Tier: <strong style={{ color: 'var(--text-primary)' }}>{TIER_LABEL[r.recommendedTier] ?? r.recommendedTier}</strong></span>
                  <a href={micrositeUrl(r.micrositeSlug)} target="_blank" rel="noreferrer" style={{ color: TEAL }}>Preview microsite →</a>
                  {r.status === 'CLAIMED' ? (
                    <span style={{ opacity: 0.7 }}>claimed 🎉</span>
                  ) : r.status === 'GENERATING' ? (
                    <span style={{ opacity: 0.6 }}>enriching…</span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <select value={sendVar[r.id] ?? 'auto'} onChange={e => setSendVar(s => ({ ...s, [r.id]: e.target.value }))}
                        title="Which email argument to send (Auto = round-robin A/B/C)"
                        style={{ fontSize: 11, border: '1px solid var(--border-subtle)', borderRadius: 5, padding: '1px 4px', background: 'var(--surface-app)', color: 'var(--text-secondary)' }}>
                        <option value="auto">Auto A/B/C/D</option>
                        <option value="A">A · Assistant anchor</option>
                        <option value="B">B · founder story</option>
                        <option value="C">C · 917 min</option>
                        <option value="D">D · what-if</option>
                      </select>
                      <button onClick={() => setPreview(r.id)} title="Read each version, then pick one to send"
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}>
                        preview
                      </button>
                      <button onClick={() => send(r.id)}
                        style={{ background: 'none', border: 'none', color: TEAL, cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}>
                        {r.status === 'SENT' ? 'Resend email' : 'Send email →'}
                      </button>
                    </span>
                  )}
                  {r.status === 'SENT' && (
                    <span style={{ opacity: 0.6 }} title={r.sentAt ? new Date(r.sentAt).toLocaleString() : undefined}>
                      sent{r.sentAt ? ` ${new Date(r.sentAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
                    </span>
                  )}
                  {r.status !== 'CLAIMED' && (
                    r.videoStatus === 'GENERATING' ? (
                      <span style={{ opacity: 0.6 }}>video…</span>
                    ) : r.videoStatus === 'READY' ? (
                      <a href={r.videoUrl || '#'} target="_blank" rel="noreferrer"
                        style={{ color: TEAL, fontSize: 12, textDecoration: 'underline' }}>video ✓</a>
                    ) : (
                      <button onClick={() => genVideo(r.id)}
                        style={{ background: 'none', border: 'none', color: TEAL, cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}>
                        {r.videoStatus === 'FAILED' ? 'Retry video' : 'Generate video'}
                      </button>
                    )
                  )}
                  {r.status !== 'CLAIMED' && (
                    <button onClick={() => setEdit({ id: r.id, agentName: r.agentName, brokerage: r.brokerage ?? '', market: r.market, agentEmail: r.agentEmail, agentPhone: r.agentPhone ?? '' })}
                      style={{ background: 'none', border: 'none', color: TEAL, cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}>
                      Edit
                    </button>
                  )}
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

      {edit && (
        <div onClick={() => setEdit(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: 24, width: 'min(460px, 100%)' }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Edit demo</h3>
            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              {([
                ['Agent name', 'agentName'], ['Brokerage', 'brokerage'], ['Market', 'market'],
                ['Email', 'agentEmail'], ['Phone', 'agentPhone'],
              ] as const).map(([label, key]) => (
                <label key={key} style={{ display: 'grid', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {label}
                  <input style={inp} value={edit[key]} onChange={e => setEdit({ ...edit, [key]: e.target.value })} />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setEdit(null)}
                style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={saveEdit}
                style={{ background: TEAL, border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: '#fff', fontWeight: 600 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
