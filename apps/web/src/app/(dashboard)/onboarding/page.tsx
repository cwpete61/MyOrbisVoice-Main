'use client'

import Link from 'next/link'
import { useApi } from '@/hooks/useApi'

interface OnboardingStep {
  key:         'profile' | 'dna' | 'agent' | 'channel' | 'number'
  label:       string
  description: string
  href:        string
  completed:   boolean
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

export default function OnboardingPage() {
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {data.allComplete ? 'You are all set' : 'Get started'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {data.allComplete
              ? 'Everything is configured. Your receptionist agent is live.'
              : `Finish these steps to get your AI receptionist running. ${data.completedCount} of ${data.totalCount} done.`}
          </p>
        </div>
        <button onClick={() => reload()} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          Refresh status
        </button>
      </div>

      {!data.allComplete && (
        <div className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-sunken)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'oklch(55% 0.11 193)' }} />
          </div>
        </div>
      )}

      <div className="space-y-3">
        {data.steps.map((step, i) => (
          <div
            key={step.key}
            className="rounded-xl p-5 flex items-start gap-4"
            style={{
              background:    step.completed ? 'oklch(98% 0.02 193)' : 'var(--surface-raised)',
              border:        step.completed ? '1px solid oklch(85% 0.10 193)' : '1px solid var(--border-subtle)',
              opacity:       step.completed ? 0.85 : 1,
            }}
          >
            <div className="pt-0.5">
              {step.completed ? <CompletedIcon /> : <PendingIcon n={i + 1} />}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{step.label}</h3>
                {step.completed && (
                  <span className="text-xs font-medium" style={{ color: 'oklch(45% 0.16 193)' }}>Complete</span>
                )}
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{step.description}</p>
              <Link
                href={step.href}
                className="inline-block mt-3 text-sm font-medium px-3 py-1.5 rounded-lg"
                style={{
                  background: step.completed ? 'transparent' : 'oklch(55% 0.11 193)',
                  color:      step.completed ? 'oklch(45% 0.16 193)' : 'white',
                  border:     step.completed ? '1px solid oklch(85% 0.10 193)' : 'none',
                }}
              >
                {step.completed ? 'Edit →' : 'Configure →'}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {data.allComplete && (
        <div className="rounded-xl p-5 text-center" style={{ background: 'oklch(96% 0.05 160)', border: '1px solid oklch(80% 0.10 160)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'oklch(35% 0.16 160)' }}>Setup complete — call your number to test</p>
          <p className="text-xs" style={{ color: 'oklch(45% 0.10 160)' }}>
            Your AI receptionist is live. Call your number to confirm everything works,
            then check the conversation in <Link href="/conversations" className="underline">Conversations</Link>.
          </p>
        </div>
      )}
    </div>
  )
}
