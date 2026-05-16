'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

/**
 * Phase G.4 — "Show setup wizard" toggle for the partner Profile page.
 *
 * The onboarding wizard auto-hides once setup is complete. This toggle lets a
 * partner bring it back — flips AffiliateAccount.showOnboardingWizard, which
 * the dashboard banner reads. While onboarding is still incomplete the wizard
 * shows regardless, so the toggle only has a visible effect post-completion.
 */
export function PartnerWizardToggle() {
  const t = useT()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    apiFetch<{ wizardEnabled: boolean }>('/api/partner/onboarding/status')
      .then(d => setEnabled(!!d.wizardEnabled))
      .catch(() => setEnabled(false))
  }, [])

  async function toggle() {
    if (enabled === null || saving) return
    const next = !enabled
    setSaving(true)
    try {
      await apiFetch('/api/partner/onboarding/show-wizard', {
        method: 'POST',
        body: JSON.stringify({ show: next }),
      })
      setEnabled(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl p-4 flex items-center justify-between gap-4"
         style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('partnerWizardToggle.title')}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {t('partnerWizardToggle.description')}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled === true}
        onClick={toggle}
        disabled={enabled === null || saving}
        className="relative flex-shrink-0 rounded-full transition-colors"
        style={{
          width: 44, height: 24,
          background: enabled ? 'oklch(55% 0.11 193)' : 'var(--surface-app)',
          border: '1px solid var(--border-subtle)',
          opacity: enabled === null || saving ? 0.5 : 1,
          cursor: enabled === null || saving ? 'wait' : 'pointer',
        }}
      >
        <span
          className="absolute rounded-full transition-all"
          style={{
            width: 18, height: 18, top: 2,
            left: enabled ? 23 : 2,
            background: '#fff',
          }}
        />
      </button>
    </div>
  )
}
