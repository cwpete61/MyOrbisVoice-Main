'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function ReferralRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = params.code as string

  useEffect(() => {
    if (!code) { router.replace('/signup'); return }

    async function run() {
      // Fetch cookie duration from public settings
      let cookieDays = 30
      try {
        const res = await fetch(`${API}/api/public/affiliate/settings`)
        const json = await res.json() as { data?: { cookieDurationDays?: number } }
        cookieDays = json.data?.cookieDurationDays ?? 30
      } catch { /* use default */ }

      // Set referral cookie
      const expires = new Date(Date.now() + cookieDays * 86400_000).toUTCString()
      document.cookie = `ref=${encodeURIComponent(code)}; expires=${expires}; path=/; SameSite=Lax`

      // Fire click tracking (best-effort)
      const sessionId = crypto.randomUUID()
      fetch(`${API}/api/public/track/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref:         code,
          sessionId,
          landingPath: window.location.pathname,
          referrer:    document.referrer || undefined,
        }),
      }).catch(() => {})

      // Redirect to signup carrying the code in the URL too
      const dest = searchParams.get('redirect') ?? '/signup'
      const url = new URL(dest, window.location.origin)
      url.searchParams.set('ref', code)
      router.replace(url.pathname + url.search)
    }

    run()
  }, [code, router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base, #0a0a0a)' }}>
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto"
          style={{ borderColor: 'oklch(72% 0.12 193)', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary, #888)' }}>Setting up your referral…</p>
      </div>
    </div>
  )
}
