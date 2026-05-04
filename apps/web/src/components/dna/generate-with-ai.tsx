'use client'

/**
 * "Generate with AI" — a small modal-trigger button placed at the top of each
 * supported Business DNA section.
 *
 * Flow:
 *   1. Button click opens a modal asking for the four context inputs we need
 *      to seed the prompt: businessName, industry, brief, tone.
 *   2. We pre-fill from `identitySnapshot` (the Identity section's saved
 *      values) and `currentValue` so the user rarely has to type anything
 *      after the first run.
 *   3. Submit → POST /api/ai-assist/generate-dna-section → onApply(content).
 *   4. The page is responsible for merging the result and marking dirty.
 *
 * UX guard: if the section already has substantial content, we ask for
 * confirmation before overwriting (because Apply replaces the whole section).
 */

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

export type AiSection =
  | 'identity'
  | 'sales'
  | 'appointment'
  | 'support'
  | 'language'
  | 'operations'

interface Props {
  section: AiSection
  currentValue: Record<string, unknown>
  identitySnapshot?: Record<string, unknown>
  onApply: (generated: Record<string, unknown>) => void
}

interface GenerateResponse {
  section: AiSection
  content: Record<string, unknown>
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/* ─────────────────────────────────────────────────────────────────────────
 * "Has substantial content?" heuristic — used only to decide whether to
 * confirm an overwrite. Counts non-empty string/array/object leaves.
 * ──────────────────────────────────────────────────────────────────────── */

function isSubstantial(value: Record<string, unknown>): boolean {
  let filled = 0
  for (const v of Object.values(value)) {
    if (typeof v === 'string' && v.trim().length > 0) filled++
    else if (Array.isArray(v) && v.length > 0) filled++
    else if (v && typeof v === 'object' && Object.keys(v as object).length > 0) filled++
    if (filled >= 2) return true
  }
  return false
}

/* ─────────────────────────────────────────────────────────────────────────
 * Section labels (what the user sees in the modal title)
 * ──────────────────────────────────────────────────────────────────────── */

const SECTION_LABEL: Record<AiSection, string> = {
  identity:    'Identity',
  sales:       'Sales',
  appointment: 'Appointments',
  support:     'Support',
  language:    'Language',
  operations:  'After-hours behavior',
}

/* ─────────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────────── */

export function GenerateWithAi({ section, currentValue, identitySnapshot, onApply }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Seed inputs — pre-filled from Identity snapshot or current section values.
  const initial = useMemo(() => {
    const id = identitySnapshot ?? {}
    return {
      businessName: asString(id['businessName']) || asString(currentValue['businessName']),
      industry:     asString(id['industry'])     || asString(currentValue['industry']),
      brief:        asString(id['shortDescription']) || '',
      tone:         asString(id['tone']) || asString(currentValue['tone']),
    }
  }, [identitySnapshot, currentValue])

  const [businessName, setBusinessName] = useState(initial.businessName)
  const [industry,     setIndustry]     = useState(initial.industry)
  const [brief,        setBrief]        = useState(initial.brief)
  const [tone,         setTone]         = useState(initial.tone)

  // Re-sync when modal re-opens so freshly-saved Identity values flow in.
  useEffect(() => {
    if (open) {
      setBusinessName(initial.businessName)
      setIndustry(initial.industry)
      setBrief(initial.brief)
      setTone(initial.tone)
      setError(null)
    }
  }, [open, initial])

  function openModal() {
    if (isSubstantial(currentValue)) {
      const ok = window.confirm(
        `This will replace your current ${SECTION_LABEL[section]} content. Continue?`,
      )
      if (!ok) return
    }
    setOpen(true)
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch<GenerateResponse>('/api/ai-assist/generate-dna-section', {
        method: 'POST',
        body: JSON.stringify({
          section,
          contextSeed: {
            businessName: businessName.trim() || undefined,
            industry:     industry.trim()     || undefined,
            brief:        brief.trim()        || undefined,
            tone:         tone.trim()         || undefined,
          },
        }),
      })
      onApply(res.content)
      setOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      // Friendlier copy when key isn't configured.
      if (/not set in system config|not configured/i.test(msg)) {
        setError("AI assist isn't configured. Contact your platform admin.")
      } else {
        setError(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  /* ─── render ─── */

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
        style={{
          background:  'oklch(19% 0.04 193 / 0.5)',
          color:       'oklch(72% 0.12 193)',
          border:      '1px solid oklch(37% 0.08 193 / 0.45)',
        }}
      >
        <span>✨</span>
        <span>Generate with AI</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'oklch(8% 0 0 / 0.65)' }}
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl"
            style={{
              background: 'var(--surface-raised)',
              border:     '1px solid var(--border-subtle)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-5 py-3"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                ✨ Generate {SECTION_LABEL[section]} with AI
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Tell the AI a bit about your business. You can edit everything after.
              </p>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="label">Business name</label>
                <input
                  className="input"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Acme Plumbing"
                  disabled={busy}
                />
              </div>
              <div>
                <label className="label">Industry</label>
                <input
                  className="input"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="HVAC contractor, dental clinic, B2B SaaS, etc."
                  disabled={busy}
                />
              </div>
              <div>
                <label className="label">What does your business do?</label>
                <textarea
                  className="input"
                  rows={3}
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="One or two sentences. Optional but improves the draft."
                  disabled={busy}
                />
              </div>
              <div>
                <label className="label">Tone preference</label>
                <input
                  className="input"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="professional and warm (default)"
                  disabled={busy}
                />
              </div>

              {busy && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span
                    className="inline-block w-3 h-3 rounded-full animate-spin"
                    style={{
                      border:        '2px solid oklch(37% 0.08 193 / 0.45)',
                      borderTopColor: 'oklch(72% 0.12 193)',
                    }}
                  />
                  <span>Drafting your {SECTION_LABEL[section]} content…</span>
                </div>
              )}

              {error && !busy && (
                <p className="text-xs" style={{ color: 'oklch(70% 0.18 25)' }}>
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-5 py-3 flex items-center justify-end gap-2"
              style={{
                borderTop:  '1px solid var(--border-subtle)',
                background: 'var(--surface-overlay)',
              }}
            >
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{
                  color:      'var(--text-secondary)',
                  background: 'transparent',
                  border:     '1px solid var(--border-subtle)',
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="btn-primary text-xs px-4 py-1.5"
              >
                {busy ? 'Generating…' : error ? 'Retry' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
