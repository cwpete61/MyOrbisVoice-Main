'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/I18nProvider'

// Operationalizes the 4-tier Marketing Voice spectrum from
// docs/marketing-style-guide.md. Reused in tenant /settings, partner profile,
// and the campaign editor (where it's a per-campaign override with a "use
// default" 5th option).

export type AggressionTier = 'conservative' | 'balanced' | 'direct' | 'aggressive'

const TIERS: AggressionTier[] = ['conservative', 'balanced', 'direct', 'aggressive']

// Sample subject + first-line preview per tier — same scenario at each
// intensity so the user can compare. Drawn straight from the doc's
// "Sample-preview content per tier" table so the UI matches the
// canonical spec.
const SAMPLES: Record<AggressionTier, { subjectKey: string; firstLineKey: string }> = {
  conservative: {
    subjectKey:   'aggressionTier.samples.conservative.subject',
    firstLineKey: 'aggressionTier.samples.conservative.firstLine',
  },
  balanced: {
    subjectKey:   'aggressionTier.samples.balanced.subject',
    firstLineKey: 'aggressionTier.samples.balanced.firstLine',
  },
  direct: {
    subjectKey:   'aggressionTier.samples.direct.subject',
    firstLineKey: 'aggressionTier.samples.direct.firstLine',
  },
  aggressive: {
    subjectKey:   'aggressionTier.samples.aggressive.subject',
    firstLineKey: 'aggressionTier.samples.aggressive.firstLine',
  },
}

const TIER_ACCENT: Record<AggressionTier, string> = {
  conservative: 'oklch(60% 0.10 220)',  // calm blue
  balanced:     'oklch(55% 0.11 193)',  // brand teal (default)
  direct:       'oklch(65% 0.18 60)',   // amber-orange
  aggressive:   'oklch(60% 0.20 25)',   // hot red
}

export function AggressionTierSelector({
  value,
  onChange,
  saving = false,
  showSample = true,
  allowInherit = false,
  inheritLabel,
}: {
  value: AggressionTier | null
  onChange: (tier: AggressionTier | null) => void
  saving?: boolean
  showSample?: boolean
  // For per-campaign override: include a "use workspace default" option
  allowInherit?: boolean
  inheritLabel?: string
}) {
  const t = useT()
  // For sample preview, default to 'balanced' when value is null/inherited
  const [previewTier, setPreviewTier] = useState<AggressionTier>(value ?? 'balanced')

  function handleSelect(tier: AggressionTier | null) {
    onChange(tier)
    if (tier) setPreviewTier(tier)
  }

  return (
    <div className="space-y-4">
      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {allowInherit && (
          <button
            type="button"
            onClick={() => handleSelect(null)}
            disabled={saving}
            className="text-left rounded-lg p-3 transition-colors"
            style={{
              background:  value === null ? 'var(--surface-overlay)' : 'var(--surface-raised)',
              border:      `1.5px solid ${value === null ? 'var(--brand-500)' : 'var(--border-subtle)'}`,
              cursor:      saving ? 'default' : 'pointer',
              opacity:     saving ? 0.7 : 1,
            }}
          >
            <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
              {inheritLabel ?? t('aggressionTier.inheritLabel')}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              {t('aggressionTier.inheritDescription')}
            </div>
          </button>
        )}
        {TIERS.map(tier => {
          const selected = value === tier
          return (
            <button
              key={tier}
              type="button"
              onClick={() => handleSelect(tier)}
              onMouseEnter={() => showSample && setPreviewTier(tier)}
              disabled={saving}
              className="text-left rounded-lg p-3 transition-colors"
              style={{
                background:  selected ? 'var(--surface-overlay)' : 'var(--surface-raised)',
                border:      `1.5px solid ${selected ? TIER_ACCENT[tier] : 'var(--border-subtle)'}`,
                cursor:      saving ? 'default' : 'pointer',
                opacity:     saving ? 0.7 : 1,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: TIER_ACCENT[tier] }}
                />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t(`aggressionTier.tiers.${tier}.label`)}
                </span>
                {tier === 'balanced' && (
                  <span
                    className="text-[9px] px-1 py-0.5 rounded font-semibold uppercase tracking-wider"
                    style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
                  >
                    {t('aggressionTier.defaultBadge')}
                  </span>
                )}
              </div>
              <div className="text-[11px] leading-snug" style={{ color: 'var(--text-tertiary)' }}>
                {t(`aggressionTier.tiers.${tier}.description`)}
              </div>
            </button>
          )
        })}
      </div>

      {/* Sample preview */}
      {showSample && (
        <div className="rounded-lg p-4" style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
            {t('aggressionTier.samplePreviewLabel')}
          </div>
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {t(SAMPLES[previewTier].subjectKey)}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t(SAMPLES[previewTier].firstLineKey)}
          </div>
        </div>
      )}

      {/* Aggressive-tier warning */}
      {value === 'aggressive' && (
        <div
          className="rounded-lg p-3 text-xs"
          style={{
            background: 'oklch(60% 0.20 25 / 0.10)',
            border: '1px solid oklch(60% 0.20 25 / 0.30)',
            color: 'oklch(50% 0.20 25)',
          }}
        >
          ⚠️ {t('aggressionTier.aggressiveWarning')}
        </div>
      )}
    </div>
  )
}
