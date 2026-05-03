'use client'

import Link from 'next/link'
import { useApi } from '@/hooks/useApi'

interface Status {
  completedCount: number
  totalCount:     number
  allComplete:    boolean
}

// Renders a "finish setup — N of 5 done" banner on the dashboard if the
// tenant hasn't completed onboarding. Returns null otherwise so the layout
// is unaffected.
export function OnboardingBanner() {
  const { data, loading } = useApi<Status>('/api/onboarding/status')
  if (loading || !data || data.allComplete) return null

  const remaining = data.totalCount - data.completedCount

  return (
    <div
      className="rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
      style={{ background: 'oklch(98% 0.04 75)', border: '1px solid oklch(85% 0.10 75)' }}
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: 'oklch(35% 0.16 75)' }}>
          Finish setting up your AI receptionist
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'oklch(45% 0.10 75)' }}>
          {remaining} of {data.totalCount} steps left — {data.completedCount > 0 ? `${data.completedCount} already complete.` : 'pick up where you left off.'}
        </p>
      </div>
      <Link
        href="/onboarding"
        className="text-sm font-medium px-4 py-2 rounded-lg"
        style={{ background: 'oklch(55% 0.16 75)', color: 'white' }}
      >
        Continue setup →
      </Link>
    </div>
  )
}
