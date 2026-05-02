'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

type Subscription = {
  status: string
  plan?: { code: string; name: string } | null
} | null

// All tiers use the brand turquoise/teal palette (hue 193). Intensity scales with tier.
const TIER_STYLE: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  free:               { bg: 'oklch(95% 0.04 193 / 0.5)',    text: 'oklch(40% 0.09 193)',  ring: 'oklch(80% 0.07 193)',  label: 'Free' },
  basic_monthly:      { bg: 'oklch(94% 0.07 193 / 0.7)',    text: 'oklch(38% 0.11 193)',  ring: 'oklch(72% 0.10 193)',  label: 'Basic' },
  pro_monthly:        { bg: 'oklch(90% 0.10 193 / 0.8)',    text: 'oklch(35% 0.13 193)',  ring: 'oklch(60% 0.13 193)',  label: 'Pro' },
  premier_monthly:    { bg: 'oklch(82% 0.13 193 / 0.85)',   text: 'oklch(20% 0.04 193)',  ring: 'oklch(50% 0.14 193)',  label: 'Premier' },
  enterprise_monthly: { bg: 'oklch(70% 0.14 193)',          text: 'oklch(15% 0.02 193)',  ring: 'oklch(40% 0.13 193)',  label: 'Enterprise' },
  ltd:                { bg: 'oklch(55% 0.13 193)',          text: 'oklch(98% 0.01 193)',  ring: 'oklch(30% 0.10 193)',  label: 'LTD' },
}

const FALLBACK = TIER_STYLE['free']!

export function TierBadge() {
  const [tier, setTier] = useState<{ code: string; status: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<Subscription>('/api/billing/subscription')
      .then(sub => {
        // No active sub → show Free tier (every tenant gets free entitlements on signup)
        if (!sub || !sub.plan || sub.status !== 'ACTIVE') {
          setTier({ code: 'free', status: 'ACTIVE' })
        } else {
          setTier({ code: sub.plan.code, status: sub.status })
        }
        setLoading(false)
      })
      .catch(() => {
        setTier({ code: 'free', status: 'ACTIVE' })
        setLoading(false)
      })
  }, [])

  if (loading || !tier) return null

  const style = TIER_STYLE[tier.code] ?? FALLBACK
  const isPaid = tier.code !== 'free'

  return (
    <a
      href="/billing"
      title={`Current plan: ${style.label}${isPaid ? '' : ' — click to upgrade'}`}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors"
      style={{
        background: style.bg,
        border: `1px solid ${style.ring}`,
        color: style.text,
        textDecoration: 'none',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6l3 4 3-7 3 7 3-4-1 8H3z" />
      </svg>
      <span className="text-xs font-semibold tracking-wide">{style.label}</span>
    </a>
  )
}
