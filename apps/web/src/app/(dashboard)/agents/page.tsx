'use client'

import { useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'
import { Tooltip } from '@/components/Tooltip'

interface Agent {
  id: string; agentRoleType: string; displayName: string
  isEnabled: boolean; modelProvider: string; modelName: string
  promptVersion: { id: string; name: string; status: string } | null
}

const ROLE_META: Record<string, { label: string; icon: string; desc: string }> = {
  ORCHESTRATOR:    { label: 'Orchestrator',    icon: '🎯', desc: 'Coordinates all other agents and manages handoffs' },
  APPOINTMENT:     { label: 'Appointment',     icon: '📅', desc: 'Books, reschedules, and cancels appointments' },
  SALES:           { label: 'Sales',           icon: '💼', desc: 'Qualifies leads and drives conversions' },
  CUSTOMER_SERVICE:{ label: 'Customer Service',icon: '🎧', desc: 'Handles support queries and escalations' },
  MARKETING:       { label: 'Marketing',       icon: '📣', desc: 'Runs campaigns and follow-up sequences' },
  ASSISTANT:       { label: 'Assistant',       icon: '🤖', desc: 'General-purpose assistant for any task' },
  SECRETARY:       { label: 'Secretary',       icon: '📋', desc: 'Manages schedule, notes, and admin tasks' },
}

export default function AgentsPage() {
  const { data: agents, loading, error, reload } = useApi<Agent[]>('/api/agents')
  const [selected, setSelected] = useState<Agent | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  async function saveAgent() {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await apiFetch<Agent>(`/api/agents/${selected.agentRoleType}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName:   selected.displayName,
          isEnabled:     selected.isEnabled,
          modelProvider: selected.modelProvider,
          modelName:     selected.modelName,
        }),
      })
      setSelected(updated)
      await reload()
      showToast('success', 'Agent saved.')
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-32 rounded-lg" style={{ background: 'var(--border-subtle)' }} />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-24 rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }} />)}
      </div>
    </div>
  )

  if (error) return <div className="alert-error">{error}</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Agents</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Configure each AI agent role for your workspace.
        </p>
      </div>

      {toast && <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agent cards */}
        <div className="lg:col-span-1 grid grid-cols-1 gap-3 content-start">
          {(agents ?? []).map((a) => {
            const meta = ROLE_META[a.agentRoleType] ?? { label: a.agentRoleType, icon: '🤖', desc: '' }
            const isSelected = selected?.id === a.id
            return (
              <button
                key={a.id}
                onClick={() => setSelected(a)}
                className="text-left rounded-xl p-4 transition-all"
                style={{
                  background: isSelected ? 'oklch(19% 0.04 193 / 0.5)' : 'var(--surface-raised)',
                  border: isSelected ? '1px solid oklch(55% 0.14 193 / 0.5)' : '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{meta.icon}</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{meta.label}</span>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={a.isEnabled
                      ? { background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }
                      : { background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }
                    }
                  >
                    {a.isEnabled ? 'On' : 'Off'}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{meta.desc}</p>
              </button>
            )
          })}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div
              className="rounded-xl h-full min-h-64 flex flex-col items-center justify-center gap-2"
              style={{ background: 'var(--surface-raised)', border: '1px dashed var(--border-subtle)' }}
            >
              <span className="text-2xl">🤖</span>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Select an agent to configure it</p>
            </div>
          ) : (
            <div
              className="rounded-xl p-6 space-y-5"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{ROLE_META[selected.agentRoleType]?.icon ?? '🤖'}</span>
                  <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {ROLE_META[selected.agentRoleType]?.label ?? selected.agentRoleType}
                  </h2>
                </div>
                {/* Toggle */}
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {selected.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <div
                    onClick={() => setSelected({ ...selected, isEnabled: !selected.isEnabled })}
                    className="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
                    style={{ background: selected.isEnabled ? 'oklch(55% 0.14 193)' : 'var(--border-subtle)' }}
                  >
                    <div
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                      style={{ transform: selected.isEnabled ? 'translateX(18px)' : 'translateX(2px)' }}
                    />
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="label flex items-center">
                    <Tooltip content="The name your agent uses when introducing itself on calls (e.g. 'Hi, this is Aria from Acme'). Pick something friendly and easy to hear over the phone.">Display name</Tooltip>
                  </label>
                  <input
                    className="input"
                    value={selected.displayName}
                    onChange={(e) => setSelected({ ...selected, displayName: e.target.value })}
                    placeholder="e.g. Aria"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label flex items-center">
                      <Tooltip content="Which AI provider routes this agent's reasoning. Default 'openai' — only change if you know what you're doing.">Model provider</Tooltip>
                    </label>
                    <input
                      className="input"
                      value={selected.modelProvider}
                      onChange={(e) => setSelected({ ...selected, modelProvider: e.target.value })}
                      placeholder="openai"
                    />
                  </div>
                  <div>
                    <label className="label flex items-center">
                      <Tooltip content="The specific model used for this agent's text reasoning (summaries, follow-ups, decisions). Voice itself is always Gemini Live, set on the channel.">Model name</Tooltip>
                    </label>
                    <input
                      className="input"
                      value={selected.modelName}
                      onChange={(e) => setSelected({ ...selected, modelName: e.target.value })}
                      placeholder="gpt-4o-mini"
                    />
                  </div>
                </div>
              </div>

              {selected.promptVersion && (
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}
                >
                  <span className="text-sm">📝</span>
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{selected.promptVersion.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{selected.promptVersion.status}</p>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button onClick={saveAgent} disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : 'Save agent'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
