'use client'

import { useT } from '@/lib/i18n/I18nProvider'

const TEAL = 'oklch(55% 0.11 193)'

export default function PartnerLeadsPage() {
  const t = useT()

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
        {t('partnerLeads.title')}
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        {t('partnerLeads.subtitle')}
      </p>

      {/* Coming Soon hero — mirrors the Market Vault placeholder so partners
          get a consistent "shipping soon" affordance across every coming-soon
          surface in the portal. */}
      <div
        className="rounded-2xl p-10 text-center"
        style={{
          background: 'var(--surface-raised)',
          border:     '1px solid var(--border-subtle)',
          boxShadow:  '0 8px 32px rgba(0,0,0,0.08)',
        }}
      >
        {/* Funnel icon — matches the sidebar nav icon for Leads */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'oklch(55% 0.11 193 / 0.1)', color: TEAL }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
        </div>

        <span
          className="inline-block text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wider mb-4"
          style={{
            background:    'oklch(55% 0.11 193 / 0.15)',
            color:         TEAL,
            letterSpacing: '0.08em',
          }}
        >
          {t('partnerLeads.soonBadge')}
        </span>

        <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('partnerLeads.heroTitle')}
        </h2>
        <p className="text-sm max-w-md mx-auto mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('partnerLeads.heroBody')}
        </p>

        <div className="max-w-md mx-auto space-y-2 text-left">
          {(['feature1', 'feature2', 'feature3', 'feature4'] as const).map((key) => (
            <div key={key} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span style={{ color: TEAL, flexShrink: 0, marginTop: 2 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8l3.5 3.5L13 5" />
                </svg>
              </span>
              <span>{t(`partnerLeads.${key}`)}</span>
            </div>
          ))}
        </div>

        <p className="text-xs mt-6" style={{ color: 'var(--text-tertiary)' }}>
          {t('partnerLeads.notify')}
        </p>
      </div>
    </div>
  )
}
