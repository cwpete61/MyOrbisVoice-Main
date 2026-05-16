'use client'

import Link from 'next/link'
import { useApi } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

interface Status {
  completedCount: number
  totalCount:     number
  allComplete:    boolean
  showWizard:     boolean
}

/**
 * Phase G.4 — partner dashboard "finish setup" banner. Shows while onboarding
 * is incomplete OR the partner has manually re-enabled the wizard from their
 * profile. Returns null once setup is done (and not re-enabled) so the
 * dashboard goes back to the standard welcome view.
 */
export function PartnerOnboardingBanner() {
  const t = useT()
  const { data, loading } = useApi<Status>('/api/partner/onboarding/status')
  if (loading || !data || !data.showWizard) return null

  const remaining = data.totalCount - data.completedCount

  return (
    <div
      className="rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
      style={{ background: 'oklch(98% 0.04 75)', border: '1px solid oklch(85% 0.10 75)' }}
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: 'oklch(35% 0.16 75)' }}>
          {t('partnerOnboarding.banner.title')}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'oklch(45% 0.10 75)' }}>
          {t('partnerOnboarding.banner.body', { remaining, total: data.totalCount, done: data.completedCount })}
        </p>
      </div>
      <Link
        href="/partner-portal/getting-started"
        className="text-sm font-medium px-4 py-2 rounded-lg whitespace-nowrap"
        style={{ background: 'oklch(55% 0.16 75)', color: 'white' }}
      >
        {t('partnerOnboarding.banner.cta')}
      </Link>
    </div>
  )
}
