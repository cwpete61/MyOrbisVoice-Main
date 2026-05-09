'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiSignup, apiCreateCheckoutSession } from '@/lib/api'
import { setTokens } from '@/lib/auth'
import { PasswordInput } from '@/components/PasswordInput'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ThemeToggle } from '@/components/ThemeToggle'

function getReferralCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(/(?:^|; )ref=([^;]*)/)
  return match ? decodeURIComponent(match[1]!) : undefined
}

// Plan codes that trigger Stripe checkout immediately after signup.
// 'free' (no plan) lands on /onboarding as before.
const PAID_PLAN_CODES = new Set(['ltd', 'basic_monthly', 'pro_monthly', 'premier_monthly', 'enterprise_monthly'])

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  ltd:                'LTD',
  basic_monthly:      'Basic',
  pro_monthly:        'Pro',
  premier_monthly:    'Premier',
  enterprise_monthly: 'Enterprise',
}

function URLParamsCapture({ onCapture }: { onCapture: (refCode?: string, planCode?: string) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    const refCode  = searchParams.get('ref') ?? getReferralCookie()
    const planCode = searchParams.get('plan') ?? undefined
    onCapture(refCode, planCode)
  }, [searchParams, onCapture])
  return null
}

function SignupForm() {
  const router = useRouter()
  const t = useT()
  const { locale } = useLocale()
  const [username, setUsername] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refCode, setRefCode] = useState<string | undefined>()
  const [planCode, setPlanCode] = useState<string | undefined>()

  const isPaidPlan = !!planCode && PAID_PLAN_CODES.has(planCode)
  const planDisplayName = planCode ? (PLAN_DISPLAY_NAMES[planCode] ?? planCode) : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError(t('auth.signup.passwordTooShort')); return }
    setLoading(true)
    try {
      const result = await apiSignup(username, email, password, businessName, refCode, planCode, locale)
      setTokens(result.accessToken, result.refreshToken)

      // If a paid plan was selected, send the user to Stripe checkout immediately.
      // Otherwise, land on the onboarding checklist.
      if (isPaidPlan && planCode) {
        try {
          const checkout = await apiCreateCheckoutSession(
            result.accessToken,
            planCode,
            `${window.location.origin}/billing?checkout=success`,
            `${window.location.origin}/onboarding?checkout=canceled`,
          )
          window.location.href = checkout.url
          return
        } catch {
          // If checkout fails (e.g. plan has no Stripe price), fall through to onboarding —
          // they have an account and can hit /billing manually.
          router.push('/billing')
          return
        }
      }
      router.push('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.signup.submitError'))
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
      <Suspense fallback={null}>
        <URLParamsCapture
          onCapture={(r, p) => { setRefCode(r); setPlanCode(p) }}
        />
      </Suspense>
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
          {t('auth.signup.title')}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          {t('auth.signup.subtitle')}
        </p>

        {/* Plan banner — when arriving from a paid-plan CTA, set expectation that
            a Stripe redirect follows account creation. Without this, users would
            think they were signing up for a free trial and bounce on the redirect. */}
        {isPaidPlan && (
          <div
            className="rounded-xl p-4 mb-5"
            style={{
              background: 'oklch(55% 0.11 193 / 0.08)',
              border: '1px solid oklch(55% 0.11 193 / 0.4)',
            }}
          >
            <p className="text-sm font-semibold" style={{ color: 'oklch(45% 0.13 193)' }}>
              {planCode === 'ltd'
                ? t('auth.signup.ltdBannerTitle')
                : t('auth.signup.paidBannerTitle', { planName: planDisplayName })}
            </p>
            <p className="text-xs mt-1" style={{ color: 'oklch(45% 0.13 193)' }}>
              {planCode === 'ltd'
                ? t('auth.signup.ltdBannerBody')
                : t('auth.signup.paidBannerBody')}
            </p>
          </div>
        )}

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
          <div>
            <label className="label">{t('auth.signup.emailLabel')}</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder={t('auth.signup.emailPlaceholder')}
            />
          </div>
          <div>
            <label className="label">{t('auth.signup.passwordLabel')}</label>
            <PasswordInput
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder={t('auth.signup.passwordPlaceholder')}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
            {loading
              ? (isPaidPlan ? t('auth.signup.redirectingToCheckout') : t('auth.signup.submitting'))
              : t('auth.signup.submit')}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('auth.signup.orContinueWith')}</span>
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
              else setError(t('auth.signup.submitError'))
            } catch {
              setError(t('auth.signup.submitError'))
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
          {t('auth.signup.continueWithGoogle')}
        </button>

        <p className="text-center mt-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('auth.signup.termsPrefix')}{' '}
          <a href="https://myorbisvoice.com/terms.html" target="_blank" rel="noopener" style={{ color: 'oklch(55% 0.11 193)' }}>{t('auth.signup.termsLink')}</a>
          {' '}{t('auth.signup.termsAnd')}{' '}
          <a href="https://myorbisvoice.com/privacy.html" target="_blank" rel="noopener" style={{ color: 'oklch(55% 0.11 193)' }}>{t('auth.signup.privacyLink')}</a>.
        </p>

        <p className="text-center mt-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('auth.signup.haveAccount')}{' '}
          <Link href="/login" className="font-semibold" style={{ color: 'oklch(55% 0.11 193)' }}>
            {t('auth.signup.logIn')}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}
