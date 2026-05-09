'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiAffiliateSignup } from '@/lib/api'
import { setTokens } from '@/lib/auth'
import { PasswordInput } from '@/components/PasswordInput'
import { PasswordRulesChecklist } from '@/components/PasswordRulesChecklist'
import { useT } from '@/lib/i18n/I18nProvider'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function AffiliateSignupPage() {
  const t = useT()
  const router = useRouter()
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await apiAffiliateSignup(
        form.username,
        form.email,
        form.password,
        form.firstName || undefined,
        form.lastName || undefined,
      )
      setTokens(result.accessToken, result.refreshToken)
      router.push('/partner-portal/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('partnerSignup.signupFailed'))
    } finally {
      setLoading(false)
    }
  }

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
            <p className="font-bold text-sm leading-none" style={{ color: 'var(--text-primary)' }}>OrbisVoice</p>
            <p className="text-xs mt-0.5" style={{ color: 'oklch(65% 0.15 193)' }}>{t('partnerSignup.brandSubtitle')}</p>
          </div>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerSignup.title')}</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            {t('partnerSignup.subtitle')}
          </p>

          {error && <div className="alert-error mb-5">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">{t('partnerSignup.firstName')}</label>
                <input type="text" autoFocus autoComplete="given-name" value={form.firstName} onChange={e => set('firstName', e.target.value)} className="input" placeholder={t('partnerSignup.firstNamePlaceholder')} />
              </div>
              <div>
                <label className="label">{t('partnerSignup.lastName')}</label>
                <input type="text" autoComplete="family-name" value={form.lastName} onChange={e => set('lastName', e.target.value)} className="input" placeholder={t('partnerSignup.lastNamePlaceholder')} />
              </div>
            </div>
            <div>
              <label className="label">{t('partnerSignup.username')} <span style={{ color: 'oklch(55% 0.15 15)' }}>*</span></label>
              <input
                type="text"
                required
                autoComplete="username"
                value={form.username}
                onChange={e => set('username', e.target.value)}
                className="input"
                placeholder={t('partnerSignup.usernamePlaceholder')}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t('partnerSignup.usernameHelp')}</p>
            </div>
            <div>
              <label className="label">{t('partnerSignup.email')} <span style={{ color: 'oklch(55% 0.15 15)' }}>*</span></label>
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className="input"
                placeholder={t('partnerSignup.emailPlaceholder')}
              />
            </div>
            <div>
              <label className="label">{t('partnerSignup.password')} <span style={{ color: 'oklch(55% 0.15 15)' }}>*</span></label>
              <PasswordInput
                required
                autoComplete="new-password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                className="input"
                placeholder={t('partnerSignup.passwordPlaceholder')}
              />
              <PasswordRulesChecklist value={form.password} />
            </div>

            <div className="pt-1">
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? t('partnerSignup.creating') : t('partnerSignup.cta')}
              </button>
            </div>
          </form>

          <p className="text-xs text-center mt-4" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerSignup.reviewNotice')}
          </p>

          <p className="text-center mt-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('partnerSignup.alreadyHave')}{' '}
            <Link href="/partner-portal/login" className="font-semibold" style={{ color: 'oklch(55% 0.11 193)' }}>
              {t('partnerSignup.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
