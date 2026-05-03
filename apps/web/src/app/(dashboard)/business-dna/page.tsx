'use client'

import { useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'

interface DNAVersion { id: string; version: number; isActive: boolean; updatedAt: string }
interface DNADetail {
  id: string; version: number; isActive: boolean
  identityJson: Record<string, unknown>; servicesJson: Record<string, unknown>
  pricingJson: Record<string, unknown>; operationsJson: Record<string, unknown>
  salesJson: Record<string, unknown>; appointmentJson: Record<string, unknown>
  supportJson: Record<string, unknown>; languageJson: Record<string, unknown>
  complianceJson: Record<string, unknown>
}

const SECTIONS: { key: keyof Omit<DNADetail, 'id' | 'version' | 'isActive'>; label: string; icon: string; description: string }[] = [
  { key: 'identityJson',    label: 'Identity',    icon: '🏢',
    description: 'Your business name, mission, brand voice, and what you do at a glance. The agent uses this to introduce itself and frame every conversation.' },
  { key: 'servicesJson',    label: 'Services',    icon: '🛠️',
    description: 'What you offer — products, services, packages. Be specific. The agent quotes from this when callers ask "what do you do?" or "do you offer X?".' },
  { key: 'pricingJson',     label: 'Pricing',     icon: '💰',
    description: 'How much things cost and what discounts/promotions apply. Include enough detail that the agent can answer pricing questions without escalating.' },
  { key: 'operationsJson',  label: 'Operations',  icon: '⚙️',
    description: 'How your business runs day-to-day: hours, locations, service areas, lead times, payment terms. The agent references this for logistical questions.' },
  { key: 'salesJson',       label: 'Sales',       icon: '💼',
    description: 'Your qualifying questions, ideal-customer rules, and the workflow for converting a caller into a booked customer.' },
  { key: 'appointmentJson', label: 'Appointments',icon: '📅',
    description: 'Booking rules: how long appointments take, what info to collect, what days/times are available, when to escalate to a human.' },
  { key: 'supportJson',     label: 'Support',     icon: '🎧',
    description: 'How to handle complaints, refunds, and angry customers. Include the boundary where the agent should hand off to a human.' },
  { key: 'languageJson',    label: 'Language',    icon: '🗣️',
    description: 'Tone, voice, vocabulary preferences. Phrases the agent should always or never use. Languages it should respond to.' },
  { key: 'complianceJson',  label: 'Compliance',  icon: '⚖️',
    description: 'Legal and regulatory rules the agent must follow — disclosures, recording notices, opt-out language, industry-specific compliance (HIPAA, GDPR, etc.).' },
]

export default function BusinessDNAPage() {
  const { data, loading, error, reload } = useApi<{ active: DNADetail | null; versions: DNAVersion[] }>('/api/business-dna')
  const [selected, setSelected] = useState<DNADetail | null>(null)
  const [activeSection, setActiveSection] = useState<typeof SECTIONS[number]['key']>('identityJson')
  const [editValue, setEditValue] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadVersion(id: string) {
    const detail = await apiFetch<DNADetail>(`/api/business-dna/${id}`)
    setSelected(detail)
    setEditValue(JSON.stringify(detail[activeSection], null, 2))
    setJsonError('')
  }

  function handleSectionChange(section: typeof activeSection) {
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
      showToast('success', 'New draft created.')
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function saveSection() {
    if (!selected) return
    let parsed: unknown
    try { parsed = JSON.parse(editValue) } catch { setJsonError('Invalid JSON — fix before saving'); return }
    setSaving(true)
    try {
      const updated = await apiFetch<DNADetail>(`/api/business-dna/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [activeSection]: parsed }),
      })
      setSelected(updated)
      showToast('success', 'Section saved.')
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  async function publish() {
    if (!selected) return
    setSaving(true)
    try {
      await apiFetch(`/api/business-dna/${selected.id}/publish`, { method: 'POST', body: '{}' })
      await reload()
      showToast('success', 'Business DNA published and now active.')
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-44 rounded-lg" style={{ background: 'var(--border-subtle)' }} />
      <div className="h-80 rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }} />
    </div>
  )
  if (error) return <div className="alert-error">{error}</div>

  const versions = data?.versions ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Business DNA</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Versioned knowledge base that your AI agents draw on in every conversation.
          </p>
        </div>
        <button onClick={createDraft} disabled={saving} className="btn-primary">
          + New draft
        </button>
      </div>

      {toast && <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Version list */}
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)' }}>Versions</p>
          {versions.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No versions yet.</p>
          )}
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => loadVersion(v.id)}
              className="w-full text-left px-3 py-2.5 rounded-lg transition-colors"
              style={selected?.id === v.id
                ? { background: 'oklch(19% 0.04 193 / 0.5)', border: '1px solid oklch(55% 0.14 193 / 0.4)' }
                : { background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }
              }
            >
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Version {v.version}</p>
              <p className="text-xs mt-0.5" style={{ color: v.isActive ? 'oklch(65% 0.15 145)' : 'var(--text-tertiary)' }}>
                {v.isActive ? '● Active' : `Updated ${new Date(v.updatedAt).toLocaleDateString()}`}
              </p>
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div
              className="rounded-xl h-full min-h-80 flex flex-col items-center justify-center gap-2"
              style={{ background: 'var(--surface-raised)', border: '1px dashed var(--border-subtle)' }}
            >
              <span className="text-2xl">🧬</span>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Select a version or create a new draft</p>
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
            >
              {/* Section tabs */}
              <div
                className="flex flex-wrap gap-1 px-4 py-3"
                style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-overlay)' }}
              >
                {SECTIONS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => handleSectionChange(s.key)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                    style={activeSection === s.key
                      ? { background: 'oklch(55% 0.14 193)', color: '#fff' }
                      : { background: 'transparent', color: 'var(--text-secondary)' }
                    }
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>

              {/* Status bar */}
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Version {selected.version}</span>
                  <span className="text-xs" style={{ color: selected.isActive ? 'oklch(65% 0.15 145)' : 'var(--text-tertiary)' }}>
                    {selected.isActive ? '● Active' : '○ Draft'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!selected.isActive && (
                    <>
                      <button onClick={saveSection} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
                        {saving ? 'Saving…' : 'Save section'}
                      </button>
                      <button
                        onClick={publish}
                        disabled={saving}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium"
                        style={{ background: 'oklch(15% 0.05 145)', color: 'oklch(65% 0.15 145)', border: '1px solid oklch(25% 0.08 145)' }}
                      >
                        Publish
                      </button>
                    </>
                  )}
                  {selected.isActive && (
                    <span className="text-xs font-medium" style={{ color: 'oklch(65% 0.15 145)' }}>● Currently active — read-only</span>
                  )}
                </div>
              </div>

              <div className="p-4">
                {(() => {
                  const sectionMeta = SECTIONS.find(s => s.key === activeSection)
                  return sectionMeta?.description ? (
                    <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ color: 'var(--text-secondary)', background: 'var(--surface-overlay)' }}>
                      <span className="mr-1">{sectionMeta.icon}</span>
                      {sectionMeta.description}
                    </p>
                  ) : null
                })()}
                <textarea
                  value={editValue}
                  onChange={(e) => { setEditValue(e.target.value); setJsonError('') }}
                  disabled={selected.isActive}
                  className="input font-mono text-xs resize-none"
                  style={{ minHeight: '340px', opacity: selected.isActive ? 0.6 : 1 }}
                  spellCheck={false}
                />
                {jsonError && <p className="mt-1.5 text-xs text-red-500">{jsonError}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
