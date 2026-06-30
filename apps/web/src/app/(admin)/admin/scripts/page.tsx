'use client'

/**
 * Admin — Partner Script default templates.
 *
 * Global default scripts that partners can copy in Directory Leads → Scripts.
 * CRUD against /api/admin/scripts (read = support tier, writes = platform admin).
 * bodyHtml is sanitized server-side on save. Admin-facing → English only
 * (excluded from the i18n scanner).
 */

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { RichTextEditor } from '@/components/RichTextEditor'

const TEAL = 'oklch(55% 0.11 193)'

type Channel = 'call' | 'email' | 'sms'
interface Script { id: string; title: string; channel: Channel; bodyHtml: string; updatedAt: string }
interface Draft { id: string | null; title: string; channel: Channel; bodyHtml: string }

const CHANNEL_LABEL: Record<Channel, string> = { call: 'Call', email: 'Email', sms: 'SMS' }

export default function AdminScriptsPage() {
  const [list, setList] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setList(await apiFetch<Script[]>('/api/admin/scripts')) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function save() {
    if (!draft) return
    setSaving(true); setError('')
    try {
      const body = JSON.stringify({ title: draft.title, channel: draft.channel, bodyHtml: draft.bodyHtml })
      if (draft.id) await apiFetch(`/api/admin/scripts/${draft.id}`, { method: 'PUT', body })
      else await apiFetch('/api/admin/scripts', { method: 'POST', body })
      setDraft(null); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this default template? Partners who already copied it keep their copy.')) return
    setError('')
    try { await apiFetch(`/api/admin/scripts/${id}`, { method: 'DELETE' }); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to delete') }
  }

  const inputStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', color: 'var(--text-primary)', fontSize: 14 } as const

  return (
    <div style={{ padding: '24px 20px', maxWidth: 860 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Partner Scripts</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        Default script templates partners can copy in Directory Leads → Scripts.
      </p>

      {error && <div style={{ background: 'oklch(60% 0.18 25 / 0.12)', color: 'oklch(50% 0.18 25)', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {draft ? (
        <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Template title" style={{ ...inputStyle, flex: '1 1 220px' }} />
            <select value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value as Channel })} style={inputStyle} aria-label="Channel">
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
          <RichTextEditor value={draft.bodyHtml} onChange={(html) => setDraft({ ...draft, bodyHtml: html })} placeholder="Write the default script… tokens {business} {name} {link} are supported." />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={save} disabled={saving} style={{ background: TEAL, color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => setDraft(null)} style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({ id: null, title: '', channel: 'call', bodyHtml: '' })} style={{ background: TEAL, color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 18 }}>+ New default</button>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, padding: 24, textAlign: 'center' }}>Loading…</p>
      ) : list.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No default templates yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {list.map((s) => (
            <div key={s.id} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{s.title || 'Untitled'}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: TEAL, background: 'oklch(55% 0.11 193 / 0.12)', borderRadius: 5, padding: '2px 7px', marginTop: 4, display: 'inline-block' }}>{CHANNEL_LABEL[s.channel]}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setDraft({ id: s.id, title: s.title, channel: s.channel, bodyHtml: s.bodyHtml })} style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 7, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                <button onClick={() => remove(s.id)} style={{ background: 'var(--surface-overlay)', color: 'oklch(55% 0.18 25)', border: '1px solid var(--border-subtle)', borderRadius: 7, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
