'use client'

import Link from 'next/link'
import { useApi } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

interface OnboardingStep {
  key:         'profile' | 'dna' | 'agent' | 'channel' | 'number' | 'a2p'
  label:       string
  description: string
  href:        string
  completed:   boolean
  optional?:   boolean
  locked?:     boolean
}

interface OnboardingStatus {
  steps:          OnboardingStep[]
  completedCount: number
  totalCount:     number
  allComplete:    boolean
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l3.5 3.5L13 5" />
    </svg>
  )
}

function PendingIcon({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
      style={{ background: 'var(--surface-sunken)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}>
      {n}
    </span>
  )
}

function CompletedIcon() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full"
      style={{ background: 'oklch(55% 0.11 193)', color: 'white' }}>
      <CheckIcon />
    </span>
  )
}

function LockedIcon() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full"
      style={{ background: 'var(--surface-sunken)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="7" width="10" height="6.5" rx="1" />
        <path d="M5 7V5a3 3 0 0 1 6 0v2" />
      </svg>
    </span>
  )
}

export default function OnboardingPage() {
  const t = useT()
  const { data, loading, reload } = useApi<OnboardingStatus>('/api/onboarding/status')

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

  const pct = Math.round((data.completedCount / data.totalCount) * 100)

  // Translate step labels and descriptions by key. The API returns English
  // copy as a fallback, but we always render the locale-specific version.
  const stepLabel = (step: OnboardingStep) =>
    t(`tenantOnboarding.steps.${step.key}.title`)
  const stepDescription = (step: OnboardingStep) =>
    t(`tenantOnboarding.steps.${step.key}.description`)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {data.allComplete ? t('tenantOnboarding.allSetTitle') : t('tenantOnboarding.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {data.allComplete
              ? t('tenantOnboarding.allSetSubtitle')
              : t('tenantOnboarding.subtitle', { done: data.completedCount, total: data.totalCount })}
          </p>
        </div>
        <button onClick={() => reload()} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          {t('tenantOnboarding.actions.refresh')}
        </button>
      </div>

      {!data.allComplete && (
        <div className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
            <span>{t('tenantOnboarding.progress')}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-sunken)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'oklch(55% 0.11 193)' }} />
          </div>
        </div>
      )}

      <div className="space-y-3">
        {data.steps.map((step, i) => {
          // Three states: completed > locked > pending
          const isLocked = step.locked && !step.completed
          return (
          <div
            key={step.key}
            className="rounded-xl p-5 flex items-start gap-4"
            style={{
              background:    step.completed ? 'oklch(98% 0.02 193)' : 'var(--surface-raised)',
              border:        step.completed ? '1px solid oklch(85% 0.10 193)' : '1px solid var(--border-subtle)',
              opacity:       step.completed ? 0.85 : isLocked ? 0.6 : 1,
            }}
          >
            <div className="pt-0.5">
              {step.completed ? <CompletedIcon /> : isLocked ? <LockedIcon /> : <PendingIcon n={i + 1} />}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{stepLabel(step)}</h3>
                  {step.optional && !step.completed && !isLocked && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
                      {t('tenantOnboarding.optional')}
                    </span>
                  )}
                  {isLocked && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
                      {t('tenantOnboarding.lockedPill')}
                    </span>
                  )}
                </div>
                {step.completed && (
                  <span className="text-xs font-medium" style={{ color: 'oklch(45% 0.16 193)' }}>{t('tenantOnboarding.statusPill.complete')}</span>
                )}
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{stepDescription(step)}</p>
              {isLocked ? (
                <Link
                  href="/billing"
                  className="inline-block mt-3 text-sm font-medium px-3 py-1.5 rounded-lg"
                  style={{ background: 'oklch(55% 0.11 193 / 0.12)', color: 'oklch(45% 0.13 193)', border: '1px solid oklch(55% 0.11 193 / 0.3)' }}
                >
                  {t('tenantOnboarding.actions.upgradeToUnlock')}
                </Link>
              ) : (
                <Link
                  href={`${step.href}?from=onboarding`}
                  className="inline-block mt-3 text-sm font-medium px-3 py-1.5 rounded-lg"
                  style={{
                    background: step.completed ? 'transparent' : 'oklch(55% 0.11 193)',
                    color:      step.completed ? 'oklch(45% 0.16 193)' : 'white',
                    border:     step.completed ? '1px solid oklch(85% 0.10 193)' : 'none',
                  }}
                >
                  {step.completed ? t('tenantOnboarding.actions.edit') : t('tenantOnboarding.actions.configure')}
                </Link>
              )}
            </div>
          </div>
          )
        })}
      </div>

      {data.allComplete && (
        <div className="rounded-xl p-5 text-center" style={{ background: 'oklch(96% 0.05 160)', border: '1px solid oklch(80% 0.10 160)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'oklch(35% 0.16 160)' }}>{t('tenantOnboarding.complete.title')}</p>
          <p className="text-xs" style={{ color: 'oklch(45% 0.10 160)' }}>
            {t('tenantOnboarding.complete.descriptionPrefix')}{' '}
            <Link href="/conversations" className="underline">{t('tenantOnboarding.complete.conversationsLink')}</Link>
            {t('tenantOnboarding.complete.descriptionSuffix')}
          </p>
        </div>
      )}
    </div>
  )
}
