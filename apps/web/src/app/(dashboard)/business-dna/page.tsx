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
import { KnowledgeBaseSection } from '@/components/dna/KnowledgeBaseSection'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { BackToOnboarding } from '@/components/BackToOnboarding'

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

/** "knowledgeBase" is a special section that doesn't write to a DNA JSON
 *  column — it manages its own files via the /api/knowledge-base endpoints
 *  and bypasses the standard form/save/dirty/JSON-mode flow. */
type DnaJsonKey =
  | 'identityJson' | 'servicesJson' | 'pricingJson' | 'operationsJson'
  | 'salesJson' | 'appointmentJson' | 'supportJson' | 'languageJson'
  | 'complianceJson'

type SectionKey = DnaJsonKey | 'knowledgeBase'

const DNA_JSON_KEYS: readonly DnaJsonKey[] = [
  'identityJson', 'servicesJson', 'pricingJson', 'operationsJson',
  'salesJson', 'appointmentJson', 'supportJson', 'languageJson', 'complianceJson',
]
function isDnaJsonKey(k: SectionKey): k is DnaJsonKey {
  return (DNA_JSON_KEYS as readonly string[]).includes(k)
}

interface SectionMeta {
  key: SectionKey
  i18nKey: string
  icon: string
  /** Standard sections render through this component. The knowledgeBase
   *  section bypasses it — see the renderer below. */
  Component: ((props: SectionProps) => React.JSX.Element) | null
}

/* The metadata array is preserved verbatim from the original page so the
 * left-rail labels and descriptions are unchanged. Labels and descriptions
 * are pulled from the i18n dictionary using `i18nKey` as the lookup root. */
const SECTIONS: SectionMeta[] = [
  { key: 'identityJson',    i18nKey: 'identity',     icon: '🏢', Component: IdentitySection },
  { key: 'servicesJson',    i18nKey: 'services',     icon: '🛠️', Component: ServicesSection },
  { key: 'pricingJson',     i18nKey: 'pricing',      icon: '💰', Component: PricingSection },
  { key: 'operationsJson',  i18nKey: 'operations',   icon: '⚙️', Component: OperationsSection },
  { key: 'salesJson',       i18nKey: 'sales',        icon: '💼', Component: SalesSection },
  { key: 'appointmentJson', i18nKey: 'appointments', icon: '📅', Component: AppointmentSection },
  { key: 'supportJson',     i18nKey: 'support',      icon: '🎧', Component: SupportSection },
  { key: 'languageJson',    i18nKey: 'language',     icon: '🗣️', Component: LanguageSection },
  { key: 'complianceJson',  i18nKey: 'compliance',   icon: '⚖️', Component: ComplianceSection },
  // Knowledge Base — special section that manages its own state via
  // /api/knowledge-base. Component is null because the renderer branches
  // on this section key and renders <KnowledgeBaseSection /> directly.
  { key: 'knowledgeBase',   i18nKey: 'knowledgeBase', icon: '📚', Component: null },
]

/* ─────────────────────────────────────────────────────────────────────────
 * Page component
 * ──────────────────────────────────────────────────────────────────────── */

export default function BusinessDNAPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'

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
      const ok = window.confirm(t('tenantBusinessDna.confirm.discardChanges'))
      if (!ok) return
    }
    const detail = await apiFetch<DNADetail>(`/api/business-dna/${id}`)
    setSelected(detail)
    if (isDnaJsonKey(activeSection)) {
      const sectionVal = (detail[activeSection] ?? {}) as Record<string, unknown>
      setFormValue(sectionVal)
      setJsonText(JSON.stringify(sectionVal, null, 2))
    }
    setJsonMode(false)
    setJsonError('')
    setDirty(false)
  }

  function handleSectionChange(next: SectionKey) {
    if (next === activeSection) return
    if (dirty) {
      const ok = window.confirm(t('tenantBusinessDna.confirm.discardChanges'))
      if (!ok) return
    }
    setActiveSection(next)
    if (isDnaJsonKey(next) && selected) {
      const sectionVal = (selected[next] ?? {}) as Record<string, unknown>
      setFormValue(sectionVal)
      setJsonText(JSON.stringify(sectionVal, null, 2))
    } else {
      // KB section or no selected version yet — no JSON value to load.
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
          setJsonError(t('tenantBusinessDna.jsonInvalidObject'))
          return
        }
        setFormValue(parsed as Record<string, unknown>)
        setJsonError('')
        setJsonMode(false)
      } catch (err) {
        setJsonError(err instanceof Error ? err.message : t('tenantBusinessDna.jsonInvalid'))
      }
    }
  }

  async function createDraft() {
    if (dirty) {
      const ok = window.confirm(t('tenantBusinessDna.confirm.discardForNewDraft'))
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
      showToast('success', t('tenantBusinessDna.toast.draftCreated'))
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('tenantBusinessDna.toast.createFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function saveSection() {
    if (!selected) return
    // Knowledge Base self-saves on upload/delete; the page-level Save bar
    // is hidden for it. Belt-and-suspenders early return if invoked anyway.
    if (!isDnaJsonKey(activeSection)) return
    const sectionKey: DnaJsonKey = activeSection

    // Resolve the value to save: if user is in JSON view, parse it first.
    let toSave: Record<string, unknown> = formValue
    if (jsonMode) {
      try {
        const parsed = JSON.parse(jsonText) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setJsonError(t('tenantBusinessDna.jsonInvalidObject'))
          return
        }
        toSave = parsed as Record<string, unknown>
      } catch (err) {
        setJsonError(err instanceof Error ? err.message : t('tenantBusinessDna.jsonInvalid'))
        return
      }
    }

    setSaving(true)
    try {
      const updated = await apiFetch<DNADetail>(`/api/business-dna/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [sectionKey]: toSave }),
      })
      setSelected(updated)
      const fresh = (updated[sectionKey] ?? {}) as Record<string, unknown>
      setFormValue(fresh)
      setJsonText(JSON.stringify(fresh, null, 2))
      setJsonError('')
      setDirty(false)
      showToast('success', t('tenantBusinessDna.toast.sectionSaved'))
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('tenantBusinessDna.toast.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    if (!selected) return
    if (dirty) {
      const ok = window.confirm(t('tenantBusinessDna.confirm.saveBeforePublish'))
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
      showToast('success', t('tenantBusinessDna.toast.published'))
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('tenantBusinessDna.toast.publishFailed'))
    } finally {
      setSaving(false)
    }
  }

  /* ─── render ─── */

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <BackToOnboarding markStepKey="dna" />
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
      <BackToOnboarding markStepKey="dna" />
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {t('tenantBusinessDna.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('tenantBusinessDna.subtitle')}
          </p>
        </div>
        <button onClick={createDraft} disabled={saving} className="btn-primary">
          {t('tenantBusinessDna.newDraft')}
        </button>
      </div>

      {toast && <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* ─── Left rail: section nav + version list ─── */}
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-2"
               style={{ color: 'var(--text-tertiary)' }}>
              {t('tenantBusinessDna.sectionsHeading')}
            </p>
            <div className="space-y-1">
              {SECTIONS.map((s) => {
                const isActive = activeSection === s.key
                const sectionLabel = t(`tenantBusinessDna.sections.${s.i18nKey}.label`)
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
                      {sectionLabel}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-2"
               style={{ color: 'var(--text-tertiary)' }}>
              {t('tenantBusinessDna.versionsHeading')}
            </p>
            {versions.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('tenantBusinessDna.noVersions')}
              </p>
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
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {t('tenantBusinessDna.versionLabel', { n: v.version })}
                    </p>
                    <p className="text-xs mt-0.5"
                       style={{ color: v.isActive ? 'oklch(65% 0.15 145)' : 'var(--text-tertiary)' }}>
                      {v.isActive
                        ? t('tenantBusinessDna.versionActive')
                        : t('tenantBusinessDna.versionUpdated', { date: new Date(v.updatedAt).toLocaleDateString(dateLocale) })}
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
                {t('tenantBusinessDna.emptyStateTitle')}
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
                    {t('tenantBusinessDna.statusVersion', { n: selected.version })}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: selected.isActive ? 'oklch(65% 0.15 145)' : 'var(--text-tertiary)' }}
                  >
                    {selected.isActive
                      ? t('tenantBusinessDna.statusActive')
                      : t('tenantBusinessDna.statusDraft')}
                  </span>
                  {dirty && (
                    <span
                      className="text-xs"
                      style={{ color: 'oklch(70% 0.13 75)' }}
                    >
                      {t('tenantBusinessDna.statusUnsaved')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {activeSection !== 'knowledgeBase' && (
                    <button
                      onClick={toggleJsonMode}
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{
                        color: jsonMode ? 'oklch(72% 0.12 193)' : 'var(--text-secondary)',
                        background: jsonMode ? 'oklch(19% 0.04 193 / 0.6)' : 'transparent',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {jsonMode
                        ? t('tenantBusinessDna.showForm')
                        : t('tenantBusinessDna.showAdvancedJson')}
                    </button>
                  )}
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
                      {t('tenantBusinessDna.actions.publish')}
                    </button>
                  )}
                </div>
              </div>

              {/* Section header + description */}
              <div className="px-5 pt-5 pb-2">
                <h2 className="text-base font-semibold flex items-center gap-2"
                    style={{ color: 'var(--text-primary)' }}>
                  <span>{sectionMeta.icon}</span>
                  <span>{t(`tenantBusinessDna.sections.${sectionMeta.i18nKey}.label`)}</span>
                </h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {t(`tenantBusinessDna.sections.${sectionMeta.i18nKey}.description`)}
                </p>
              </div>

              {/* Body */}
              <div className="px-5 py-4">
                {readOnly && activeSection !== 'knowledgeBase' && (
                  <div
                    className="text-xs px-3 py-2 rounded-lg mb-4"
                    style={{
                      background: 'oklch(14% 0.04 193)',
                      color: 'oklch(72% 0.12 193)',
                      border: '1px solid oklch(37% 0.08 193 / 0.35)',
                    }}
                  >
                    {t('tenantBusinessDna.readOnlyBanner')}
                  </div>
                )}

                {activeSection === 'knowledgeBase' ? (
                  // KB is shared across all DNA versions (it's tenant-scoped,
                  // not version-scoped) and self-saves on upload/delete.
                  <KnowledgeBaseSection />
                ) : jsonMode ? (
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
                ) : SectionComponent ? (
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
                ) : null}
              </div>

              {/* Sticky save bar — hidden for KB (self-saves on upload/delete) */}
              {!readOnly && activeSection !== 'knowledgeBase' && (
                <div
                  className="px-5 py-3 flex items-center justify-end gap-2 sticky bottom-0"
                  style={{
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--surface-overlay)',
                  }}
                >
                  {dirty && (
                    <span className="text-xs mr-2" style={{ color: 'var(--text-tertiary)' }}>
                      {t('tenantBusinessDna.savedPerSection')}
                    </span>
                  )}
                  <button
                    onClick={saveSection}
                    disabled={saving || !dirty}
                    className="btn-primary text-xs px-4 py-1.5"
                  >
                    {saving
                      ? t('tenantBusinessDna.actions.saving')
                      : t('tenantBusinessDna.actions.save')}
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
