'use client'

import { useT } from '@/lib/i18n/I18nProvider'

const TEAL = 'oklch(55% 0.11 193)'

export default function BulkEmailPage() {
  const t = useT()

  const steps = ['step1', 'step2', 'step3'] as const

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {t('bulkEmail.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('bulkEmail.subtitle')}
        </p>
      </div>

      {/* Separate from the Mailbox */}
      <section
        className="rounded-xl p-4"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          {t('bulkEmail.whatTitle')}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('bulkEmail.whatBody')}
        </p>
      </section>

      {/* Setup */}
      <section
        className="rounded-xl p-4"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          {t('bulkEmail.setupTitle')}
        </p>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('bulkEmail.setupBody')}
        </p>
        <ol className="space-y-2">
          {steps.map((key, i) => (
            <li key={key} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-semibold flex items-center justify-center"
                style={{ background: 'oklch(55% 0.11 193 / 0.14)', color: TEAL }}
              >
                {i + 1}
              </span>
              <span style={{ lineHeight: 1.5 }}>{t(`bulkEmail.${key}`)}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4">
          <button
            disabled
            className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
            style={{ background: TEAL, color: 'white' }}
          >
            {t('bulkEmail.setupCta')}
          </button>
          <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
            {t('bulkEmail.ctaNote')}
          </p>
        </div>
      </section>

      {/* Compliance */}
      <section
        className="rounded-xl p-4"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          {t('bulkEmail.rulesTitle')}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('bulkEmail.rulesBody')}
        </p>
      </section>
    </div>
  )
}
