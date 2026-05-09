'use client'

import { useState } from 'react'
import Link from 'next/link'
import { apiForgotPassword } from '@/lib/api'
import { useT } from '@/lib/i18n/I18nProvider'
import { LanguageToggle } from '@/components/LanguageToggle'

export default function ForgotPasswordPage() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await apiForgotPassword(email.trim())
      // API always returns success-shaped to defend against enumeration —
      // we render the same "check your email" view either way.
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 relative"
      style={{ background: 'var(--surface-app)' }}
    >
      <div className="absolute top-4 right-4">
        <LanguageToggle />
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

        {submitted ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: 'var(--text-primary)' }}>
              {t('auth.forgot.successTitle')}
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              {t('auth.forgot.successBody')}
            </p>
            <Link href="/login" className="text-sm font-medium" style={{ color: 'oklch(55% 0.11 193)' }}>
              {t('auth.forgot.backToLogin')}
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: 'var(--text-primary)' }}>
              {t('auth.forgot.title')}
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              {t('auth.forgot.subtitle')}
            </p>

            {error && <div className="alert-error mb-5">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">{t('auth.forgot.emailLabel')}</label>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder={t('auth.forgot.emailPlaceholder')}
                />
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full mt-1">
                {submitting ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm font-medium" style={{ color: 'oklch(55% 0.11 193)' }}>
                {t('auth.forgot.backToLogin')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
