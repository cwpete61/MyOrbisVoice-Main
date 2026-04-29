'use client'

import { useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'

interface Channel {
  id: string; channelType: string; isEnabled: boolean
  greetingMode: string | null; afterHoursMode: string | null; escalationMode: string | null
  promptVersion: { id: string; name: string } | null
}

const CHANNEL_LABELS: Record<string, { label: string; description: string }> = {
  WIDGET: { label: 'Website Widget', description: 'Real-time browser voice agent' },
  INBOUND: { label: 'Inbound Receptionist', description: 'Handles live phone calls' },
  OUTBOUND: { label: 'Outbound Caller', description: 'Runs campaigns and follow-up calls' },
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 capitalize'

export default function ChannelsPage() {
  const { data: channels, loading, error, reload } = useApi<Channel[]>('/api/channels')
  const [selected, setSelected] = useState<Channel | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function saveChannel() {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await apiFetch<Channel>(`/api/channels/${selected.channelType}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isEnabled: selected.isEnabled,
          greetingMode: selected.greetingMode,
          afterHoursMode: selected.afterHoursMode,
          escalationMode: selected.escalationMode,
        }),
      })
      setSelected(updated)
      await reload()
      setMessage('Channel saved.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
  if (error) return <div className="p-8 text-sm text-red-500">{error}</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Channels</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enable and configure each voice channel</p>

      {message && <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400">{message}</div>}

      <div className="grid grid-cols-3 gap-4 mb-8">
        {(channels ?? []).map((c) => (
          <button key={c.id} onClick={() => setSelected(c)}
            className={`text-left p-5 rounded-xl border transition-all ${selected?.id === c.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{CHANNEL_LABELS[c.channelType]?.label}</span>
              <span className={`w-2 h-2 rounded-full ${c.isEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{CHANNEL_LABELS[c.channelType]?.description}</p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4 max-w-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium text-gray-900 dark:text-gray-100">{CHANNEL_LABELS[selected.channelType]?.label}</h2>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={selected.isEnabled}
                onChange={(e) => setSelected({ ...selected, isEnabled: e.target.checked })}
                className="rounded" />
              Enabled
            </label>
          </div>
          {(['greetingMode', 'afterHoursMode', 'escalationMode'] as const).map((field) => (
            <div key={field}>
              <label className={labelCls}>{field.replace(/([A-Z])/g, ' $1').trim()}</label>
              <input value={selected[field] ?? ''}
                onChange={(e) => setSelected({ ...selected, [field]: e.target.value || null })}
                className={inputCls}
                placeholder="e.g. friendly, voicemail, escalate-to-human" />
            </div>
          ))}
          {selected.promptVersion && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Bound prompt: {selected.promptVersion.name}</p>
          )}
          <button onClick={saveChannel} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save channel'}
          </button>
        </div>
      )}
    </div>
  )
}
