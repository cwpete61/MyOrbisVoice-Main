'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getTokenPayload, isAuthenticated } from '@/lib/auth'

const PUBLIC_PATHS = ['/affiliate-portal/login', '/affiliate-portal/signup']

export default function AffiliatePortalRootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) return
    if (!isAuthenticated()) {
      router.replace('/affiliate-portal/login')
      return
    }
    const payload = getTokenPayload()
    // Platform admins can view affiliate portal for support; everyone else must have affiliate role
    if (payload?.isPlatformRole) return
    if (payload?.roleKey !== 'affiliate') {
      router.replace('/dashboard')
    }
  }, [router, pathname])

  return <>{children}</>
}
