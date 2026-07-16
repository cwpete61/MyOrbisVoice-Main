'use client'

/**
 * MyOrbisWebinar — admin list + create. Admin-hosted webinars (platform tenant).
 * The 3 real screens live on the detail page. This is the entry.
 */

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/hooks/useApi'

const TEAL = '#12a3a3'

interface WebinarRow {
  id: string
  title: string
  slug: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  vertical: string | null
  createdAt: string
  _count?: { registrants: number; sessions: number }
}

const STATUS_COLORS: Record<WebinarRow['status'], { bg: string; fg: string; bd: string }> = {
  DRAFT:     { bg: '#faf5ff', fg: '#7c3aed', bd: '#e9d5ff' },
  PUBLISHED: { bg: '#f0fdf4', fg: '#16a34a', bd: '#bbf7d0' },
  ARCHIVED:  { bg: 'var(--surface-app)', fg: 'var(--text-tertiary)', bd: 'var(--border-subtle)' },
}

export default function WebinarsPage() {
  const [rows, setRows] = useState<WebinarRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setErr(null)
    try { setRows(await apiFetch<WebinarRow[]>('/api/webinars')) }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function publish(id: string, status: 'PUBLISHED' | 'DRAFT') {
    setBusy(true)
    try { await apiFetch(`/api/webinars/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load() }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(false) }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '8px 4px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Webinars</h1>
          <p style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 14, maxWidth: 640 }}>
            Async webinars measured by pipeline, not attendance. Create one, publish it, share the
            registration link — every registration, watch, poll, and CTA click lands on the spine and
            scores the lead.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {/* The "Find invite contacts" link to /admin/webinar-marketing was removed here:
              that's the platform-only outbound cold-email tool, which a tenant cannot open
              (its whole /api/admin namespace is requirePlatformAdmin). Linking to it from a
              tenant page would be a guaranteed 403. */}
          <button onClick={() => setShowForm(v => !v)}
            style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: showForm ? 'var(--surface-app)' : TEAL, color: showForm ? 'var(--text-primary)' : '#fff', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {showForm ? 'Cancel' : '+ New webinar'}
          </button>
        </div>
      </header>

      {showForm && <NewWebinarForm onCreated={() => { setShowForm(false); load() }} />}
      {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', margin: '12px 0', fontSize: 13, color: '#991b1b' }}>Failed to load: {err}</div>}

      {rows && rows.length === 0 && !showForm && (
        <div style={{ border: '1px dashed var(--border-subtle)', borderRadius: 12, padding: 32, textAlign: 'center', color: 'var(--text-secondary)', marginTop: 12 }}>
          No webinars yet. Click <strong>+ New webinar</strong> to start.
        </div>
      )}

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {rows?.map(w => {
          const s = STATUS_COLORS[w.status]
          return (
            <div key={w.id} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                    <Link href={`/webinars/${w.id}`} style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', textDecoration: 'none' }}>{w.title}</Link>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999, background: s.bg, color: s.fg, border: `1px solid ${s.bd}` }}>{w.status}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {w._count?.registrants ?? 0} registrants{w.vertical ? ` · ${w.vertical}` : ''}
                    {w.status === 'PUBLISHED' && (
                      <> · <a href={`/webinar/${w.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: TEAL }}>registration page ↗</a></>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Link href={`/webinars/${w.id}`} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Open</Link>
                  {w.status === 'DRAFT'
                    ? <button onClick={() => publish(w.id, 'PUBLISHED')} disabled={busy} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Publish</button>
                    : w.status === 'PUBLISHED'
                    ? <button onClick={() => publish(w.id, 'DRAFT')} disabled={busy} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Unpublish</button>
                    : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NewWebinarForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [titleEs, setTitleEs] = useState('')
  const [vertical, setVertical] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await apiFetch('/api/webinars', { method: 'POST', body: JSON.stringify({
        title, titleEs: titleEs || undefined, vertical: vertical || undefined, description: description || undefined,
      }) })
      onCreated()
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Failed') }
    finally { setBusy(false) }
  }

  const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--surface-app)', color: 'var(--text-primary)', fontSize: 14, width: '100%' }
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, display: 'block' }

  return (
    <form onSubmit={submit} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 18, marginTop: 12, display: 'grid', gap: 12 }}>
      <div><label style={label}>Title (English)</label><input style={input} value={title} onChange={e => setTitle(e.target.value)} required maxLength={160} placeholder="How to buy your first home in Decatur" /></div>
      <div><label style={label}>Título (Español) <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>— optional, falls back to English</span></label><input style={input} value={titleEs} onChange={e => setTitleEs(e.target.value)} maxLength={160} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={label}>Vertical <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>— optional</span></label><input style={input} value={vertical} onChange={e => setVertical(e.target.value)} maxLength={80} placeholder="real estate" /></div>
      </div>
      <div><label style={label}>Description <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>— optional</span></label><textarea style={{ ...input, fontFamily: 'inherit' }} rows={2} value={description} onChange={e => setDescription(e.target.value)} maxLength={4000} /></div>
      {err && <p style={{ color: '#dc2626', margin: 0, fontSize: 13 }}>{err}</p>}
      <button type="submit" disabled={busy || title.trim().length < 2} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: TEAL, color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: busy || title.trim().length < 2 ? 0.5 : 1, justifySelf: 'start' }}>
        {busy ? 'Creating…' : 'Create webinar'}
      </button>
    </form>
  )
}
