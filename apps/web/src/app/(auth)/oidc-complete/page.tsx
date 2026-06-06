'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setTokens, isPlatformAdmin, getTokenPayload } from '@/lib/auth'

/**
 * Phase 2.4 — OIDC completion landing. The Voice api OIDC callback redirects here
 * with the session tokens in the URL fragment (#access_token=..&refresh_token=..).
 * We persist them (same store as normal login) and route by role. The fragment is
 * never sent to the server and is wiped from history immediately.
 */
export default function OidcCompletePage() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken) {
      router.replace('/login?error=oidc')
      return
    }
    setTokens(accessToken, refreshToken)
    window.history.replaceState(null, '', '/oidc-complete')

    const payload = getTokenPayload()
    if (isPlatformAdmin()) router.replace('/admin')
    else if (payload?.roleKey === 'affiliate') router.replace('/partner-portal/dashboard')
    else router.replace('/dashboard')
  }, [router])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div
        role="status"
        style={{
          width: 28,
          height: 28,
          border: '3px solid var(--border-subtle)',
          borderTopColor: 'oklch(55% 0.11 193)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
