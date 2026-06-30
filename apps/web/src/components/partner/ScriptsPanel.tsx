'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'
import { RichTextEditor } from '@/components/RichTextEditor'

const TEAL = 'oklch(55% 0.11 193)'

type Channel = 'call' | 'email' | 'sms'
interface Script {
  id: string
  affiliateAccountId: string | null
  isDefault: boolean
  title: string
  channel: Channel
  bodyHtml: string
  sourceDefaultId: string | null
  updatedAt: string
}

interface Draft { id: string | null; title: string; channel: Channel; bodyHtml: string }

// Partner Scripts tab (Directory Leads → Scripts). Per-partner script library +
// read-only admin defaults to copy from. Rich-text body, channel-aware AI assist,
// open-in-new-window read view. CRUD against /api/partner/scripts.
export default function ScriptsPanel() {
  const t = useT()
  const [own, setOwn] = useState<Script[]>([])
  const [defaults, setDefaults] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [ai, setAi] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const channelLabel = (c: Channel) => t(`partnerScripts.channel_${c}`)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const d = await apiFetch<{ own: Script[]; defaults: Script[] }>('/api/partner/scripts')
      setOwn(d.own ?? []); setDefaults(d.defaults ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('partnerScripts.error'))
    } finally { setLoading(false) }
  }, [t])

  useEffect(() => { load() }, [load])

  const startNew = () => { setAi(''); setDraft({ id: null, title: '', channel: 'call', bodyHtml: '' }) }
  const startEdit = (s: Script) => { setAi(''); setDraft({ id: s.id, title: s.title, channel: s.channel, bodyHtml: s.bodyHtml }) }

  async function save() {
    if (!draft) return
    setSaving(true); setError('')
    try {
      const body = JSON.stringify({ title: draft.title, channel: draft.channel, bodyHtml: draft.bodyHtml })
      if (draft.id) await apiFetch(`/api/partner/scripts/${draft.id}`, { method: 'PUT', body })
      else await apiFetch('/api/partner/scripts', { method: 'POST', body })
      setDraft(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('partnerScripts.error'))
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!window.confirm(t('partnerScripts.deleteConfirm'))) return
    setError('')
    try { await apiFetch(`/api/partner/scripts/${id}`, { method: 'DELETE' }); await load() }
    catch (e) { setError(e instanceof Error ? e.message : t('partnerScripts.error')) }
  }

  async function copy(id: string) {
    setError('')
    try {
      const created = await apiFetch<Script>(`/api/partner/scripts/${id}/copy`, { method: 'POST' })
      await load()
      startEdit(created)
    } catch (e) { setError(e instanceof Error ? e.message : t('partnerScripts.error')) }
  }

  async function runAi() {
    if (!draft || !ai.trim()) return
    setAiLoading(true); setError('')
    try {
      const d = await apiFetch<{ title: string; bodyHtml: string }>('/api/partner/scripts/ai', {
        method: 'POST', body: JSON.stringify({ channel: draft.channel, instructions: ai.trim() }),
      })
      setDraft({ ...draft, title: draft.title || d.title, bodyHtml: d.bodyHtml })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('partnerScripts.aiError'))
    } finally { setAiLoading(false) }
  }

  const inputStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', color: 'var(--text-primary)', fontSize: 14 } as const

  return (
    <div>
      {error && <div style={{ background: 'oklch(60% 0.18 25 / 0.12)', color: 'oklch(50% 0.18 25)', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {/* Editor */}
      {draft ? (
        <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder={t('partnerScripts.titlePlaceholder')} style={{ ...inputStyle, flex: '1 1 220px' }} />
            <select value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value as Channel })} style={inputStyle} aria-label={t('partnerScripts.channelLabel')}>
              <option value="call">{channelLabel('call')}</option>
              <option value="email">{channelLabel('email')}</option>
              <option value="sms">{channelLabel('sms')}</option>
            </select>
          </div>

          {/* AI assist — channel-aware */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input value={ai} onChange={(e) => setAi(e.target.value)} placeholder={t('partnerScripts.aiPlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && runAi()} style={{ ...inputStyle, flex: '1 1 260px' }} />
            <button onClick={runAi} disabled={aiLoading || !ai.trim()}
              style={{ background: 'transparent', color: TEAL, border: `1px solid ${TEAL}`, borderRadius: 8, padding: '8px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: aiLoading || !ai.trim() ? 0.6 : 1 }}>
              {aiLoading ? t('partnerScripts.aiGenerating') : `✨ ${t('partnerScripts.aiGenerate')}`}
            </button>
          </div>

          <RichTextEditor value={draft.bodyHtml} onChange={(html) => setDraft({ ...draft, bodyHtml: html })} placeholder={t('partnerScripts.bodyPlaceholder')} />

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={save} disabled={saving}
              style={{ background: TEAL, color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? t('partnerScripts.saving') : t('partnerScripts.save')}
            </button>
            <button onClick={() => setDraft(null)}
              style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {t('partnerScripts.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={startNew}
          style={{ background: TEAL, color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 18 }}>
          + {t('partnerScripts.newScript')}
        </button>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center', padding: 24 }}>{t('partnerScripts.loading')}</p>
      ) : (
        <>
          {/* Your scripts */}
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 10px' }}>{t('partnerScripts.yourScripts')}</h2>
          {own.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 22 }}>{t('partnerScripts.empty')}</p>
          ) : (
            <div style={{ display: 'grid', gap: 8, marginBottom: 22 }}>
              {own.map((s) => <ScriptRow key={s.id} s={s} channelLabel={channelLabel} t={t}
                actions={<>
                  <RowBtn label={t('partnerScripts.edit')} onClick={() => startEdit(s)} />
                  <RowPopup label={t('partnerScripts.openWindow')} id={s.id} />
                  <RowBtn label={t('partnerScripts.delete')} onClick={() => remove(s.id)} danger />
                </>} />)}
            </div>
          )}

          {/* Default templates */}
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 10px' }}>{t('partnerScripts.defaults')}</h2>
          {defaults.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{t('partnerScripts.defaultsEmpty')}</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {defaults.map((s) => <ScriptRow key={s.id} s={s} channelLabel={channelLabel} t={t}
                actions={<>
                  <RowPopup label={t('partnerScripts.openWindow')} id={s.id} />
                  <RowBtn label={t('partnerScripts.copy')} onClick={() => copy(s.id)} />
                </>} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ScriptRow({ s, actions, channelLabel, t }: { s: Script; actions: React.ReactNode; channelLabel: (c: Channel) => string; t: (k: string) => string }) {
  return (
    <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{s.title || t('partnerScripts.untitled')}</div>
        <span style={{ fontSize: 11, fontWeight: 600, color: TEAL, background: 'oklch(55% 0.11 193 / 0.12)', borderRadius: 5, padding: '2px 7px', marginTop: 4, display: 'inline-block' }}>{channelLabel(s.channel)}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>{actions}</div>
    </div>
  )
}

function RowBtn({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      style={{ background: 'var(--surface-overlay)', color: danger ? 'oklch(55% 0.18 25)' : 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 7, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
      {label}
    </button>
  )
}

// "Open" — opens the script in a separate browser popup window. A real window
// (not an in-page modal) so it stays open while the partner switches tabs or
// navigates the app. Named per-script so re-clicking focuses the same window.
function RowPopup({ label, id }: { label: string; id: string }) {
  const open = () => window.open(
    `/partner-portal/script-popup/${id}`,
    `script_${id}`,
    'popup=yes,width=600,height=760,scrollbars=yes,resizable=yes',
  )
  return (
    <button onClick={open}
      style={{ background: 'var(--surface-overlay)', color: TEAL, border: '1px solid var(--border-subtle)', borderRadius: 7, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
      {label} ↗
    </button>
  )
}
