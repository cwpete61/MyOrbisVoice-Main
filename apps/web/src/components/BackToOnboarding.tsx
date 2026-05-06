'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

type StepKey = 'profile' | 'dna' | 'agent' | 'channel' | 'number' | 'a2p'

/**
 * Page-level "back to onboarding" block. Renders ONLY when the page was
 * arrived at via the checklist (via the `?from=onboarding` query param).
 * On any other arrival the banner doesn't appear — normal usage of the
 * page isn't polluted.
 *
 * Two modes:
 *
 * 1. **No markStepKey (passive nav)** — clicking the button just routes
 *    to /onboarding. Auto-detection in the onboarding endpoint decides
 *    whether the step is complete based on actual data (brandName + hours,
 *    BusinessDNA published, etc.).
 *
 * 2. **markStepKey set (active completion)** — clicking the button POSTs
 *    /api/onboarding/mark-step-done with the given stepKey BEFORE routing.
 *    The step is then explicitly flagged complete in
 *    Tenant.onboardingMarkedDone[stepKey], overriding the data-based
 *    auto-detection. Use this on step pages where the tenant might have
 *    multiple sub-sections and not every one is required (e.g. /agents
 *    has 7 agent role cards but only one needs configuring).
 *
 * Per-card "Save & Back" buttons inside individual sections were
 * intentionally removed in favor of this single page-level affordance —
 * cleaner UX, one decision point per page.
 *
 * Usage:
 *
 *   <BackToOnboarding />                            // passive
 *   <BackToOnboarding markStepKey="profile" />      // marks Step 1 complete
 *   <BackToOnboarding markStepKey="agent" />        // marks Step 3 complete
 */
export function BackToOnboarding({ markStepKey }: { markStepKey?: StepKey } = {}) {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const [busy, setBusy] = useState(false)

  if (params.get('from') !== 'onboarding') return null

  async function handleClick(e: React.MouseEvent) {
    if (!markStepKey) return  // passive mode — let <Link> handle navigation
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      await apiFetch('/api/onboarding/mark-step-done', {
        method: 'POST',
        body: JSON.stringify({ stepKey: markStepKey }),
      })
    } catch {
      // If the mark fails, still navigate. Auto-detection may pick it up
      // anyway based on saved data, and we'd rather not strand the user
      // here.
    } finally {
      router.push('/onboarding')
    }
  }

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
          {markStepKey
            ? t('backToOnboarding.messageWithMark')
            : t('backToOnboarding.message')}
        </p>
      </div>
      {markStepKey ? (
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0"
          style={{
            background: 'oklch(55% 0.11 193)',
            color:      'white',
            textDecoration: 'none',
            opacity:    busy ? 0.6 : 1,
            cursor:     busy ? 'wait' : 'pointer',
          }}
        >
          {busy
            ? t('backToOnboarding.markingDone')
            : t('backToOnboarding.actionMarkDone')}
        </button>
      ) : (
        <Link
          href="/onboarding"
          className="text-sm font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0"
          style={{ background: 'oklch(55% 0.11 193)', color: 'white', textDecoration: 'none' }}
        >
          {t('backToOnboarding.action')}
        </Link>
      )}
    </div>
  )
}
