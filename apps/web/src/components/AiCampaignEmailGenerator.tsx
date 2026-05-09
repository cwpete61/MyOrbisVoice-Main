'use client'

import { useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

// "Generate with AI" button + inline modal that fills the campaign editor's
// emailSubject + emailBody fields. Calls POST /api/ai-assist/generate-campaign-email
// which respects the tenant's active aggression tier (or per-campaign
// override). Source: docs/marketing-style-guide.md.

type Draft = { subject: string; body: string; tier: string }

export function AiCampaignEmailGenerator({
  campaignName,
  triggerTag,
  campaignId,
  onApply,
}: {
  campaignName?: string
  triggerTag?: string
  campaignId?: string
  onApply: (subject: string, body: string) => void
}) {
  const t = useT()
  const [open, setOpen]       = useState(false)
  const [brief, setBrief]     = useState('')
  const [audience, setAudience] = useState('')
  const [busy, setBusy]       = useState(false)
  const [draft, setDraft]     = useState<Draft | null>(null)
  const [error, setError]     = useState<string | null>(null)

  async function generate() {
    if (brief.trim().length < 10) {
      setError(t('aiEmailGen.briefTooShort'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await apiFetch<Draft>('/api/ai-assist/generate-campaign-email', {
        method: 'POST',
        body: JSON.stringify({
          brief: brief.trim(),
          ...(campaignName ? { campaignName } : {}),
          ...(triggerTag   ? { triggerTag   } : {}),
          ...(campaignId   ? { campaignId   } : {}),
          ...(audience.trim() ? { audience: audience.trim() } : {}),
        }),
      })
      setDraft(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiEmailGen.generateFailed'))
    } finally {
      setBusy(false)
    }
  }

  function applyDraft() {
    if (!draft) return
    onApply(draft.subject, draft.body)
    setOpen(false)
    setBrief('')
    setAudience('')
    setDraft(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1.5"
        style={{
          background: 'oklch(55% 0.11 193 / 0.10)',
          border: '1px solid oklch(55% 0.11 193 / 0.30)',
          color: 'oklch(55% 0.11 193)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M3 13l2-2M11 5l2-2"/>
        </svg>
        {t('aiEmailGen.button')}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => !busy && setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('aiEmailGen.title')}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {t('aiEmailGen.subtitle')}
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {t('aiEmailGen.briefLabel')}
                </label>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  placeholder={t('aiEmailGen.briefPlaceholder')}
                  maxLength={2000}
                  disabled={busy}
                />
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  {t('aiEmailGen.briefHint')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {t('aiEmailGen.audienceLabel')} <span style={{ color: 'var(--text-tertiary)' }}>({t('aiEmailGen.optional')})</span>
                </label>
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  placeholder={t('aiEmailGen.audiencePlaceholder')}
                  maxLength={500}
                  disabled={busy}
                />
              </div>

              {error && (
                <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'oklch(60% 0.20 25 / 0.10)', color: 'oklch(50% 0.20 25)', border: '1px solid oklch(60% 0.20 25 / 0.30)' }}>
                  {error}
                </div>
              )}

              {draft && (
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                  <div className="px-4 py-2 flex items-center justify-between" style={{ background: 'var(--surface-app)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                      {t('aiEmailGen.previewLabel')}
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold"
                      style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}
                    >
                      {t(`aggressionTier.tiers.${draft.tier}.label`)}
                    </span>
                  </div>
                  <div className="p-4 space-y-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('aiEmailGen.subjectLabel')}
                      </div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{draft.subject}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider mb-1 mt-3" style={{ color: 'var(--text-tertiary)' }}>
                        {t('aiEmailGen.bodyLabel')}
                      </div>
                      <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}>{draft.body}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-app)' }}>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                className="text-xs px-3 py-1.5 rounded-md"
                style={{ color: 'var(--text-secondary)' }}
                disabled={busy}
              >
                {t('aiEmailGen.cancel')}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generate}
                  disabled={busy || brief.trim().length < 10}
                  className="text-xs px-4 py-2 rounded-md font-medium"
                  style={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    opacity: busy || brief.trim().length < 10 ? 0.55 : 1,
                  }}
                >
                  {busy ? t('aiEmailGen.generating') : draft ? t('aiEmailGen.regenerate') : t('aiEmailGen.generate')}
                </button>
                {draft && (
                  <button
                    type="button"
                    onClick={applyDraft}
                    className="text-xs px-4 py-2 rounded-md font-medium"
                    style={{ background: 'var(--brand-500)', color: '#fff' }}
                  >
                    {t('aiEmailGen.useThis')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
