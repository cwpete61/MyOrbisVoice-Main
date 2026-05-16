'use client'

import Link from 'next/link'
import { useApi } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

// Phase G.4 — partner onboarding wizard. Mirrors the tenant /onboarding page.
// Steps auto-complete: the API checks the real underlying data, so doing the
// thing on its actual page flips the step ✓ when the agent returns here.

type StepKey = 'profile' | 'page' | 'payouts' | 'calendar' | 'booking' | 'share' | 'number'

interface OnboardingStep {
  key:       StepKey
  href:      string
  completed: boolean
  optional?: boolean
}

interface OnboardingStatus {
  steps:          OnboardingStep[]
  completedCount: number
  totalCount:     number
  allComplete:    boolean
}

const TEAL = 'oklch(55% 0.11 193)'

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l3.5 3.5L13 5" />
    </svg>
  )
}

function CompletedIcon() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full" style={{ background: TEAL, color: 'white' }}>
      <CheckIcon />
    </span>
  )
}

function PendingIcon({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
      style={{ background: 'var(--surface-app)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}>
      {n}
    </span>
  )
}

export default function PartnerGettingStartedPage() {
  const t = useT()
  const { data, loading, reload } = useApi<OnboardingStatus>('/api/partner/onboarding/status')

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse max-w-3xl">
        {[280, 200, 320, 240, 200].map((w, i) => (
          <div key={i} className="h-5 rounded" style={{ width: `${w}px`, background: 'var(--border-subtle)' }} />
        ))}
      </div>
    )
  }
  if (!data) return null

  const pct = data.totalCount > 0 ? Math.round((data.completedCount / data.totalCount) * 100) : 0

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {data.allComplete ? t('partnerOnboarding.allSetTitle') : t('partnerOnboarding.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {data.allComplete
              ? t('partnerOnboarding.allSetSubtitle')
              : t('partnerOnboarding.subtitle', { done: data.completedCount, total: data.totalCount })}
          </p>
        </div>
        <button onClick={() => reload()} className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          {t('partnerOnboarding.refresh')}
        </button>
      </div>

      {!data.allComplete && (
        <div className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
            <span>{t('partnerOnboarding.progress')}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-app)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: TEAL }} />
          </div>
        </div>
      )}

      <div className="space-y-3">
        {data.steps.map((step, i) => (
          <div
            key={step.key}
            className="rounded-xl p-5 flex items-start gap-4"
            style={{
              background: step.completed ? 'oklch(98% 0.02 193)' : 'var(--surface-raised)',
              border:     step.completed ? '1px solid oklch(85% 0.10 193)' : '1px solid var(--border-subtle)',
              opacity:    step.completed ? 0.9 : 1,
            }}
          >
            <div className="pt-0.5">
              {step.completed ? <CompletedIcon /> : <PendingIcon n={i + 1} />}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {t(`partnerOnboarding.steps.${step.key}.title`)}
                  </h3>
                  {step.optional && !step.completed && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ background: 'var(--surface-app)', color: 'var(--text-tertiary)' }}>
                      {t('partnerOnboarding.optional')}
                    </span>
                  )}
                </div>
                {step.completed && (
                  <span className="text-xs font-medium" style={{ color: 'oklch(45% 0.16 193)' }}>
                    {t('partnerOnboarding.completePill')}
                  </span>
                )}
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {t(`partnerOnboarding.steps.${step.key}.description`)}
              </p>
              <Link
                href={`${step.href}?from=getting-started`}
                className="inline-block mt-3 text-sm font-medium px-3 py-1.5 rounded-lg"
                style={{
                  background: step.completed ? 'transparent' : TEAL,
                  color:      step.completed ? 'oklch(45% 0.16 193)' : 'white',
                  border:     step.completed ? '1px solid oklch(85% 0.10 193)' : 'none',
                }}
              >
                {step.completed ? t('partnerOnboarding.edit') : t('partnerOnboarding.configure')}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {data.allComplete && (
        <div className="rounded-xl p-5 text-center" style={{ background: 'oklch(96% 0.05 160)', border: '1px solid oklch(80% 0.10 160)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'oklch(35% 0.16 160)' }}>
            {t('partnerOnboarding.complete.title')}
          </p>
          <p className="text-xs" style={{ color: 'oklch(45% 0.10 160)' }}>
            {t('partnerOnboarding.complete.body')}
          </p>
        </div>
      )}
    </div>
  )
}
