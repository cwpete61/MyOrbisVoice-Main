'use client'

import { useLocale } from '@/lib/i18n/I18nProvider'

/**
 * Marketing Strategy sub-tab of the Inbound Evaluation campaign. Placeholder for
 * now — the marketing material (social posts, angles, outreach sequence) follows.
 */
export function MarketingStrategy() {
  const { locale } = useLocale()
  const L: 'en' | 'es' = locale === 'es' ? 'es' : 'en'
  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {L === 'es' ? 'Estrategia de marketing' : 'Marketing Strategy'}
        </h2>
        <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          {L === 'es'
            ? 'El material de marketing de esta campaña irá aquí — publicaciones sociales, ángulos, secuencia de prospección y plantillas.'
            : 'Marketing material for this campaign goes here — social posts, angles, outreach sequence, and templates.'}
        </p>
      </div>
      <div className="rounded-xl p-10 text-center text-sm" style={{ border: '1px dashed var(--border-subtle)', color: 'var(--text-tertiary)' }}>
        {L === 'es' ? 'Contenido próximamente.' : 'Content coming soon.'}
      </div>
    </div>
  )
}
