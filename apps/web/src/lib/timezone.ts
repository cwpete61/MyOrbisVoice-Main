'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

/**
 * User-level time-zone helpers.
 *
 * Resolution order for "what tz should we render this date in?":
 *   1. User's persisted preferredTimezone (set on the Profile page)
 *   2. Browser-detected zone via Intl.DateTimeFormat().resolvedOptions().timeZone
 *   3. 'UTC' as a last resort if Intl is unavailable
 *
 * The preference lives on User.preferredTimezone in Postgres and is loaded
 * once per session via /api/auth/me. We also cache it in localStorage so the
 * first paint after a hard reload doesn't flash the browser zone before /me
 * resolves.
 */

const STORAGE_KEY = 'orbis.userTimezone'

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function isValidIanaTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Read-only hook: returns the effective tz to use for display. */
export function useUserTimezone(): string {
  // Lazy-init from localStorage so first paint is stable across reloads.
  const [tz, setTz] = useState<string>(() => {
    if (typeof window === 'undefined') return 'UTC'
    return window.localStorage.getItem(STORAGE_KEY) || getBrowserTimezone()
  })

  useEffect(() => {
    let cancelled = false
    apiFetch<{ user: { preferredTimezone: string | null } }>('/api/auth/me')
      .then(d => {
        if (cancelled) return
        const persisted = d.user.preferredTimezone
        const effective = persisted && isValidIanaTimezone(persisted)
          ? persisted
          : getBrowserTimezone()
        setTz(effective)
        try { window.localStorage.setItem(STORAGE_KEY, effective) } catch {}
      })
      .catch(() => { /* not logged in or transient error — keep the cached/browser value */ })
    return () => { cancelled = true }
  }, [])

  return tz
}

export interface FormatOptions extends Intl.DateTimeFormatOptions {
  /** Pre-resolved tz; skip when passing a value from useUserTimezone(). */
  tz?: string
  /** BCP 47 locale (e.g. 'en-US', 'es-MX'). Defaults to the user's browser locale. */
  locale?: string
}

/**
 * Format an ISO/Date in the user's preferred zone. Prefer the hook+helper combo:
 *   const tz = useUserTimezone()
 *   formatInTimezone(email.sentAt, { tz, dateStyle: 'medium', timeStyle: 'short' })
 */
export function formatInTimezone(input: string | number | Date | null | undefined, opts: FormatOptions = {}): string {
  if (input === null || input === undefined || input === '') return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const { tz, locale, ...rest } = opts
  const effective = tz || getBrowserTimezone()
  try {
    return new Intl.DateTimeFormat(locale, { ...rest, timeZone: effective }).format(d)
  } catch {
    return d.toLocaleString(locale, rest)
  }
}
