'use client'

import { useT } from '@/lib/i18n/I18nProvider'
import {
  FRAMEWORKS,
  CIALDINI,
  VERTICALS,
  HEADLINE_FORMULAS,
  ANTI_PATTERNS,
  TIER_GUIDE,
} from '@/lib/marketingResources'

// Compact in-app cheat sheet of docs/marketing-style-guide.md.
// Tenants land here from the sidebar when they want a quick reference while
// writing campaign copy. Source of truth is the doc; this page is a
// rendered subset focused on operational decisions ("which framework
// matches my situation? what's a hook for the dental vertical?").

export default function MarketingResourcesPage() {
  const t = useT()

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {t('marketingResources.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('marketingResources.subtitle')}
        </p>
      </div>

      {/* Aggression Tier reference */}
      <Section
        eyebrow={t('marketingResources.tiers.eyebrow')}
        title={t('marketingResources.tiers.title')}
        description={t('marketingResources.tiers.description')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TIER_GUIDE.map((tier) => (
            <div
              key={tier.tier}
              className="rounded-lg p-4"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                {tier.label}
              </p>
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                {tier.bestFor}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {tier.voice}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Frameworks */}
      <Section
        eyebrow={t('marketingResources.frameworks.eyebrow')}
        title={t('marketingResources.frameworks.title')}
        description={t('marketingResources.frameworks.description')}
      >
        <div className="space-y-3">
          {FRAMEWORKS.map((f) => (
            <div
              key={f.id}
              className="rounded-lg overflow-hidden"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="px-4 py-3 flex items-baseline justify-between gap-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <span className="text-sm font-semibold mr-2" style={{ color: 'var(--text-primary)' }}>
                    {f.name}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {f.fullName}
                  </span>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider flex-shrink-0"
                  style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}
                >
                  {f.tier === 'all' ? t('marketingResources.frameworks.tierAll') : f.tier}
                </span>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {f.oneLiner}
                </p>
                <ol className="text-xs space-y-1 ml-4 list-decimal" style={{ color: 'var(--text-tertiary)' }}>
                  {f.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <p className="text-[11px] mt-3" style={{ color: 'var(--text-tertiary)' }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>{t('marketingResources.frameworks.bestFor')}:</strong> {f.bestFor}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Cialdini's 7 */}
      <Section
        eyebrow={t('marketingResources.cialdini.eyebrow')}
        title={t('marketingResources.cialdini.title')}
        description={t('marketingResources.cialdini.description')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CIALDINI.map((p, i) => (
            <div
              key={p.id}
              className="rounded-lg p-4"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                {i + 1}. {p.name}
              </p>
              <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                {p.oneLiner}
              </p>
              <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                {p.example}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Headline formulas */}
      <Section
        eyebrow={t('marketingResources.headlines.eyebrow')}
        title={t('marketingResources.headlines.title')}
        description={t('marketingResources.headlines.description')}
      >
        <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-raised)' }}>
                <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('marketingResources.headlines.colPattern')}</th>
                <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('marketingResources.headlines.colExample')}</th>
                <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{t('marketingResources.headlines.colBest')}</th>
              </tr>
            </thead>
            <tbody>
              {HEADLINE_FORMULAS.map((f, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'var(--surface-app)' : 'var(--surface-raised)', borderTop: '1px solid var(--border-subtle)' }}>
                  <td className="px-3 py-2 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{f.pattern}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>{f.example}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{f.best}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Per-vertical */}
      <Section
        eyebrow={t('marketingResources.verticals.eyebrow')}
        title={t('marketingResources.verticals.title')}
        description={t('marketingResources.verticals.description')}
      >
        <div className="space-y-3">
          {VERTICALS.map((v) => (
            <div
              key={v.id}
              className="rounded-lg overflow-hidden"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="px-4 py-3 flex items-baseline justify-between gap-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {v.label}
                </p>
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider"
                  style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}
                >
                  {t('marketingResources.verticals.recommended')}: {v.recommendedTier}
                </span>
              </div>
              <div className="px-4 py-3 space-y-2">
                <Row label={t('marketingResources.verticals.hook')}  value={v.hook} />
                <Row label={t('marketingResources.verticals.pain')}  value={v.pain} />
                <Row label={t('marketingResources.verticals.offer')} value={v.offer} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Anti-patterns */}
      <Section
        eyebrow={t('marketingResources.antiPatterns.eyebrow')}
        title={t('marketingResources.antiPatterns.title')}
        description={t('marketingResources.antiPatterns.description')}
      >
        <div className="space-y-3">
          {ANTI_PATTERNS.map((a, i) => (
            <div
              key={i}
              className="rounded-lg p-4"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
            >
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                {a.pattern}
              </p>
              <p className="text-xs mb-1" style={{ color: 'oklch(60% 0.20 25)' }}>
                ✗ {a.badExample}
              </p>
              <p className="text-xs mb-2" style={{ color: 'oklch(55% 0.18 145)' }}>
                ✓ {a.fixedExample}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>{t('marketingResources.antiPatterns.why')}:</strong> {a.why}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Footer note */}
      <div
        className="rounded-lg p-4 mb-8"
        style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
      >
        <p className="text-xs">
          {t('marketingResources.footer')}
        </p>
      </div>
    </div>
  )
}

function Section({
  eyebrow, title, description, children,
}: {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--brand-500)', letterSpacing: '0.08em' }}>
          {eyebrow}
        </p>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      </div>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <span className="font-semibold mr-2" style={{ color: 'var(--text-tertiary)' }}>{label}:</span>
      <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
    </div>
  )
}
