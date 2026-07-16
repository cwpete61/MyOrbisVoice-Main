'use client'

/**
 * MyOrbisWebinar — detail with the 3 Phase-1 screens on real spine data:
 *   Command · Lead Intelligence · Sales Timeline.
 */

import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'

const TEAL = '#12a3a3'
const TEMP: Record<string, string> = { HOT: '#dc2626', WARM: '#d97706', COLD: '#6b7280' }

interface Detail { id: string; title: string; slug: string; status: string; _count?: { registrants: number } }
interface Command {
  registrants: number; attended: number; booked: number; purchased: number; ctaClicks: number
  questions: number; temp: { HOT: number; WARM: number; COLD: number }; avgScore: number; attendanceRate: number
}
interface Lead { personId: string; name: string | null; email: string | null; phone: string | null; score: number; intent: number; attention: number; temp: string }
interface TimelineEvent { id: string; type: string; source: string; metaJson: Record<string, unknown> | null; ts: string; webinarId: string | null }
interface Timeline { person: { fullName: string | null; email: string | null; ambiguousFlag: boolean } | null; events: TimelineEvent[]; score: { score: number; temp: string } | null }

type Tab = 'command' | 'leads' | 'timeline'

export default function WebinarDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [tab, setTab] = useState<Tab>('command')
  const [command, setCommand] = useState<Command | null>(null)
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const [d, c, l] = await Promise.all([
        apiFetch<Detail>(`/api/admin/webinars/${id}`),
        apiFetch<Command>(`/api/admin/webinars/${id}/command`),
        apiFetch<Lead[]>(`/api/admin/webinars/${id}/leads`),
      ])
      setDetail(d); setCommand(c); setLeads(l)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }, [id])
  useEffect(() => { void load() }, [load])

  async function openTimeline(personId: string, name: string) {
    setPerson({ id: personId, name }); setTab('timeline'); setTimeline(null)
    try { setTimeline(await apiFetch<Timeline>(`/api/admin/webinars/person/${personId}/timeline?webinarId=${id}`)) }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '8px 4px' }}>
      <Link href="/admin/webinars" style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 10 }}>← Back to webinars</Link>
      <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{detail?.title ?? 'Webinar'}</h1>
      {detail?.status === 'PUBLISHED' && (
        <a href={`/webinar/${detail.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: TEAL }}>/webinar/{detail.slug} ↗</a>
      )}
      {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', margin: '12px 0', fontSize: 13, color: '#991b1b' }}>{err}</div>}

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', margin: '16px 0' }}>
        {([['command', 'Command'], ['leads', 'Lead Intelligence'], ['timeline', 'Sales Timeline']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)', borderBottom: `2px solid ${tab === t ? TEAL : 'transparent'}`, marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'command' && command && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 }}>
            <Stat label="Registrants" value={command.registrants} />
            <Stat label="Attended" value={command.attended} sub={`${command.attendanceRate}%`} />
            <Stat label="Booked" value={command.booked} highlight />
            <Stat label="Purchased" value={command.purchased} highlight />
            <Stat label="CTA clicks" value={command.ctaClicks} />
            <Stat label="Questions" value={command.questions} />
          </div>
          <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Lead temperature · avg score {command.avgScore}</div>
            <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
              {(['HOT', 'WARM', 'COLD'] as const).map(k => {
                const total = command.temp.HOT + command.temp.WARM + command.temp.COLD || 1
                return <div key={k} title={`${k}: ${command.temp[k]}`} style={{ width: `${(command.temp[k] / total) * 100}%`, background: TEMP[k] }} />
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              {(['HOT', 'WARM', 'COLD'] as const).map(k => <span key={k}><span style={{ color: TEMP[k], fontWeight: 700 }}>●</span> {k} {command.temp[k]}</span>)}
            </div>
          </div>
          {command.registrants === 0 && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 12 }}>No registrants yet — share the registration link and metrics fill in as people engage.</p>}
        </div>
      )}

      {tab === 'leads' && (
        <div>
          {leads && leads.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No scored leads yet.</p>}
          {leads?.map(l => (
            <button key={l.personId} onClick={() => openTimeline(l.personId, l.name ?? l.email ?? 'Lead')}
              style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--surface-raised)', cursor: 'pointer', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', background: TEMP[l.temp], borderRadius: 8, padding: '4px 9px', minWidth: 40, textAlign: 'center' }}>{l.score}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{l.name ?? l.email ?? 'Unknown'}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)' }}>{l.email}{l.phone ? ` · ${l.phone}` : ''}</span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>intent {l.intent} · attention {l.attention}</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: TEMP[l.temp] }}>{l.temp}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'timeline' && (
        <div>
          {!person && <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Pick a lead in <strong>Lead Intelligence</strong> to see their full journey.</p>}
          {person && !timeline && <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading {person.name}…</p>}
          {timeline?.person && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{timeline.person.fullName ?? timeline.person.email}</span>
                {timeline.score && <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: TEMP[timeline.score.temp] }}>{timeline.score.temp} · {timeline.score.score}</span>}
                {timeline.person.ambiguousFlag && <span title="email and phone resolved to different people — not auto-merged" style={{ fontSize: 11, color: '#d97706' }}>⚠ ambiguous identity</span>}
              </div>
              <div style={{ borderLeft: '2px solid var(--border-subtle)', paddingLeft: 16, display: 'grid', gap: 12 }}>
                {timeline.events.map(ev => (
                  <div key={ev.id} style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: -22, top: 3, width: 9, height: 9, borderRadius: 999, background: TEAL, border: '2px solid var(--surface-app)' }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{ev.type.replaceAll('_', ' ').toLowerCase()}
                      {ev.source !== 'WEBINAR' && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 6 }}>via {ev.source}</span>}
                    </div>
                    {ev.metaJson && Object.keys(ev.metaJson).length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{Object.entries(ev.metaJson).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(ev.ts).toLocaleString()}</div>
                  </div>
                ))}
                {timeline.events.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No events logged.</p>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, highlight }: { label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <div style={{ background: 'var(--surface-raised)', border: `1px solid ${highlight ? TEAL : 'var(--border-subtle)'}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: highlight ? TEAL : 'var(--text-primary)' }}>{value.toLocaleString()}{sub && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 6 }}>{sub}</span>}</div>
    </div>
  )
}
