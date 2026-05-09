'use client'

import Link from 'next/link'
import { useApi } from '@/hooks/useApi'
import { getTokenPayload } from '@/lib/auth'

interface Props {
  profileHref: string
}

interface MeResponse {
  user: {
    username:  string
    email:     string
    firstName: string | null
    lastName:  string | null
  }
}

// Sidebar identity badge for the tenant dashboard. Fetches from /api/auth/me
// because the JWT only carries email + roleKey — not username or first/last
// name. Mirrors the partner-portal layout pattern (a98f27d).
//
// What renders:
//   - Avatar circle with the first 2 chars of username (uppercased)
//   - Username (primary, bold)
//   - Full name "Firstname Lastname" if set (secondary, smaller)
//   - Role pulled from the JWT (e.g. "tenant owner") if available
//   - Whole row is clickable → navigates to the profile page

export function SidebarUserBadge({ profileHref }: Props) {
  const { data: me } = useApi<MeResponse>('/api/auth/me')
  const username = me?.user?.username
  const fullName = [me?.user?.firstName, me?.user?.lastName].filter(Boolean).join(' ').trim() || null

  // Role display still comes from the JWT — /api/auth/me returns memberships
  // (a list) rather than a single roleKey, so the JWT's roleKey is the
  // simplest source for "what role is this session signed in as."
  const tokenPayload = typeof window !== 'undefined'
    ? (getTokenPayload() as { roleKey?: string } | null)
    : null
  const role = tokenPayload?.roleKey?.replace(/_/g, ' ') ?? ''

  // Display fallback chain: username > email > 'Account'. Initials use the
  // same chain so they match what the user sees as the primary label.
  const display  = username ?? me?.user?.email ?? 'Account'
  const initials = display.slice(0, 2).toUpperCase()

  return (
    <Link
      href={profileHref}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors w-full mb-1"
      style={{ color: 'var(--text-secondary)' }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
        style={{ background: 'oklch(55% 0.11 193 / 0.18)', color: 'oklch(72% 0.12 193)' }}
      >
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{display}</p>
        {fullName && <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>{fullName}</p>}
        {!fullName && role && <p className="text-xs truncate capitalize" style={{ color: 'var(--text-tertiary)' }}>{role}</p>}
      </div>
    </Link>
  )
}
