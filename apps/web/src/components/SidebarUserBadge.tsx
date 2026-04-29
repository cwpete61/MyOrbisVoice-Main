'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { getTokenPayload } from '@/lib/auth'

interface Props {
  profileHref: string
}

export function SidebarUserBadge({ profileHref }: Props) {
  const [payload, setPayload] = useState<{ email?: string; username?: string; roleKey?: string } | null>(null)

  useEffect(() => {
    setPayload(getTokenPayload() as { email?: string; username?: string; roleKey?: string } | null)
  }, [])

  const display = payload?.username ?? payload?.email ?? 'Account'
  const initials = display.slice(0, 2).toUpperCase()
  const role = payload?.roleKey?.replace(/_/g, ' ') ?? ''

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
        <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{display}</p>
        {role && <p className="text-xs truncate capitalize" style={{ color: 'var(--text-tertiary)' }}>{role}</p>}
      </div>
    </Link>
  )
}
