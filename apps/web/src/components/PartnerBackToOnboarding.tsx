'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

type StepKey = 'profile' | 'page' | 'payouts' | 'calendar' | 'booking' | 'share' | 'number'

/**
 * Phase G.4 — partner onboarding "back to Getting Started" banner. Mirrors the
 * tenant BackToOnboarding component.
 *
 * Renders ONLY when the page was reached from the wizard (via the
 * `?from=getting-started` query param). Normal page usage isn't polluted.
 *
 * Passive by default — the wizard auto-detects step completion from real
 * data. Pass `markStepKey` to also explicitly flag a step done before
 * routing back (used for soft steps the data can't detect).
 */
export function PartnerBackToOnboarding({ markStepKey }: { markStepKey?: StepKey } = {}) {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const [busy, setBusy] = useState(false)

  if (params.get('from') !== 'getting-started') return null

  async function handleClick(e: React.MouseEvent) {
    if (!markStepKey) return
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      await apiFetch('/api/partner/onboarding/mark-step-done', {
        method: 'POST',
        body: JSON.stringify({ stepKey: markStepKey }),
      })
    } catch {
      // Mark failed — still navigate; auto-detection may catch it anyway.
    } finally {
      router.push('/partner-portal/getting-started')
    }
  }

  return (
    <div
      className="rounded-xl px-4 py-3 mb-5 flex items-center justify-between gap-4"
      style={{ background: 'oklch(96% 0.04 193)', border: '1px solid oklch(85% 0.10 193)' }}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'oklch(45% 0.13 193)', flexShrink: 0, marginTop: 1 }}>
          <path d="M3 8l3.5 3.5L13 5" />
          <circle cx="8" cy="8" r="7" />
        </svg>
        <p className="text-sm" style={{ color: 'oklch(35% 0.13 193)' }}>
          {t('partnerBackToOnboarding.message')}
        </p>
      </div>
      {markStepKey ? (
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0"
          style={{ background: 'oklch(55% 0.11 193)', color: 'white', opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? t('partnerBackToOnboarding.marking') : t('partnerBackToOnboarding.actionMark')}
        </button>
      ) : (
        <Link
          href="/partner-portal/getting-started"
          className="text-sm font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0"
          style={{ background: 'oklch(55% 0.11 193)', color: 'white', textDecoration: 'none' }}
        >
          {t('partnerBackToOnboarding.action')}
        </Link>
      )}
    </div>
  )
}
