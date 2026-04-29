'use client'

import { useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'

interface DNAVersion { id: string; version: number; isActive: boolean; updatedAt: string }
interface DNADetail {
  id: string; version: number; isActive: boolean
  identityJson: Record<string, unknown>
  servicesJson: Record<string, unknown>
  pricingJson: Record<string, unknown>
  operationsJson: Record<string, unknown>
  salesJson: Record<string, unknown>
  appointmentJson: Record<string, unknown>
  supportJson: Record<string, unknown>
  languageJson: Record<string, unknown>
  complianceJson: Record<string, unknown>
}

const SECTIONS = ['identityJson','servicesJson','pricingJson','operationsJson','salesJson','appointmentJson','supportJson','languageJson','complianceJson'] as const

export default function BusinessDNAPage() {
  const { data, loading, error, reload } = useApi<{ active: DNADetail | null; versions: DNAVersion[] }>('/api/business-dna')
  const [selected, setSelected] = useState<DNADetail | null>(null)
  const [activeSection, setActiveSection] = useState<typeof SECTIONS[number]>('identityJson')
  const [editValue, setEditValue] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function loadVersion(id: string) {
    const detail = await apiFetch<DNADetail>(`/api/business-dna/${id}`)
    setSelected(detail)
    setEditValue(JSON.stringify(detail[activeSection], null, 2))
    setJsonError('')
  }

  function handleSectionChange(section: typeof SECTIONS[number]) {
    setActiveSection(section)
    if (selected) setEditValue(JSON.stringify(selected[section], null, 2))
    setJsonError('')
  }

  async function createDraft() {
    setSaving(true)
    try {
      const draft = await apiFetch<DNADetail>('/api/business-dna', { method: 'POST', body: JSON.stringify({}) })
      await reload()
      await loadVersion(draft.id)
      setMessage('New draft created.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function saveSection() {
    if (!selected) return
    let parsed: unknown
    try { parsed = JSON.parse(editValue) } catch { setJsonError('Invalid JSON'); return }
    setSaving(true)
    try {
      const updated = await apiFetch<DNADetail>(`/api/business-dna/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [activeSection]: parsed }),
      })
      setSelected(updated)
      setMessage('Section saved.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function publish() {
    if (!selected) return
    setSaving(true)
    try {
      await apiFetch(`/api/business-dna/${selected.id}/publish`, { method: 'POST', body: '{}' })
      await reload()
      setMessage('DNA published and now active.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
  if (error) return <div className="p-8 text-sm text-red-500">{error}</div>

  const versions = data?.versions ?? []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Business DNA</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Versioned knowledge base for your AI agents</p>
        </div>
        <button onClick={createDraft} disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          New draft
        </button>
      </div>

      {message && <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400">{message}</div>}

      <div className="flex gap-6">
        <div className="w-56 shrink-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Versions</p>
          <div className="space-y-1">
            {versions.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">No versions yet</p>}
            {versions.map((v) => (
              <button key={v.id} onClick={() => loadVersion(v.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selected?.id === v.id ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                v{v.version} {v.isActive && <span className="text-green-600 dark:text-green-400 text-xs">● active</span>}
              </button>
            ))}
          </div>
        </div>

        {selected ? (
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap gap-2">
              {SECTIONS.map((s) => (
                <button key={s} onClick={() => handleSectionChange(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${activeSection === s ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {s.replace('Json', '')}
                </button>
              ))}
            </div>
            <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)}
              className="w-full h-72 font-mono text-xs border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
            <div className="flex gap-3">
              <button onClick={saveSection} disabled={saving || selected.isActive}
                className="px-4 py-2 bg-gray-800 dark:bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-900 dark:hover:bg-gray-600 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save section'}
              </button>
              {!selected.isActive && (
                <button onClick={publish} disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                  Publish
                </button>
              )}
              {selected.isActive && <span className="text-sm text-green-600 dark:text-green-400 self-center">● Currently active</span>}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            Select a version or create a new draft
          </div>
        )}
      </div>
    </div>
  )
}
