'use client'

/**
 * Business DNA editor — versioned tenant knowledge base for the AI agents.
 *
 * Replaces the previous raw-JSON-textarea-per-section UX with structured
 * forms. JSON view is preserved as a power-user escape hatch toggleable per
 * section.
 *
 * State model:
 *   - `selected` is the canonical version loaded from the API
 *   - `formValue` is the in-memory edit state for the active section
 *   - `dirty` is true once the user has changed `formValue` since load
 *   - Saving sends `{ [sectionKey]: formValue }` to PATCH /api/business-dna/:id
 *     and replaces `selected` with the response, then clears `dirty`.
 *
 * JSON view round-trip:
 *   - Toggle on  → serialize current `formValue` to pretty JSON
 *   - Toggle off → re-parse the JSON; block toggle if invalid
 *   - Save from either view writes the same shape; structure is preserved
 *     because forms read/write the same key set as the JSON.
 */

import { useEffect, useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'
import {
  IdentitySection, ServicesSection, PricingSection, OperationsSection,
  SalesSection, AppointmentSection, SupportSection, LanguageSection,
  ComplianceSection,
  type SectionProps,
} from '@/components/dna/sections'

interface DNAVersion {
  id: string
  version: number
  isActive: boolean
  updatedAt: string
}

interface DNADetail {
  id: string
  version: number
  isActive: boolean
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

type SectionKey =
  | 'identityJson' | 'servicesJson' | 'pricingJson' | 'operationsJson'
  | 'salesJson' | 'appointmentJson' | 'supportJson' | 'languageJson'
  | 'complianceJson'

interface SectionMeta {
  key: SectionKey
  label: string
  icon: string
  description: string
  Component: (props: SectionProps) => React.JSX.Element
}

/* The metadata array is preserved verbatim from the original page so the
 * left-rail labels and descriptions are unchanged. */
const SECTIONS: SectionMeta[] = [
  { key: 'identityJson',    label: 'Identity',     icon: '🏢', Component: IdentitySection,
    description: 'Your business name, mission, brand voice, and what you do at a glance. The agent uses this to introduce itself and frame every conversation.' },
  { key: 'servicesJson',    label: 'Services',     icon: '🛠️', Component: ServicesSection,
    description: 'What you offer — products, services, packages. Be specific. The agent quotes from this when callers ask "what do you do?" or "do you offer X?".' },
  { key: 'pricingJson',     label: 'Pricing',      icon: '💰', Component: PricingSection,
    description: 'How much things cost and what discounts/promotions apply. Include enough detail that the agent can answer pricing questions without escalating.' },
  { key: 'operationsJson',  label: 'Operations',   icon: '⚙️', Component: OperationsSection,
    description: 'How your business runs day-to-day: hours, locations, service areas, lead times, payment terms. The agent references this for logistical questions.' },
  { key: 'salesJson',       label: 'Sales',        icon: '💼', Component: SalesSection,
    description: 'Your qualifying questions, ideal-customer rules, and the workflow for converting a caller into a booked customer.' },
  { key: 'appointmentJson', label: 'Appointments', icon: '📅', Component: AppointmentSection,
    description: 'Booking rules: how long appointments take, what info to collect, what days/times are available, when to escalate to a human.' },
  { key: 'supportJson',     label: 'Support',      icon: '🎧', Component: SupportSection,
    description: 'How to handle complaints, refunds, and angry customers. Include the boundary where the agent should hand off to a human.' },
  { key: 'languageJson',    label: 'Language',     icon: '🗣️', Component: LanguageSection,
    description: 'Tone, voice, vocabulary preferences. Phrases the agent should always or never use. Languages it should respond to.' },
  { key: 'complianceJson',  label: 'Compliance',   icon: '⚖️', Component: ComplianceSection,
    description: 'Legal and regulatory rules the agent must follow — disclosures, recording notices, opt-out language, industry-specific compliance (HIPAA, GDPR, etc.).' },
]

/* ─────────────────────────────────────────────────────────────────────────
 * Page component
 * ──────────────────────────────────────────────────────────────────────── */

export default function BusinessDNAPage() {
  const { data, loading, error, reload } =
    useApi<{ active: DNADetail | null; versions: DNAVersion[] }>('/api/business-dna')

  const [selected, setSelected] = useState<DNADetail | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('identityJson')

  // The currently-edited value for the active section.
  const [formValue, setFormValue] = useState<Record<string, unknown>>({})
  const [dirty, setDirty] = useState(false)

  // JSON-view escape hatch state.
  const [jsonMode, setJsonMode] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Auto-load the active version on first fetch so the page isn't empty.
  useEffect(() => {
    if (!selected && data?.active) {
      void loadVersion(data.active.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.active?.id])

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  function setSectionValue(value: Record<string, unknown>) {
    setFormValue(value)
    setDirty(true)
    if (jsonMode) {
      setJsonText(JSON.stringify(value, null, 2))
    }
  }

  async function loadVersion(id: string, opts: { confirmDiscard?: boolean } = {}) {
    if (opts.confirmDiscard !== false && dirty) {
      const ok = window.confirm('You have unsaved changes. Discard them?')
      if (!ok) return
    }
    const detail = await apiFetch<DNADetail>(`/api/business-dna/${id}`)
    setSelected(detail)
    const sectionVal = (detail[activeSection] ?? {}) as Record<string, unknown>
    setFormValue(sectionVal)
    setJsonText(JSON.stringify(sectionVal, null, 2))
    setJsonMode(false)
    setJsonError('')
    setDirty(false)
  }

  function handleSectionChange(next: SectionKey) {
    if (next === activeSection) return
    if (dirty) {
      const ok = window.confirm('You have unsaved changes. Discard them?')
      if (!ok) return
    }
    setActiveSection(next)
    if (selected) {
      const sectionVal = (selected[next] ?? {}) as Record<string, unknown>
      setFormValue(sectionVal)
      setJsonText(JSON.stringify(sectionVal, null, 2))
    } else {
      setFormValue({})
      setJsonText('{}')
    }
    setJsonMode(false)
    setJsonError('')
    setDirty(false)
  }

  function toggleJsonMode() {
    if (!jsonMode) {
      // Entering JSON view — sync from form.
      setJsonText(JSON.stringify(formValue, null, 2))
      setJsonError('')
      setJsonMode(true)
    } else {
      // Leaving JSON view — parse and overwrite formValue. Block on error.
      try {
        const parsed = JSON.parse(jsonText) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setJsonError('Top-level value must be a JSON object.')
          return
        }
        setFormValue(parsed as Record<string, unknown>)
        setJsonError('')
        setJsonMode(false)
      } catch (err) {
        setJsonError(err instanceof Error ? err.message : 'Invalid JSON')
      }
    }
  }

  async function createDraft() {
    if (dirty) {
      const ok = window.confirm('You have unsaved changes. Discard them and create a new draft?')
      if (!ok) return
    }
    setSaving(true)
    try {
      const draft = await apiFetch<DNADetail>('/api/business-dna', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      await reload()
      await loadVersion(draft.id, { confirmDiscard: false })
      showToast('success', 'New draft created.')
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function saveSection() {
    if (!selected) return

    // Resolve the value to save: if user is in JSON view, parse it first.
    let toSave: Record<string, unknown> = formValue
    if (jsonMode) {
      try {
        const parsed = JSON.parse(jsonText) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setJsonError('Top-level value must be a JSON object.')
          return
        }
        toSave = parsed as Record<string, unknown>
      } catch (err) {
        setJsonError(err instanceof Error ? err.message : 'Invalid JSON')
        return
      }
    }

    setSaving(true)
    try {
      const updated = await apiFetch<DNADetail>(`/api/business-dna/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [activeSection]: toSave }),
      })
      setSelected(updated)
      const fresh = (updated[activeSection] ?? {}) as Record<string, unknown>
      setFormValue(fresh)
      setJsonText(JSON.stringify(fresh, null, 2))
      setJsonError('')
      setDirty(false)
      showToast('success', 'Section saved.')
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    if (!selected) return
    if (dirty) {
      const ok = window.confirm('You have unsaved changes. Save them before publishing? Cancel to abort.')
      if (!ok) return
      await saveSection()
    }
    setSaving(true)
    try {
      await apiFetch(`/api/business-dna/${selected.id}/publish`, {
        method: 'POST',
        body: '{}',
      })
      await reload()
      // Reload the current version to reflect isActive=true.
      const refreshed = await apiFetch<DNADetail>(`/api/business-dna/${selected.id}`)
      setSelected(refreshed)
      showToast('success', 'Business DNA published and now active.')
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setSaving(false)
    }
  }

  /* ─── render ─── */

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-7 w-44 rounded-lg" style={{ background: 'var(--border-subtle)' }} />
        <div
          className="h-80 rounded-xl"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
        />
      </div>
    )
  }
  if (error) return <div className="alert-error">{error}</div>

  const versions = data?.versions ?? []
  const sectionMeta = SECTIONS.find((s) => s.key === activeSection)!
  const SectionComponent = sectionMeta.Component
  const readOnly = !!selected?.isActive

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Business DNA
          </h1>
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
        {/* ─── Left rail: section nav + version list ─── */}
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-2"
               style={{ color: 'var(--text-tertiary)' }}>
              Sections
            </p>
            <div className="space-y-1">
              {SECTIONS.map((s) => {
                const isActive = activeSection === s.key
                return (
                  <button
                    key={s.key}
                    onClick={() => handleSectionChange(s.key)}
                    className="w-full text-left px-3 py-2 rounded-lg transition-colors flex items-start gap-2"
                    style={isActive
                      ? { background: 'oklch(19% 0.04 193 / 0.5)', border: '1px solid oklch(55% 0.14 193 / 0.4)' }
                      : { background: 'transparent', border: '1px solid transparent' }
                    }
                  >
                    <span className="text-base leading-5">{s.icon}</span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    >
                      {s.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-2"
               style={{ color: 'var(--text-tertiary)' }}>
              Versions
            </p>
            {versions.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No versions yet.</p>
            )}
            <div className="space-y-1">
              {versions.map((v) => {
                const isSel = selected?.id === v.id
                return (
                  <button
                    key={v.id}
                    onClick={() => loadVersion(v.id)}
                    className="w-full text-left px-3 py-2 rounded-lg transition-colors"
                    style={isSel
                      ? { background: 'oklch(19% 0.04 193 / 0.5)', border: '1px solid oklch(55% 0.14 193 / 0.4)' }
                      : { background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }
                    }
                  >
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Version {v.version}</p>
                    <p className="text-xs mt-0.5"
                       style={{ color: v.isActive ? 'oklch(65% 0.15 145)' : 'var(--text-tertiary)' }}>
                      {v.isActive ? '● Active' : `Updated ${new Date(v.updatedAt).toLocaleDateString()}`}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ─── Right pane: section editor ─── */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div
              className="rounded-xl h-full min-h-80 flex flex-col items-center justify-center gap-2"
              style={{ background: 'var(--surface-raised)', border: '1px dashed var(--border-subtle)' }}
            >
              <span className="text-2xl">🧬</span>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Select a version or create a new draft
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
            >
              {/* Status bar */}
              <div
                className="flex items-center justify-between px-5 py-3 gap-3 flex-wrap"
                style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-overlay)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Version {selected.version}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: selected.isActive ? 'oklch(65% 0.15 145)' : 'var(--text-tertiary)' }}
                  >
                    {selected.isActive ? '● Active — read-only' : '○ Draft'}
                  </span>
                  {dirty && (
                    <span
                      className="text-xs"
                      style={{ color: 'oklch(70% 0.13 75)' }}
                    >
                      • Unsaved changes
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleJsonMode}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{
                      color: jsonMode ? 'oklch(72% 0.12 193)' : 'var(--text-secondary)',
                      background: jsonMode ? 'oklch(19% 0.04 193 / 0.6)' : 'transparent',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {jsonMode ? 'Show form' : 'Show advanced (JSON)'}
                  </button>
                  {!selected.isActive && (
                    <button
                      onClick={publish}
                      disabled={saving}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{
                        background: 'oklch(15% 0.05 145)',
                        color: 'oklch(65% 0.15 145)',
                        border: '1px solid oklch(25% 0.08 145)',
                      }}
                    >
                      Publish
                    </button>
                  )}
                </div>
              </div>

              {/* Section header + description */}
              <div className="px-5 pt-5 pb-2">
                <h2 className="text-base font-semibold flex items-center gap-2"
                    style={{ color: 'var(--text-primary)' }}>
                  <span>{sectionMeta.icon}</span>
                  <span>{sectionMeta.label}</span>
                </h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {sectionMeta.description}
                </p>
              </div>

              {/* Body */}
              <div className="px-5 py-4">
                {readOnly && (
                  <div
                    className="text-xs px-3 py-2 rounded-lg mb-4"
                    style={{
                      background: 'oklch(14% 0.04 193)',
                      color: 'oklch(72% 0.12 193)',
                      border: '1px solid oklch(37% 0.08 193 / 0.35)',
                    }}
                  >
                    This version is currently active and read-only. Create a new draft to make changes.
                  </div>
                )}

                {jsonMode ? (
                  <div>
                    <textarea
                      value={jsonText}
                      onChange={(e) => {
                        setJsonText(e.target.value)
                        setJsonError('')
                        setDirty(true)
                      }}
                      disabled={readOnly}
                      className="input font-mono text-xs resize-none"
                      style={{ minHeight: '420px' }}
                      spellCheck={false}
                    />
                    {jsonError && (
                      <p className="mt-1.5 text-xs" style={{ color: 'oklch(70% 0.18 25)' }}>
                        {jsonError}
                      </p>
                    )}
                  </div>
                ) : (
                  <SectionComponent
                    value={formValue}
                    onChange={setSectionValue}
                    disabled={readOnly}
                    // When editing the Identity section itself, pass the live
                    // form value so AI-assist seed reflects unsaved edits.
                    identitySnapshot={
                      activeSection === 'identityJson'
                        ? formValue
                        : (selected.identityJson as Record<string, unknown> | undefined)
                    }
                  />
                )}
              </div>

              {/* Sticky save bar */}
              {!readOnly && (
                <div
                  className="px-5 py-3 flex items-center justify-end gap-2 sticky bottom-0"
                  style={{
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--surface-overlay)',
                  }}
                >
                  {dirty && (
                    <span className="text-xs mr-2" style={{ color: 'var(--text-tertiary)' }}>
                      Changes are saved per section.
                    </span>
                  )}
                  <button
                    onClick={saveSection}
                    disabled={saving || !dirty}
                    className="btn-primary text-xs px-4 py-1.5"
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
