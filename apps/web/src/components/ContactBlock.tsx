'use client'

import { useT } from '@/lib/i18n/I18nProvider'

/**
 * Reusable "need help, here are our emails" block. Used at the bottom of
 * tenant /help articles, admin help articles, and the partner-portal footer
 * so customers always have a path to reach us.
 *
 * General inbox = admin@myorbisvoice.com (sales / billing / general).
 * Support inbox = support@myorbisvoice.com (technical / how-do-I).
 *
 * `compact` = single-line variant for footers; default = card variant for
 * help-article bottoms.
 */
export function ContactBlock({ compact = false }: { compact?: boolean }) {
  const t = useT()

  if (compact) {
    return (
      <div className="text-xs flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'var(--text-tertiary)' }}>
        <span>{t('contact.compact.label')}</span>
        <a href="mailto:admin@myorbisvoice.com" className="font-medium" style={{ color: 'var(--text-secondary)' }}>
          admin@myorbisvoice.com
        </a>
        <a href="mailto:support@myorbisvoice.com" className="font-medium" style={{ color: 'var(--text-secondary)' }}>
          support@myorbisvoice.com
        </a>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-5 mt-6"
      style={{
        background: 'var(--surface-overlay)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {t('contact.card.title')}
      </p>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        {t('contact.card.subtitle')}
      </p>
      <div className="flex flex-col gap-2 text-sm">
        <div>
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{t('contact.card.generalLabel')}: </span>
          <a href="mailto:admin@myorbisvoice.com" style={{ color: 'oklch(55% 0.11 193)' }}>
            admin@myorbisvoice.com
          </a>
        </div>
        <div>
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{t('contact.card.supportLabel')}: </span>
          <a href="mailto:support@myorbisvoice.com" style={{ color: 'oklch(55% 0.11 193)' }}>
            support@myorbisvoice.com
          </a>
        </div>
      </div>
    </div>
  )
}
