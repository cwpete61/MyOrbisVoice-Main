'use client'

import { useT } from '@/lib/i18n/I18nProvider'

// Coming-soon download cards for the future native apps. Mirror the visual
// pattern used by the partner-portal's coming-soon tabs (Landing Page Builder,
// Market Vault) so tenants get a consistent "this is on the roadmap" cue.
//
// When the apps actually ship, replace each card's content with real download
// buttons (App Store / Play Store / DMG / EXE) and drop the comingSoon flag in
// SidebarNav.tsx.
export default function AppsPage() {
  const t = useT()

  const cards = [
    {
      key:     'mobile',
      title:   t('apps.mobile.title'),
      subtitle: t('apps.mobile.subtitle'),
      // Phone-shape SVG path
      icon:    'M5 2h6a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm2 11h2',
      bullets: [
        t('apps.mobile.bullet1'),
        t('apps.mobile.bullet2'),
        t('apps.mobile.bullet3'),
      ],
    },
    {
      key:     'desktop',
      title:   t('apps.desktop.title'),
      subtitle: t('apps.desktop.subtitle'),
      // Monitor + stand SVG path
      icon:    'M2 3h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm4 11h4M8 12v2',
      bullets: [
        t('apps.desktop.bullet1'),
        t('apps.desktop.bullet2'),
        t('apps.desktop.bullet3'),
      ],
    },
  ]

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('apps.title')}</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>{t('apps.subtitle')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {cards.map(card => (
          <div
            key={card.key}
            className="rounded-xl p-6 relative overflow-hidden"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
          >
            <span
              className="absolute top-4 right-4 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
              style={{ background: 'oklch(55% 0.11 193 / 0.15)', color: 'oklch(65% 0.15 193)', letterSpacing: '0.08em' }}
            >
              {t('apps.comingSoon')}
            </span>
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
              style={{ background: 'oklch(55% 0.11 193 / 0.10)', color: 'oklch(65% 0.15 193)' }}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={card.icon} />
              </svg>
            </div>
            <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{card.title}</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{card.subtitle}</p>
            <ul className="space-y-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {card.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'oklch(65% 0.15 193)' }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg p-4 text-sm" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
        {t('apps.notify')}
      </div>
    </div>
  )
}
