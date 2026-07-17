'use client'

/**
 * MyOrbisWebinar — build it, then watch it work:
 *   Setup · Command · Lead Intelligence · Sales Timeline.
 *
 * Setup comes first on purpose. Until a webinar has a video and a CTA it cannot be
 * published, and the other three tabs are empty by definition — there is nothing to
 * command, no leads to score, no timeline to walk.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'

const TEAL = '#12a3a3'
const TEMP: Record<string, string> = { HOT: '#dc2626', WARM: '#d97706', COLD: '#6b7280' }

interface Detail {
  id: string; title: string; titleEs: string | null; slug: string; status: string
  description: string | null
  // Two halves of one fact — set together by the API from the pasted URL, never apart.
  videoProvider: 'YOUTUBE' | 'VIMEO' | null
  videoAssetRef: string | null
  ctaLabel: string | null; ctaLabelEs: string | null; ctaUrl: string | null
  resourceUrl: string | null
  _count?: { registrants: number }
}

/** Rebuild a watchable URL from the stored (provider, id) so the editor can show the
 *  tenant what is set. We never store their original URL — see api video.ts. */
function videoUrlOf(d: Detail): string {
  if (!d.videoProvider || !d.videoAssetRef) return ''
  return d.videoProvider === 'YOUTUBE'
    ? `https://youtu.be/${d.videoAssetRef}`
    : `https://vimeo.com/${d.videoAssetRef}`
}
interface Command {
  registrants: number; attended: number; booked: number; purchased: number; ctaClicks: number
  questions: number; temp: { HOT: number; WARM: number; COLD: number }; avgScore: number; attendanceRate: number
}
interface Lead { personId: string; name: string | null; email: string | null; phone: string | null; score: number; intent: number; attention: number; temp: string }
interface TimelineEvent { id: string; type: string; source: string; metaJson: Record<string, unknown> | null; ts: string; webinarId: string | null }
interface Timeline { person: { fullName: string | null; email: string | null; ambiguousFlag: boolean } | null; events: TimelineEvent[]; score: { score: number; temp: string } | null }

type Tab = 'setup' | 'command' | 'leads' | 'timeline'

export default function WebinarDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<Detail | null>(null)
  // Land on Setup while it's a draft (there's nothing else to look at), on Command once
  // it's live. Set after the first load, below.
  const [tab, setTab] = useState<Tab>('setup')
  const [command, setCommand] = useState<Command | null>(null)
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // A ref, not state: this is a one-shot latch read inside load(), and putting the
  // setTab call inside a state updater would fire it twice under Strict Mode.
  const landed = useRef(false)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const [d, c, l] = await Promise.all([
        apiFetch<Detail>(`/api/webinars/${id}`),
        apiFetch<Command>(`/api/webinars/${id}/command`),
        apiFetch<Lead[]>(`/api/webinars/${id}/leads`),
      ])
      setDetail(d); setCommand(c); setLeads(l)
      // Only on first load — reloading after a save must not yank the tab away.
      if (!landed.current) { landed.current = true; if (d.status === 'PUBLISHED') setTab('command') }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }, [id])
  useEffect(() => { void load() }, [load])

  async function openTimeline(personId: string, name: string) {
    setPerson({ id: personId, name }); setTab('timeline'); setTimeline(null)
    try { setTimeline(await apiFetch<Timeline>(`/api/webinars/person/${personId}/timeline?webinarId=${id}`)) }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '8px 4px' }}>
      <Link href="/webinars" style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 10 }}>← Back to webinars</Link>
      <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{detail?.title ?? 'Webinar'}</h1>
      {detail?.status === 'PUBLISHED' && (
        <a href={`/webinar/${detail.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: TEAL }}>/webinar/{detail.slug} ↗</a>
      )}
      {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', margin: '12px 0', fontSize: 13, color: '#991b1b' }}>{err}</div>}

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', margin: '16px 0' }}>
        {([['setup', 'Setup'], ['command', 'Command'], ['leads', 'Lead Intelligence'], ['timeline', 'Sales Timeline']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)', borderBottom: `2px solid ${tab === t ? TEAL : 'transparent'}`, marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'setup' && detail && <SetupPanel detail={detail} onSaved={load} />}

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

const fieldInput: React.CSSProperties = {
  padding: '9px 11px', borderRadius: 7, border: '1px solid var(--border-subtle)',
  background: 'var(--surface-app)', color: 'var(--text-primary)', fontSize: 14, width: '100%',
}
const fieldLabel: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, display: 'block' }
const hint: React.CSSProperties = { fontWeight: 400, color: 'var(--text-tertiary)' }

/**
 * The builder.
 *
 * Two fields here are the difference between a demo and a product:
 *   - the video, because without it the watch page is a play button over nothing
 *   - the CTA link, because CTA_CLICKED is what triggers the follow-up call
 * The API refuses to publish without both, so this panel says so up front rather than
 * letting the tenant discover it via a 422 on the Publish button.
 */
function SetupPanel({ detail, onSaved }: { detail: Detail; onSaved: () => Promise<void> }) {
  const [videoUrl, setVideoUrl] = useState(videoUrlOf(detail))
  const [ctaLabel, setCtaLabel] = useState(detail.ctaLabel ?? '')
  const [ctaLabelEs, setCtaLabelEs] = useState(detail.ctaLabelEs ?? '')
  const [ctaUrl, setCtaUrl] = useState(detail.ctaUrl ?? '')
  const [resourceUrl, setResourceUrl] = useState(detail.resourceUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save(alsoPublish: boolean) {
    setBusy(true); setErr(null); setSaved(false)
    try {
      await apiFetch(`/api/webinars/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          // Send '' rather than omitting so clearing a field actually clears it —
          // the API reads '' as "unset", undefined as "don't touch".
          videoUrl, ctaLabel, ctaLabelEs, ctaUrl, resourceUrl,
          ...(alsoPublish ? { status: 'PUBLISHED' } : {}),
        }),
      })
      setSaved(true)
      await onSaved()
    } catch (e) {
      // A failed publish still saved the edits (the API writes content, then checks,
      // then flips) — so the message is about publishing, not about losing work.
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  const ready = videoUrl.trim() !== '' && ctaUrl.trim() !== ''

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 620 }}>
      <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <label style={fieldLabel}>Video <span style={hint}>— YouTube or Vimeo</span></label>
          <input style={fieldInput} value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
                 placeholder="https://youtu.be/dQw4w9WgXcQ" />
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '5px 0 0' }}>
            Paste the link or the whole <strong>Share → Embed</strong> code — either works.
            Unlisted is fine: attendees never see the video page, only your player.
            Watch time is measured from real playback, so this is what scores your leads.
          </p>
        </div>

        <div>
          <label style={fieldLabel}>CTA link <span style={hint}>— where the button sends them</span></label>
          <input style={fieldInput} value={ctaUrl} onChange={e => setCtaUrl(e.target.value)}
                 placeholder="https://cal.com/you/intro-call" />
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '5px 0 0' }}>
            The one button that matters. Clicking it is what marks a lead as interested —
            and someone who clicks but never books is who the AI follow-up call chases.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={fieldLabel}>CTA text <span style={hint}>— optional</span></label>
            <input style={fieldInput} value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} maxLength={60} placeholder="Book a call" />
          </div>
          <div>
            <label style={fieldLabel}>CTA text (Español) <span style={hint}>— optional</span></label>
            <input style={fieldInput} value={ctaLabelEs} onChange={e => setCtaLabelEs(e.target.value)} maxLength={60} placeholder="Agenda una llamada" />
          </div>
        </div>

        <div>
          <label style={fieldLabel}>Lead magnet <span style={hint}>— optional</span></label>
          <input style={fieldInput} value={resourceUrl} onChange={e => setResourceUrl(e.target.value)}
                 placeholder="https://…/guide.pdf" />
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '5px 0 0' }}>
            Leave empty and the download button is hidden rather than shown doing nothing.
          </p>
        </div>

        {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#991b1b' }}>{err}</div>}
        {saved && !err && <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✓ Saved</div>}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => void save(false)} disabled={busy}
                  style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-app)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          {detail.status !== 'PUBLISHED' && (
            <button onClick={() => void save(true)} disabled={busy || !ready}
                    title={ready ? undefined : 'Add a video and a CTA link first'}
                    style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, cursor: ready ? 'pointer' : 'not-allowed', opacity: busy || !ready ? 0.5 : 1 }}>
              Save &amp; publish
            </button>
          )}
          {!ready && (
            <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
              Needs a video and a CTA link to go live.
            </span>
          )}
        </div>
      </div>

      {/* Show them what they built. Cheap, and it catches a wrong-video paste before a
          prospect does. */}
      {detail.videoProvider && detail.videoAssetRef && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Preview</div>
          <div style={{ aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
            <iframe
              src={detail.videoProvider === 'YOUTUBE'
                ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(detail.videoAssetRef)}?rel=0`
                : `https://player.vimeo.com/video/${encodeURIComponent(detail.videoAssetRef)}?dnt=1`}
              title="Preview" style={{ width: '100%', height: '100%', border: 0 }} allowFullScreen />
          </div>
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
