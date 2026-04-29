'use client'

import { useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'

interface Agent {
  id: string; agentRoleType: string; displayName: string
  isEnabled: boolean; modelProvider: string; modelName: string
  promptVersion: { id: string; name: string; status: string } | null
}

const ROLE_LABELS: Record<string, string> = {
  ORCHESTRATOR: 'Orchestrator', APPOINTMENT: 'Appointment', SALES: 'Sales',
  CUSTOMER_SERVICE: 'Customer Service', MARKETING: 'Marketing',
  ASSISTANT: 'Assistant', SECRETARY: 'Secretary',
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

export default function AgentsPage() {
  const { data: agents, loading, error, reload } = useApi<Agent[]>('/api/agents')
  const [selected, setSelected] = useState<Agent | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function saveAgent() {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await apiFetch<Agent>(`/api/agents/${selected.agentRoleType}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: selected.displayName,
          isEnabled: selected.isEnabled,
          modelProvider: selected.modelProvider,
          modelName: selected.modelName,
        }),
      })
      setSelected(updated)
      await reload()
      setMessage('Agent saved.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
  if (error) return <div className="p-8 text-sm text-red-500">{error}</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Agents</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Configure each AI agent role for your workspace</p>

      {message && <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400">{message}</div>}

      <div className="flex gap-6">
        <div className="w-56 shrink-0 space-y-1">
          {(agents ?? []).map((a) => (
            <button key={a.id} onClick={() => setSelected(a)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selected?.id === a.id ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <span className="block">{ROLE_LABELS[a.agentRoleType] ?? a.agentRoleType}</span>
              <span className={`text-xs ${a.isEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {a.isEnabled ? '● enabled' : '○ disabled'}
              </span>
            </button>
          ))}
        </div>

        {selected && (
          <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-900 dark:text-gray-100">{ROLE_LABELS[selected.agentRoleType]}</h2>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={selected.isEnabled}
                  onChange={(e) => setSelected({ ...selected, isEnabled: e.target.checked })}
                  className="rounded" />
                Enabled
              </label>
            </div>
            <div>
              <label className={labelCls}>Display name</label>
              <input value={selected.displayName} onChange={(e) => setSelected({ ...selected, displayName: e.target.value })}
                className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Model provider</label>
                <input value={selected.modelProvider} onChange={(e) => setSelected({ ...selected, modelProvider: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Model name</label>
                <input value={selected.modelName} onChange={(e) => setSelected({ ...selected, modelName: e.target.value })}
                  className={inputCls} />
              </div>
            </div>
            {selected.promptVersion && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Bound prompt: {selected.promptVersion.name} ({selected.promptVersion.status})</p>
            )}
            <button onClick={saveAgent} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save agent'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
