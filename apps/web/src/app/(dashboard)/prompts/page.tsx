'use client'

import { useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'

interface Prompt {
  id: string; name: string; scope: string; channelType: string | null
  agentRoleType: string | null; status: string; versionNumber: number
  publishedAt: string | null; createdAt: string
}
interface PromptDetail extends Prompt { content: string }

const SCOPES = ['TENANT', 'CHANNEL', 'ROLE'] as const

const SCOPE_COLORS: Record<string, { bg: string; text: string }> = {
  TENANT:  { bg: 'oklch(19% 0.04 193)', text: 'oklch(72% 0.12 193)' },
  CHANNEL: { bg: 'oklch(14% 0.04 258)', text: 'oklch(72% 0.13 258)' },
  ROLE:    { bg: 'oklch(14% 0.04 75)',  text: 'oklch(70% 0.16 75)'  },
}

export default function PromptsPage() {
  const { data: prompts, loading, error, reload } = useApi<Prompt[]>('/api/prompts')
  const [selected, setSelected] = useState<PromptDetail | null>(null)
  const [creating, setCreating] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', content: '', scope: 'TENANT' as string, channelType: '', agentRoleType: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadPrompt(id: string) {
    const detail = await apiFetch<PromptDetail>(`/api/prompts/${id}`)
    setSelected(detail)
  }

  async function createPrompt() {
    setSaving(true)
    try {
      const body: Record<string, string> = { name: newForm.name, content: newForm.content, scope: newForm.scope }
      if (newForm.channelType) body['channelType'] = newForm.channelType
      if (newForm.agentRoleType) body['agentRoleType'] = newForm.agentRoleType
      await apiFetch('/api/prompts', { method: 'POST', body: JSON.stringify(body) })
      await reload()
      setCreating(false)
      setNewForm({ name: '', content: '', scope: 'TENANT', channelType: '', agentRoleType: '' })
      showToast('success', 'Prompt created.')
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function savePrompt() {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await apiFetch<PromptDetail>(`/api/prompts/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: selected.name, content: selected.content }),
      })
      setSelected(updated)
      await reload()
      showToast('success', 'Prompt saved.')
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function publishPrompt() {
    if (!selected) return
    setSaving(true)
    try {
      await apiFetch(`/api/prompts/${selected.id}/publish`, { method: 'POST', body: '{}' })
      await reload()
      showToast('success', 'Prompt published and active.')
      setSelected({ ...selected, status: 'PUBLISHED' })
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-32 rounded-lg" style={{ background: 'var(--border-subtle)' }} />
      <div className="h-64 rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }} />
    </div>
  )
  if (error) return <div className="alert-error">{error}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Prompts</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Versioned prompt library for all agent roles and channels.
          </p>
        </div>
        <button onClick={() => { setCreating(true); setSelected(null) }} className="btn-primary">
          + New prompt
        </button>
      </div>

      {toast && <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>}

      {/* Create form */}
      {creating && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New prompt</h2>
            <button onClick={() => setCreating(false)} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>✕ Cancel</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="e.g. Receptionist Greeting" value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Scope</label>
              <select className="input" value={newForm.scope}
                onChange={(e) => setNewForm({ ...newForm, scope: e.target.value })}>
                {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Prompt content</label>
            <textarea
              className="input font-mono text-xs resize-none"
              style={{ minHeight: '140px' }}
              placeholder="You are a professional receptionist for {business_name}…"
              value={newForm.content}
              onChange={(e) => setNewForm({ ...newForm, content: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={createPrompt} disabled={saving || !newForm.name || !newForm.content} className="btn-primary">
              {saving ? 'Creating…' : 'Create prompt'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* List */}
        <div className="space-y-1">
          {(prompts ?? []).length === 0 && (
            <div
              className="rounded-xl px-4 py-10 text-center"
              style={{ border: '1px dashed var(--border-subtle)' }}
            >
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No prompts yet</p>
            </div>
          )}
          {(prompts ?? []).map((p) => {
            const sc = SCOPE_COLORS[p.scope] ?? SCOPE_COLORS.TENANT!
            return (
              <button
                key={p.id}
                onClick={() => { loadPrompt(p.id); setCreating(false) }}
                className="w-full text-left px-3 py-2.5 rounded-lg transition-colors"
                style={selected?.id === p.id
                  ? { background: 'oklch(19% 0.04 193 / 0.5)', border: '1px solid oklch(55% 0.14 193 / 0.4)' }
                  : { background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }
                }
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs truncate font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: sc.bg, color: sc.text }}>
                    {p.scope}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs"
                    style={{ color: p.status === 'PUBLISHED' ? 'oklch(65% 0.15 145)' : 'var(--text-tertiary)' }}
                  >
                    {p.status === 'PUBLISHED' ? '● Published' : '○ Draft'} · v{p.versionNumber}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {!selected && !creating ? (
            <div
              className="rounded-xl h-full min-h-64 flex flex-col items-center justify-center gap-2"
              style={{ background: 'var(--surface-raised)', border: '1px dashed var(--border-subtle)' }}
            >
              <span className="text-2xl">📝</span>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Select a prompt to edit</p>
            </div>
          ) : selected ? (
            <div
              className="rounded-xl p-5 space-y-4"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(() => {
                    const sc = SCOPE_COLORS[selected.scope] ?? SCOPE_COLORS.TENANT!
                    return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.text }}>{selected.scope}</span>
                  })()}
                  <span className="text-xs" style={{ color: selected.status === 'PUBLISHED' ? 'oklch(65% 0.15 145)' : 'var(--text-tertiary)' }}>
                    {selected.status === 'PUBLISHED' ? '● Published' : '○ Draft'} · v{selected.versionNumber}
                  </span>
                </div>
              </div>

              <div>
                <label className="label">Name</label>
                <input
                  className="input font-medium"
                  value={selected.name}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                  disabled={selected.status !== 'DRAFT'}
                />
              </div>

              <div>
                <label className="label">Content</label>
                <textarea
                  className="input font-mono text-xs resize-none"
                  style={{ minHeight: '260px', opacity: selected.status !== 'DRAFT' ? 0.6 : 1 }}
                  value={selected.content}
                  onChange={(e) => setSelected({ ...selected, content: e.target.value })}
                  disabled={selected.status !== 'DRAFT'}
                />
              </div>

              <div className="flex items-center gap-3">
                {selected.status === 'DRAFT' ? (
                  <>
                    <button onClick={savePrompt} disabled={saving} className="btn-primary">
                      {saving ? 'Saving…' : 'Save draft'}
                    </button>
                    <button onClick={publishPrompt} disabled={saving} className="btn-ghost"
                      style={{ background: 'oklch(15% 0.05 145)', color: 'oklch(65% 0.15 145)', border: '1px solid oklch(25% 0.08 145)' }}>
                      Publish
                    </button>
                  </>
                ) : (
                  <span className="text-sm font-medium" style={{ color: 'oklch(65% 0.15 145)' }}>
                    ● Published · read-only
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
