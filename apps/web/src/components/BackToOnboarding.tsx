'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useT } from '@/lib/i18n/I18nProvider'

/**
 * Top-of-page banner that links the user back to the Get Started
 * checklist. Renders ONLY when the page was arrived at via the checklist
 * (via the `?from=onboarding` query param the onboarding page appends to
 * each step's link). On any other arrival the banner doesn't appear, so
 * normal usage of these pages isn't visually polluted.
 *
 * Solves the UX problem reported during the Test_02 feature-test sprint:
 * multi-section pages (especially /settings) had no clear "I'm done with
 * this section, take me back to the checklist" affordance — users had to
 * manually navigate back and check if anything counted.
 *
 * Drop into the top of any onboarding-step page:
 *
 *   <BackToOnboarding />
 *   <h1>Settings</h1>
 *   ...
 */
export function BackToOnboarding() {
  const t = useT()
  const params = useSearchParams()
  if (params.get('from') !== 'onboarding') return null

  return (
    <div
      className="rounded-xl px-4 py-3 mb-5 flex items-center justify-between gap-4"
      style={{
        background: 'oklch(96% 0.04 193)',
        border:     '1px solid oklch(85% 0.10 193)',
      }}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'oklch(45% 0.13 193)', flexShrink: 0, marginTop: 1 }}>
          <path d="M3 8l3.5 3.5L13 5" />
          <circle cx="8" cy="8" r="7" />
        </svg>
        <p className="text-sm" style={{ color: 'oklch(35% 0.13 193)' }}>
          {t('backToOnboarding.message')}
        </p>
      </div>
      <Link
        href="/onboarding"
        className="text-sm font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0"
        style={{ background: 'oklch(55% 0.11 193)', color: 'white', textDecoration: 'none' }}
      >
        {t('backToOnboarding.action')}
      </Link>
    </div>
  )
}
