'use client'

import { useT } from '@/lib/i18n/I18nProvider'

const TEAL = 'oklch(55% 0.11 193)'

export default function MarketVaultPage() {
  const t = useT()

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
        {t('partnerMarketVault.title')}
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        {t('partnerMarketVault.subtitle')}
      </p>

      {/* Coming Soon hero */}
      <div
        className="rounded-2xl p-10 text-center"
        style={{
          background:    'var(--surface-raised)',
          border:        '1px solid var(--border-subtle)',
          boxShadow:     '0 8px 32px rgba(0,0,0,0.08)',
        }}
      >
        {/* Vault icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'oklch(55% 0.11 193 / 0.1)', color: TEAL }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 7h14l-1 12H6L5 7z" />
            <path d="M9 7V5a3 3 0 0 1 6 0v2" />
            <circle cx="12" cy="13" r="2" />
          </svg>
        </div>

        {/* Coming Soon pill */}
        <span
          className="inline-block text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wider mb-4"
          style={{
            background:    'oklch(55% 0.11 193 / 0.15)',
            color:         TEAL,
            letterSpacing: '0.08em',
          }}
        >
          {t('partnerMarketVault.soonBadge')}
        </span>

        <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('partnerMarketVault.heroTitle')}
        </h2>
        <p className="text-sm max-w-md mx-auto mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('partnerMarketVault.heroBody')}
        </p>

        <div className="max-w-md mx-auto space-y-2 text-left">
          {(['feature1', 'feature2', 'feature3', 'feature4'] as const).map((key) => (
            <div key={key} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span style={{ color: TEAL, flexShrink: 0, marginTop: 2 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8l3.5 3.5L13 5" />
                </svg>
              </span>
              <span>{t(`partnerMarketVault.${key}`)}</span>
            </div>
          ))}
        </div>

        <p className="text-xs mt-6" style={{ color: 'var(--text-tertiary)' }}>
          {t('partnerMarketVault.notify')}
        </p>
      </div>
    </div>
  )
}
