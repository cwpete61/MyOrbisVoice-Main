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
const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function PromptsPage() {
  const { data: prompts, loading, error, reload } = useApi<Prompt[]>('/api/prompts')
  const [selected, setSelected] = useState<PromptDetail | null>(null)
  const [creating, setCreating] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', content: '', scope: 'TENANT' as string, channelType: '', agentRoleType: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

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
      setMessage('Prompt created.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Failed') }
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
      setMessage('Prompt saved.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function publishPrompt() {
    if (!selected) return
    setSaving(true)
    try {
      await apiFetch(`/api/prompts/${selected.id}/publish`, { method: 'POST', body: '{}' })
      await reload()
      setMessage('Prompt published.')
      setSelected({ ...selected, status: 'PUBLISHED' })
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
  if (error) return <div className="p-8 text-sm text-red-500">{error}</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Prompts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Versioned prompt library for all agent roles and channels</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          New prompt
        </button>
      </div>

      {message && <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400">{message}</div>}

      {creating && (
        <div className="mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Create prompt</h2>
          <input placeholder="Name" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
            className={inputCls} />
          <select value={newForm.scope} onChange={(e) => setNewForm({ ...newForm, scope: e.target.value })}
            className={inputCls}>
            {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <textarea placeholder="Prompt content…" value={newForm.content} onChange={(e) => setNewForm({ ...newForm, content: e.target.value })}
            className={`${inputCls} h-40 font-mono`} />
          <div className="flex gap-3">
            <button onClick={createPrompt} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        <div className="w-64 shrink-0 space-y-1">
          {(prompts ?? []).length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">No prompts yet</p>}
          {(prompts ?? []).map((p) => (
            <button key={p.id} onClick={() => loadPrompt(p.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selected?.id === p.id ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <span className="block truncate">{p.name}</span>
              <span className={`text-xs ${p.status === 'PUBLISHED' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>{p.status} · v{p.versionNumber}</span>
            </button>
          ))}
        </div>

        {selected && (
          <div className="flex-1 space-y-4">
            <input value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })}
              className={`${inputCls} font-medium`} />
            <textarea value={selected.content} onChange={(e) => setSelected({ ...selected, content: e.target.value })}
              disabled={selected.status !== 'DRAFT'}
              className={`${inputCls} h-72 font-mono disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:opacity-60`} />
            <div className="flex gap-3">
              {selected.status === 'DRAFT' && (
                <>
                  <button onClick={savePrompt} disabled={saving}
                    className="px-4 py-2 bg-gray-800 dark:bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-900 dark:hover:bg-gray-600 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={publishPrompt} disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                    Publish
                  </button>
                </>
              )}
              {selected.status === 'PUBLISHED' && <span className="text-sm text-green-600 dark:text-green-400 self-center">● Published</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
