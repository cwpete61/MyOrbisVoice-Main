'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'

const TEAL = 'oklch(55% 0.11 193)'

// The 3 voice variations live at myorbisvoice.com/p/sample/voice-{n}/ (and
// /es/p/sample/voice-{n}/). Each one is a different persuasion angle on the
// same product — partners pick whichever resonates with their audience. The
// `sample` slug aliases to whichever partner is showing it (see the widget
// init in the static HTML), so the previews work for every partner today.
const VARIATIONS = [
  { n: 1, key: 'voice1' },
  { n: 2, key: 'voice2' },
  { n: 3, key: 'voice3' },
] as const

type VariationKey = (typeof VARIATIONS)[number]['key']

export default function LandingPagePage() {
  const t = useT()
  const { locale } = useLocale()
  const [partnerInfo, setPartnerInfo] = useState<{ slug: string | null; partnerPageActive: boolean } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  // Phase E.15 — per-variation analytics
  type StatsResp = {
    totalVisits:        number
    totalConversations: number
    variations:         Array<{ variation: number; visits: number }>
  }
  const [stats, setStats] = useState<StatsResp | null>(null)

  useEffect(() => {
    apiFetch<{ partner: { slug: string | null; partnerPageActive: boolean } }>('/api/partner/me')
      .then(d => setPartnerInfo({
        slug:              d.partner.slug,
        partnerPageActive: d.partner.partnerPageActive,
      }))
      .catch(() => setPartnerInfo({ slug: null, partnerPageActive: false }))
    apiFetch<StatsResp>('/api/partner/landing-page-stats')
      .then(setStats)
      .catch(() => { /* non-fatal; stats just won't render */ })
  }, [])

  // URL builder — picks /es/ when the locale is Spanish so the preview matches
  // what the partner's prospects will see in their language. When the partner
  // has activated their page, prefer their per-partner URL (generated via
  // `pnpm generate:partner-pages` + the deploy script). Inactive or no-slug
  // partners preview the canonical sample page until they activate.
  function urlFor(n: number, slug: string | null, isActive: boolean): string {
    const prefix = locale === 'es' ? '/es' : ''
    const effectiveSlug = isActive && slug ? slug : 'sample'
    return `https://myorbisvoice.com${prefix}/p/${effectiveSlug}/voice-${n}/`
  }

  async function copyUrl(url: string, key: VariationKey) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch { /* clipboard blocked — ignore */ }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
        {t('partnerLandingPage.variationsTitle')}
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        {t('partnerLandingPage.variationsSubtitle')}
      </p>

      {/* Activation banner — surfaces when the partner page is OFF, since
          the preview links still work but the per-partner widget routing
          won't fire until they activate. */}
      {partnerInfo && !partnerInfo.partnerPageActive && (
        <div className="rounded-xl p-4 mb-6 text-sm" style={{
          background: 'oklch(96% 0.05 80)',
          border:     '1px solid oklch(80% 0.13 80)',
          color:      'oklch(40% 0.13 60)',
        }}>
          <strong>{t('partnerLandingPage.notActiveTitle')}</strong> {t('partnerLandingPage.notActiveBody')}
        </div>
      )}

      {/* Phase E.15 — totals strip. Renders only when there are recorded
          visits, so a brand-new partner doesn't see "0 visits, 0%" and feel
          like the system is broken. Conversion rate is total convos ÷ total
          visits; per-variation conversion rates are deferred until we thread
          the landing-page slug through to Conversation.metadataJson. */}
      {stats && stats.totalVisits > 0 && (
        <div className="rounded-xl p-4 mb-6 flex flex-wrap gap-6"
             style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {t('partnerLandingPage.statsTotalVisits')}
            </p>
            <p className="text-xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {stats.totalVisits.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {t('partnerLandingPage.statsTotalConvos')}
            </p>
            <p className="text-xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {stats.totalConversations.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {t('partnerLandingPage.statsConversionRate')}
            </p>
            <p className="text-xl font-semibold tabular-nums" style={{ color: TEAL }}>
              {stats.totalVisits > 0
                ? `${((stats.totalConversations / stats.totalVisits) * 100).toFixed(1)}%`
                : '—'}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 mb-10" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {VARIATIONS.map(v => {
          const url = urlFor(v.n, partnerInfo?.slug ?? null, partnerInfo?.partnerPageActive ?? false)
          return (
            <div
              key={v.key}
              className="rounded-xl p-5 flex flex-col"
              style={{
                background: 'var(--surface-raised)',
                border:     '1px solid var(--border-subtle)',
                boxShadow:  '0 4px 16px rgba(0,0,0,0.04)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'oklch(55% 0.11 193 / 0.12)', color: TEAL, letterSpacing: '0.06em' }}
                >
                  V{v.n}
                </span>
                <h2 className="text-base font-semibold flex-1 min-w-0" style={{ color: 'var(--text-primary)' }}>
                  {t(`partnerLandingPage.variations.${v.key}.name`)}
                </h2>
                {stats && (
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                    {t('partnerLandingPage.visitsLabel', {
                      n: stats.variations.find(x => x.variation === v.n)?.visits ?? 0,
                    })}
                  </span>
                )}
              </div>

              {/* Mini-thumb — solid teal block with the variation's headline.
                  Cheap, fast, on-brand. Skips fetching screenshot images. */}
              <div
                className="rounded-lg px-4 py-6 mb-3 text-sm font-semibold"
                style={{
                  background:  'linear-gradient(135deg, oklch(28% 0.08 193), oklch(14% 0.05 193))',
                  color:       '#e8fafa',
                  minHeight:   '100px',
                  lineHeight:  1.3,
                }}
              >
                "{t(`partnerLandingPage.variations.${v.key}.headline`)}"
              </div>

              <p className="text-sm mb-4 flex-1" style={{ color: 'var(--text-secondary)' }}>
                {t(`partnerLandingPage.variations.${v.key}.description`)}
              </p>

              <code
                className="block text-xs px-3 py-2 rounded-md mb-3 font-mono"
                style={{
                  background: 'var(--surface-app)',
                  border:     '1px solid var(--border-subtle)',
                  color:      'var(--text-secondary)',
                  wordBreak:  'break-all',
                }}
              >
                {url}
              </code>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copyUrl(url, v.key)}
                  className="flex-1 px-3 py-2 rounded-md text-xs font-semibold"
                  style={{
                    background: 'var(--surface-app)',
                    border:     '1px solid var(--border-subtle)',
                    color:      'var(--text-primary)',
                  }}
                >
                  {copied === v.key
                    ? `✓ ${t('partnerLandingPage.copied')}`
                    : t('partnerLandingPage.copyLink')}
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-3 py-2 rounded-md text-xs font-semibold text-center"
                  style={{ background: TEAL, color: '#fff', textDecoration: 'none' }}
                >
                  {t('partnerLandingPage.preview')} ↗
                </a>
              </div>
            </div>
          )
        })}
      </div>

      {/* Custom-builder coming-soon block — the original content of this
          route, kept because that feature is still on the roadmap. Demoted
          to a smaller card below the live variations so partners see what's
          available NOW first. */}
      <div
        className="rounded-2xl p-6"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-start gap-4 flex-wrap">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'oklch(55% 0.11 193 / 0.1)', color: TEAL }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M7 3v18" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="inline-block text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
                style={{
                  background:    'oklch(55% 0.11 193 / 0.15)',
                  color:         TEAL,
                  letterSpacing: '0.08em',
                }}
              >
                {t('partnerLandingPage.soonBadge')}
              </span>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('partnerLandingPage.heroTitle')}
              </h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {t('partnerLandingPage.heroBody')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
