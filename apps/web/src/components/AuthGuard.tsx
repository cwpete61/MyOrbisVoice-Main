'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import { OIDC_ENABLED, oidcLoginHref } from '@/hooks/useApi'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const ok = isAuthenticated()
    setAuthed(ok)
    setChecked(true)
    if (!ok) {
      // Ride the shared Keycloak session: opening the app after a Hub login
      // auto-authenticates with no second sign-in. Falls back to /login when
      // OIDC is off (local dev).
      if (OIDC_ENABLED && typeof window !== 'undefined') {
        window.location.href = oidcLoginHref(window.location.pathname + window.location.search)
      } else {
        router.replace('/login')
      }
    }
  }, [router])

  if (!checked) return null
  if (!authed) return null
  return <>{children}</>
}
