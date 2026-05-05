'use client'

import { useLocale, type Locale } from '@/lib/i18n/I18nProvider'

/**
 * Compact two-state pill that flips the dashboard language. Preference is
 * persisted to the user's account via PATCH /api/auth/me so it follows them
 * across devices. The full Profile → Language section remains the place to
 * read the description and confirmation toast — this is just the always-on
 * shortcut in the top bar.
 */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLocale()

  function flip() {
    const next: Locale = locale === 'en' ? 'es' : 'en'
    setLocale(next)
  }

  const otherLabel = locale === 'en' ? 'ES' : 'EN'
  const aria = locale === 'en' ? 'Cambiar a español' : 'Switch to English'

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={aria}
      title={aria}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${className}`}
      style={{
        color: 'var(--text-tertiary)',
        border: '1px solid var(--border-subtle)',
        background: 'transparent',
        letterSpacing: '0.04em',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      {otherLabel}
    </button>
  )
}
