'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

type Subscription = {
  status: string
  plan?: { code: string; name: string } | null
} | null

const TIER_STYLE: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  free:               { bg: 'oklch(95% 0.02 270 / 0.5)',    text: 'oklch(40% 0.02 270)',  ring: 'oklch(85% 0.02 270)',  label: 'Free' },
  basic_monthly:      { bg: 'oklch(96% 0.06 220 / 0.6)',    text: 'oklch(40% 0.15 220)',  ring: 'oklch(80% 0.10 220)',  label: 'Basic' },
  pro_monthly:        { bg: 'oklch(95% 0.07 145 / 0.6)',    text: 'oklch(40% 0.15 145)',  ring: 'oklch(75% 0.12 145)',  label: 'Pro' },
  premier_monthly:    { bg: 'oklch(94% 0.08 60 / 0.6)',     text: 'oklch(40% 0.16 60)',   ring: 'oklch(78% 0.14 60)',   label: 'Premier' },
  enterprise_monthly: { bg: 'oklch(93% 0.06 320 / 0.6)',    text: 'oklch(40% 0.18 320)',  ring: 'oklch(75% 0.14 320)',  label: 'Enterprise' },
  ltd:                { bg: 'oklch(94% 0.10 80 / 0.7)',     text: 'oklch(35% 0.18 80)',   ring: 'oklch(72% 0.16 80)',   label: 'LTD' },
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
