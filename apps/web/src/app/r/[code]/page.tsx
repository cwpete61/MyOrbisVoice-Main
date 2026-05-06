'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL ?? ''
// Marketing site lives at the apex domain; the app lives at app.myorbisvoice.com.
// Visitors clicking a partner link should land on the marketing home so they
// learn about the product first, then convert via the marketing CTA.
const MARKETING_HOME = 'https://myorbisvoice.com/'

export default function ReferralRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = params.code as string

  useEffect(() => {
    if (!code) { window.location.replace(MARKETING_HOME); return }

    async function run() {
      // Fetch cookie duration AND resolve slug → parent referralCode in
      // parallel. Custom slugs are case-insensitive; primary referral codes
      // are uppercase hex.
      let cookieDays = 30
      let resolvedCode = code
      try {
        const [settingsRes, resolveRes] = await Promise.all([
          fetch(`${API}/api/public/affiliate/settings`),
          fetch(`${API}/api/public/affiliate/resolve?code=${encodeURIComponent(code)}`),
        ])
        const settingsJson = await settingsRes.json() as { data?: { cookieDurationDays?: number } }
        cookieDays = settingsJson.data?.cookieDurationDays ?? 30
        if (resolveRes.ok) {
          const resolveJson = await resolveRes.json() as { data?: { referralCode?: string } }
          if (resolveJson.data?.referralCode) resolvedCode = resolveJson.data.referralCode
        }
      } catch { /* use defaults — cookie still set with input code */ }

      // Set referral cookie using the parent referralCode so signup
      // attribution finds the right affiliate even when the visitor came in
      // through a custom slug. Scope the cookie to the apex domain so it's
      // shared between myorbisvoice.com (marketing) and app.myorbisvoice.com
      // (signup) — the visitor lands on marketing, browses, then jumps to
      // signup, and the cookie has to survive that subdomain hop.
      const expires = new Date(Date.now() + cookieDays * 86400_000).toUTCString()
      const domainAttr = window.location.hostname.endsWith('myorbisvoice.com')
        ? '; Domain=.myorbisvoice.com'
        : ''
      document.cookie = `ref=${encodeURIComponent(resolvedCode)}; expires=${expires}; path=/${domainAttr}; SameSite=Lax`

      // Fire click tracking (best-effort) using the original input — backend
      // resolver records customLinkId when applicable so per-slug stats roll
      // up correctly.
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

      // Redirect — partner can override the destination via ?redirect=
      // (relative path stays inside the app; absolute URL goes wherever).
      // Default lands the visitor on the marketing home so they learn about
      // the product before they're asked to sign up. Carry ?ref= in the URL
      // as a backup signal in case cookies are blocked.
      const override = searchParams.get('redirect')
      if (override) {
        const isAbsolute = /^https?:\/\//i.test(override)
        const url = new URL(override, window.location.origin)
        url.searchParams.set('ref', resolvedCode)
        if (isAbsolute) window.location.replace(url.toString())
        else router.replace(url.pathname + url.search)
        return
      }
      const home = new URL(MARKETING_HOME)
      home.searchParams.set('ref', resolvedCode)
      window.location.replace(home.toString())
    }

    run()
  }, [code, router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-app)' }}>
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto"
          style={{ borderColor: 'oklch(72% 0.12 193)', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Setting up your referral…</p>
      </div>
    </div>
  )
}
