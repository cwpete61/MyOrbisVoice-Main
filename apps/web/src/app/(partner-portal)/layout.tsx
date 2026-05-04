'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'

const PUBLIC_PATHS = ['/partner-portal/login', '/partner-portal/signup']

/**
 * Partner-portal auth guard.
 *
 * Behavior:
 * - Public paths (login, signup) — always allowed
 * - Unauthenticated user — bounced to /partner-portal/login
 * - Authenticated user (any role) — allowed through, regardless of whether
 *   they currently have an AffiliateAccount.
 *
 * Why so permissive: a single user can be BOTH a tenant owner AND a partner
 * (referring others while running their own business). The dashboard page
 * itself handles the "no AffiliateAccount yet" case by showing an "Apply
 * to become a partner" CTA, so we don't need to block at the route level.
 *
 * This was previously gated on roleKey==='affiliate', which redirected
 * tenant users back to /dashboard when they clicked any partner-portal
 * link. That caused the sidebar to feel like it was kicking the user out.
 */
export default function PartnerPortalRootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) return
    if (!isAuthenticated()) {
      router.replace('/partner-portal/login')
    }
    // Note: no role-based redirect. Any authenticated user can navigate
    // within the partner portal. The dashboard handles "no account yet"
    // gracefully by showing an apply CTA.
  }, [router, pathname])

  return <>{children}</>
}
