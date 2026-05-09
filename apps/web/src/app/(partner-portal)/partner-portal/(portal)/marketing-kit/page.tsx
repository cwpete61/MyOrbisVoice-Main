'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

const PROMO_HORIZONTAL = 'https://api.myorbisvoice.com/api/public/marketing-asset/promo-horizontal.mp4'
const PROMO_VERTICAL   = 'https://api.myorbisvoice.com/api/public/marketing-asset/promo-vertical.mp4'

const TEAL = 'oklch(55% 0.11 193)'

type Account = { referralCode: string }

const BRAND_COLORS = [
  { name: 'Teal 1', hex: '#3dbcbc' },
  { name: 'Teal 2', hex: '#2aabab' },
  { name: 'Teal 3', hex: '#1a9898' },
  { name: 'Teal 4', hex: '#158484' },
  { name: 'Teal 5', hex: '#0f7070' },
  { name: 'Teal 6', hex: '#0a5c5c' },
]

function CopyButton({ text, copyKey, copied, setCopied, label }: {
  text: string
  copyKey: string
  copied: string | null
  setCopied: (k: string | null) => void
  label: string
}) {
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(copyKey)
          setTimeout(() => setCopied(null), 2000)
        } catch {
          /* ignore — clipboard not available */
        }
      }}
      className="px-3 py-1.5 rounded-md text-xs font-medium"
      style={{
        background: copied === copyKey ? 'oklch(55% 0.18 145)' : 'var(--brand-500)',
        color: '#fff',
        minWidth: 80,
      }}
    >
      {copied === copyKey ? '✓ ' + label : label}
    </button>
  )
}

export default function MarketingKitPage() {
  const t = useT()
  const [referralCode, setReferralCode] = useState<string>('')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<Account>('/api/affiliate/account')
      .then(a => setReferralCode(a.referralCode))
      .catch(() => { /* ignore — partner may not be approved yet */ })
  }, [])

  const referralUrl = referralCode
    ? `https://app.myorbisvoice.com/r/${referralCode}`
    : 'https://app.myorbisvoice.com/'

  // Build swipe content with the partner's referral URL embedded.
  const emailTemplates = [
    {
      key: 'cold',
      subject: t('partnerMarketingKit.email.cold.subject'),
      body:    t('partnerMarketingKit.email.cold.body', { url: referralUrl }),
    },
    {
      key: 'warm',
      subject: t('partnerMarketingKit.email.warm.subject'),
      body:    t('partnerMarketingKit.email.warm.body', { url: referralUrl }),
    },
    {
      key: 'reengage',
      subject: t('partnerMarketingKit.email.reengage.subject'),
      body:    t('partnerMarketingKit.email.reengage.body', { url: referralUrl }),
    },
  ]

  const socialPosts = [
    { key: 'linkedin', label: t('partnerMarketingKit.social.linkedin'), text: t('partnerMarketingKit.social.linkedinPost', { url: referralUrl }) },
    { key: 'x',        label: t('partnerMarketingKit.social.x'),        text: t('partnerMarketingKit.social.xPost',        { url: referralUrl }) },
    { key: 'instagram',label: t('partnerMarketingKit.social.instagram'),text: t('partnerMarketingKit.social.instagramPost',{ url: referralUrl }) },
  ]

  const talkingPoints: string[] = [
    t('partnerMarketingKit.talkingPoints.tp1'),
    t('partnerMarketingKit.talkingPoints.tp2'),
    t('partnerMarketingKit.talkingPoints.tp3'),
    t('partnerMarketingKit.talkingPoints.tp4'),
    t('partnerMarketingKit.talkingPoints.tp5'),
    t('partnerMarketingKit.talkingPoints.tp6'),
  ]

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerMarketingKit.title')}</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{t('partnerMarketingKit.subtitle')}</p>

      {/* Hero video */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('partnerMarketingKit.hero.title')}</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{t('partnerMarketingKit.hero.subtitle')}</p>
        <div className="rounded-xl overflow-hidden" style={{ background: '#000', border: '1px solid var(--border-subtle)' }}>
          <video
            src={PROMO_HORIZONTAL}
            controls
            preload="metadata"
            style={{ width: '100%', display: 'block', maxHeight: 480 }}
          />
        </div>
      </section>

      {/* Asset downloads */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('partnerMarketingKit.assets.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <a
            href={PROMO_HORIZONTAL}
            download="myorbisvoice-promo-horizontal.mp4"
            className="rounded-xl p-4 block"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', textDecoration: 'none' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('partnerMarketingKit.assets.horizontal.title')}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('partnerMarketingKit.assets.horizontal.body')}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded" style={{ background: TEAL, color: '#fff' }}>↓ MP4</span>
            </div>
          </a>

          <a
            href={PROMO_VERTICAL}
            download="myorbisvoice-promo-vertical.mp4"
            className="rounded-xl p-4 block"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', textDecoration: 'none' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('partnerMarketingKit.assets.vertical.title')}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('partnerMarketingKit.assets.vertical.body')}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded" style={{ background: TEAL, color: '#fff' }}>↓ MP4</span>
            </div>
          </a>
        </div>

        {/* Brand colors */}
        <div className="rounded-xl p-4 mt-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerMarketingKit.assets.colors.title')}</p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>{t('partnerMarketingKit.assets.colors.body')}</p>
          <div className="flex gap-2 flex-wrap">
            {BRAND_COLORS.map(c => (
              <button
                key={c.hex}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(c.hex)
                    setCopied('color-' + c.hex)
                    setTimeout(() => setCopied(null), 1500)
                  } catch { /* ignore */ }
                }}
                className="rounded-lg p-2 text-left flex-1 min-w-[110px]"
                style={{ background: c.hex, border: 'none', cursor: 'pointer' }}
                title={t('partnerMarketingKit.assets.colors.copyTooltip')}
              >
                <span className="text-xs font-semibold block" style={{ color: '#fff', fontFamily: 'monospace' }}>
                  {copied === 'color-' + c.hex ? '✓ ' + t('actions.copied') : c.hex}
                </span>
                <span className="text-[10px] block" style={{ color: 'rgba(255,255,255,0.85)' }}>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Email swipes */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('partnerMarketingKit.email.title')}</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>{t('partnerMarketingKit.email.subtitle')}</p>

        <div className="space-y-3">
          {emailTemplates.map(tpl => (
            <div key={tpl.key} className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t('partnerMarketingKit.email.' + tpl.key + '.label')}</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{tpl.subject}</p>
                </div>
                <CopyButton
                  text={tpl.subject + '\n\n' + tpl.body}
                  copyKey={'email-' + tpl.key}
                  copied={copied}
                  setCopied={setCopied}
                  label={t('actions.copy')}
                />
              </div>
              <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit', margin: 0 }}>{tpl.body}</pre>
            </div>
          ))}
        </div>
      </section>

      {/* Social */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('partnerMarketingKit.social.title')}</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>{t('partnerMarketingKit.social.subtitle')}</p>

        <div className="space-y-3">
          {socialPosts.map(post => (
            <div key={post.key} className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{post.label}</p>
                <CopyButton
                  text={post.text}
                  copyKey={'social-' + post.key}
                  copied={copied}
                  setCopied={setCopied}
                  label={t('actions.copy')}
                />
              </div>
              <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit', margin: 0 }}>{post.text}</pre>
            </div>
          ))}
        </div>
      </section>

      {/* Talking points */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('partnerMarketingKit.talkingPoints.title')}</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>{t('partnerMarketingKit.talkingPoints.subtitle')}</p>
        <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <ul className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
            {talkingPoints.map((tp, i) => (
              <li key={i} className="flex gap-2">
                <span style={{ color: TEAL, flexShrink: 0 }}>•</span>
                <span>{tp}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer note */}
      <p className="text-xs text-center mt-6" style={{ color: 'var(--text-tertiary)' }}>{t('partnerMarketingKit.footer')}</p>
    </div>
  )
}
