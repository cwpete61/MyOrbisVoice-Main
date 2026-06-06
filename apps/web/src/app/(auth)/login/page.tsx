'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiLogin } from '@/lib/api'
import { setTokens, clearTokens, isPlatformAdmin, getTokenPayload } from '@/lib/auth'
import { PasswordInput } from '@/components/PasswordInput'
import { useT } from '@/lib/i18n/I18nProvider'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function LoginPage() {
  const router = useRouter()
  const t = useT()
  const [loginId, setLoginId] = useState('')
  const [loginPw, setLoginPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Handle Google Sign-In callback redirects. The /api/auth/google/callback
  // handler sends users back here with one of three URL fragment patterns:
  //   #google=signin&at=…&rt=…   → existing user — pop tokens, log them in
  //   ?google=access_denied      → user cancelled at Google's screen
  //   ?google=error: ...         → callback error, show in the UI
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.replace(/^#/, '')
    if (hash.startsWith('google=signin&')) {
      const params = new URLSearchParams(hash.slice('google=signin&'.length))
      const at = params.get('at'); const rt = params.get('rt')
      if (at && rt) {
        setTokens(at, rt)
        // Clear the fragment so the tokens never sit in browser history.
        window.history.replaceState({}, '', window.location.pathname)
        const payload = getTokenPayload()
        if (isPlatformAdmin()) router.push('/admin')
        else if (payload?.roleKey === 'affiliate') router.push('/partner-portal/dashboard')
        else router.push('/dashboard')
        return
      }
    }
    const search = new URLSearchParams(window.location.search)
    const googleErr = search.get('google')
    if (googleErr) {
      if (googleErr === 'access_denied') setError(t('auth.googleSignIn.cancelled'))
      else setError(t('auth.googleSignIn.error'))
      // Strip the query so it doesn't persist on refresh.
      window.history.replaceState({}, '', window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    clearTokens()
    try {
      const result = await apiLogin(loginId, loginPw)
      setTokens(result.accessToken, result.refreshToken)
      const payload = getTokenPayload()
      if (isPlatformAdmin()) router.push('/admin')
      else if (payload?.roleKey === 'affiliate') router.push('/partner-portal/dashboard')
      else router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.login.invalidCreds'))
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
          {t('auth.login.title')}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          {t('auth.login.subtitle')}
        </p>

        {error && <div className="alert-error mb-5">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t('auth.login.usernameLabel')}</label>
            <input
              type="text"
              required
              autoFocus
              autoComplete="username"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="input"
              placeholder={t('auth.login.usernamePlaceholder')}
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="label" style={{ marginBottom: 0 }}>{t('auth.login.passwordLabel')}</label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium"
                style={{ color: 'oklch(55% 0.11 193)' }}
              >
                {t('auth.login.forgotShort')}
              </Link>
            </div>
            <PasswordInput
              required
              autoComplete="current-password"
              value={loginPw}
              onChange={(e) => setLoginPw(e.target.value)}
              className="input"
              placeholder={t('auth.login.passwordPlaceholder')}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
            {loading ? t('auth.login.submitting') : t('auth.login.submit')}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('auth.login.orContinueWith')}</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
        </div>

        <button
          type="button"
          onClick={async () => {
            try {
              const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'https://api.myorbisvoice.com'
              const res = await fetch(`${apiBase}/api/auth/google/start`)
              const json = await res.json() as { data?: { url?: string } }
              if (json.data?.url) window.location.href = json.data.url
              else setError(t('auth.login.invalidCreds'))
            } catch {
              setError(t('auth.login.invalidCreds'))
            }
          }}
          className="btn-ghost w-full flex items-center justify-center gap-2.5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {t('auth.login.continueWithGoogle')}
        </button>

        {process.env['NEXT_PUBLIC_OIDC_ENABLED'] === 'true' && (
          <button
            type="button"
            onClick={() => {
              const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'https://api.myorbisvoice.com'
              window.location.href = `${apiBase}/api/auth/oidc/login`
            }}
            className="btn-ghost w-full flex items-center justify-center gap-2.5 mt-3"
          >
            {t('auth.login.continueWithMyOrbis')}
          </button>
        )}

        <p className="text-center mt-5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('auth.login.noAccount')}{' '}
          <Link href="/signup" className="font-semibold" style={{ color: 'oklch(55% 0.11 193)' }}>
            {t('auth.login.signUpFree')}
          </Link>
        </p>
      </div>
    </div>
  )
}
