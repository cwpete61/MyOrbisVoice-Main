'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiLogin } from '@/lib/api'
import { setTokens, clearTokens, getTokenPayload } from '@/lib/auth'
import { PasswordInput } from '@/components/PasswordInput'
import { useT } from '@/lib/i18n/I18nProvider'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function AffiliateLoginPage() {
  const t = useT()
  const router = useRouter()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // New model: the hub (products.myorbisresults.com) is the single front door.
  // Partners log in there, then enter the portal from their dashboard via SSO.
  useEffect(() => {
    if (typeof window !== 'undefined') window.location.replace('https://products.myorbisresults.com/dashboard')
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    clearTokens()
    try {
      const result = await apiLogin(loginId, password)
      setTokens(result.accessToken, result.refreshToken)
      const payload = getTokenPayload()
      if (payload?.roleKey === 'affiliate' || payload?.isPlatformRole) {
        router.push('/partner-portal/dashboard')
      } else {
        setError(t('partnerLogin.notPartnerAccount'))
        clearTokens()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('partnerLogin.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  // Funnelling to the hub — don't flash the legacy partner login form.
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative" style={{ background: 'var(--surface-app)' }}>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'oklch(55% 0.11 193)' }}>
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="3.5" fill="oklch(10% 0.01 193)" />
              <circle cx="9" cy="9" r="7.5" stroke="oklch(10% 0.01 193)" strokeOpacity="0.45" strokeWidth="2" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm leading-none" style={{ color: 'var(--text-primary)' }}>MyOrbisVoice</p>
            <p className="text-xs mt-0.5" style={{ color: 'oklch(65% 0.15 193)' }}>{t('partnerLogin.brandSubtitle')}</p>
          </div>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerLogin.title')}</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{t('partnerLogin.subtitle')}</p>

          {error && <div className="alert-error mb-5">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('partnerLogin.usernameOrEmail')}</label>
              <input
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                className="input"
                placeholder={t('partnerLogin.usernameOrEmailPlaceholder')}
              />
            </div>
            <div>
              <label className="label flex items-center justify-between">
                <span>{t('partnerLogin.password')}</span>
                <Link href="/forgot-password" className="font-normal" style={{ color: 'oklch(55% 0.11 193)' }}>
                  {t('partnerLogin.forgot')}
                </Link>
              </label>
              <PasswordInput
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder={t('partnerLogin.passwordPlaceholder')}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
              {loading ? t('partnerLogin.signingIn') : t('partnerLogin.cta')}
            </button>
          </form>

          <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerLogin.newPartner')}{' '}
            <Link href="/partner-portal/signup" className="font-semibold" style={{ color: 'oklch(55% 0.11 193)' }}>
              {t('partnerLogin.createAccount')}
            </Link>
          </p>
          <p className="text-center mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerLogin.notPartnerLine')}{' '}
            <Link href="/login" style={{ color: 'oklch(55% 0.11 193)' }}>
              {t('partnerLogin.signInMainApp')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
