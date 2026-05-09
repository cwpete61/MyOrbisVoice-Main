'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiResetPassword } from '@/lib/api'
import { PasswordInput } from '@/components/PasswordInput'
import { useT } from '@/lib/i18n/I18nProvider'
import { LanguageToggle } from '@/components/LanguageToggle'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  )
}

function ResetPasswordInner() {
  const t = useT()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!token) {
      setError(t('auth.reset.missingTokenError'))
      return
    }
    if (newPw !== confirmPw) {
      setError(t('auth.reset.mismatchError'))
      return
    }
    setSubmitting(true)
    try {
      await apiResetPassword(token, newPw)
      setDone(true)
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

        {done ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: 'var(--text-primary)' }}>
              {t('auth.reset.successTitle')}
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              {t('auth.reset.successBody')}
            </p>
            <Link href="/login" className="btn-primary w-full inline-flex items-center justify-center">
              {t('auth.reset.goToLogin')}
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: 'var(--text-primary)' }}>
              {t('auth.reset.title')}
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              {t('auth.reset.subtitle')}
            </p>

            {error && <div className="alert-error mb-5">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">{t('auth.reset.newPasswordLabel')}</label>
                <PasswordInput
                  required
                  autoFocus
                  autoComplete="new-password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="input"
                  placeholder={t('auth.reset.newPasswordPlaceholder')}
                  minLength={8}
                />
              </div>
              <div>
                <label className="label">{t('auth.reset.confirmPasswordLabel')}</label>
                <PasswordInput
                  required
                  autoComplete="new-password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="input"
                  placeholder={t('auth.reset.newPasswordPlaceholder')}
                  minLength={8}
                />
              </div>
              <button type="submit" disabled={submitting || !token} className="btn-primary w-full mt-1">
                {submitting ? t('auth.reset.submitting') : t('auth.reset.submit')}
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
