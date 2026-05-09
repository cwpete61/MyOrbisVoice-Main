'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { setTokens, isPlatformAdmin, getTokenPayload } from '@/lib/auth'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ThemeToggle } from '@/components/ThemeToggle'

// Reached after a new user completes Google OAuth and we don't yet have a
// User row matched. The /api/auth/google/callback handler 302'd here with a
// short-lived pending-profile JWT in the URL fragment containing the verified
// Google profile (email, googleId, firstName, lastName).
//
// We collect the two fields Google can't give us — username + business name
// — and POST to /api/auth/google/finish-profile to create the User + Tenant.

function FinishProfileInner() {
  const router = useRouter()
  const t = useT()
  const { locale } = useLocale()

  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [tokenError,   setTokenError]   = useState<string>('')
  const [username,     setUsername]     = useState('')
  const [businessName, setBusinessName] = useState('')
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.replace(/^#/, '')
    if (hash.startsWith('google=new&')) {
      const params = new URLSearchParams(hash.slice('google=new&'.length))
      const pt = params.get('pt')
      if (pt) {
        setPendingToken(pt)
        // Strip the fragment so the token doesn't sit in browser history.
        window.history.replaceState({}, '', window.location.pathname)
        return
      }
    }
    setTokenError(t('auth.finishProfile.missingTokenError'))
  }, [t])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!pendingToken) { setError(t('auth.finishProfile.missingTokenError')); return }
    setLoading(true)
    try {
      const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'https://api.myorbisvoice.com'
      const res = await fetch(`${apiBase}/api/auth/google/finish-profile`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pendingToken, username, businessName, preferredLocale: locale }),
      })
      const body = await res.json() as { data?: { accessToken?: string; refreshToken?: string }; errors?: Array<{ message?: string; fieldErrors?: Record<string, string[]> }> }
      if (!res.ok) {
        const err = body.errors?.[0]
        if (err?.fieldErrors) {
          const lines: string[] = []
          for (const [field, msgs] of Object.entries(err.fieldErrors)) {
            for (const m of msgs) lines.push(`${field}: ${m}`)
          }
          throw new Error(lines.join(' • '))
        }
        throw new Error(err?.message ?? 'Request failed')
      }
      const { accessToken, refreshToken } = body.data ?? {}
      if (!accessToken || !refreshToken) throw new Error('No tokens in response')
      setTokens(accessToken, refreshToken)
      const payload = getTokenPayload()
      if (isPlatformAdmin()) router.push('/admin')
      else if (payload?.roleKey === 'affiliate') router.push('/partner-portal/dashboard')
      else router.push('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.finishProfile.submitError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 relative"
      style={{ background: 'var(--surface-app)' }}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-7">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'oklch(55% 0.11 193)' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="3.5" fill="oklch(10% 0.01 193)" />
              <circle cx="9" cy="9" r="7.5" stroke="oklch(10% 0.01 193)" strokeOpacity="0.45" strokeWidth="2" />
            </svg>
          </div>
          <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>MyOrbisVoice</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: 'var(--text-primary)' }}>
          {t('auth.finishProfile.title')}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          {t('auth.finishProfile.subtitle')}
        </p>

        {tokenError ? (
          <>
            <div className="alert-error mb-5">{tokenError}</div>
            <Link href="/signup" className="text-sm font-medium" style={{ color: 'oklch(55% 0.11 193)' }}>
              {t('auth.finishProfile.startOver')}
            </Link>
          </>
        ) : (
          <>
            {error && <div className="alert-error mb-5">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">{t('auth.signup.usernameLabel')}</label>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  placeholder={t('auth.signup.usernamePlaceholder')}
                />
              </div>
              <div>
                <label className="label">{t('auth.signup.businessNameLabel')}</label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="input"
                  placeholder={t('auth.signup.businessNamePlaceholder')}
                />
              </div>
              <button type="submit" disabled={loading || !pendingToken} className="btn-primary w-full mt-1">
                {loading ? t('auth.finishProfile.submitting') : t('auth.finishProfile.submit')}
              </button>
            </form>

            <p className="text-center mt-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('auth.signup.termsPrefix')}{' '}
              <a href="https://myorbisvoice.com/terms.html" target="_blank" rel="noopener" style={{ color: 'oklch(55% 0.11 193)' }}>{t('auth.signup.termsLink')}</a>
              {' '}{t('auth.signup.termsAnd')}{' '}
              <a href="https://myorbisvoice.com/privacy.html" target="_blank" rel="noopener" style={{ color: 'oklch(55% 0.11 193)' }}>{t('auth.signup.privacyLink')}</a>.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function FinishProfilePage() {
  return (
    <Suspense fallback={null}>
      <FinishProfileInner />
    </Suspense>
  )
}
