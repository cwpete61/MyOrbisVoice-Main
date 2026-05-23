'use client'

import { useEffect, useState, useMemo } from 'react'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'

// Marketing-asset proxy serves whitelisted videos + brand assets.
// Updates here also need updates to apps/api/src/routes/marketing-assets.ts
// (the whitelist is the source of truth for what's serveable).
const ASSET_BASE = 'https://api.myorbisvoice.com/api/public/marketing-asset'

const TEAL = 'oklch(55% 0.11 193)'

type Account = { referralCode: string }

type VideoIntent =
  | 'pitch-product'        // existing 3-min explainer + future industry demos
  | 'recruit-partners'     // pitch the partner program to prospective partners
  | 'how-to-sell'          // walkthroughs for current partners
  | 'social-cuts'          // short 9:16 hooks for partners' organic social

interface VideoAsset {
  id:           string
  intent:       VideoIntent
  durationSec:  number
  aspectRatio:  'horizontal' | 'vertical'
  /** Filename in the marketing-asset proxy whitelist. Undefined = placeholder. */
  filename?:    string
  /** Set true when the asset hasn't been produced yet. Renders a "Coming Soon" card. */
  comingSoon?:  boolean
}

// Single source of truth for the video library. Order here = order shown in
// the "All" tab. Filter by intent for the other tabs.
const VIDEOS: VideoAsset[] = [
  // ── Pitch Product — Orby power-statement (Aoede voice), 4 cuts ────────────
  { id: 'orby-pitch-horizontal-en', intent: 'pitch-product', durationSec: 44, aspectRatio: 'horizontal', filename: 'orby-pitch-horizontal-en.mp4' },
  { id: 'orby-pitch-vertical-en',   intent: 'pitch-product', durationSec: 44, aspectRatio: 'vertical',   filename: 'orby-pitch-vertical-en.mp4'   },
  { id: 'orby-pitch-horizontal-es', intent: 'pitch-product', durationSec: 53, aspectRatio: 'horizontal', filename: 'orby-pitch-horizontal-es.mp4' },
  { id: 'orby-pitch-vertical-es',   intent: 'pitch-product', durationSec: 53, aspectRatio: 'vertical',   filename: 'orby-pitch-vertical-es.mp4'   },

  // ── Recruit Partners (Phase 1: new) ────────────────────────────────────────
  { id: 'partner-recruiting-en',        intent: 'recruit-partners', durationSec: 65,  aspectRatio: 'horizontal', filename: 'partner-recruiting-en.mp4' },

  // ── Pitch Product — Industry Demos (Phase 2: placeholders) ────────────────
  { id: 'industry-dental',        intent: 'pitch-product', durationSec: 45, aspectRatio: 'horizontal', comingSoon: true },
  { id: 'industry-legal',         intent: 'pitch-product', durationSec: 45, aspectRatio: 'horizontal', comingSoon: true },
  { id: 'industry-home-services', intent: 'pitch-product', durationSec: 45, aspectRatio: 'horizontal', comingSoon: true },
  { id: 'industry-fitness',       intent: 'pitch-product', durationSec: 45, aspectRatio: 'horizontal', comingSoon: true },
  { id: 'industry-beauty',        intent: 'pitch-product', durationSec: 45, aspectRatio: 'horizontal', comingSoon: true },

  // ── How-to-Sell (Phase 3: placeholder) ────────────────────────────────────
  { id: 'how-to-sell-walkthrough',     intent: 'how-to-sell',  durationSec: 150, aspectRatio: 'horizontal', comingSoon: true },

  // ── Social Cuts (Phase 2A: live, stat-anchored 9:16 hooks) ────────────────
  { id: 'social-hook-missed-calls', intent: 'social-cuts', durationSec: 18, aspectRatio: 'vertical', filename: 'social-cut-01-85-percent.mp4' },
  { id: 'social-hook-247-coverage', intent: 'social-cuts', durationSec: 23, aspectRatio: 'vertical', filename: 'social-cut-02-five-minute.mp4' },
  { id: 'social-hook-roi',          intent: 'social-cuts', durationSec: 20, aspectRatio: 'vertical', filename: 'social-cut-03-daily-math.mp4' },
]

const BRAND_COLORS = [
  { name: 'Teal 1', hex: '#3dbcbc' },
  { name: 'Teal 2', hex: '#2aabab' },
  { name: 'Teal 3', hex: '#1a9898' },
  { name: 'Teal 4', hex: '#158484' },
  { name: 'Teal 5', hex: '#0f7070' },
  { name: 'Teal 6', hex: '#0a5c5c' },
]

function CopyButton({ text, copyKey, copied, setCopied, label }: {
  text: string; copyKey: string; copied: string | null
  setCopied: (k: string | null) => void; label: string
}) {
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(copyKey)
          setTimeout(() => setCopied(null), 2000)
        } catch { /* ignore */ }
      }}
      className="px-3 py-1.5 rounded-md text-xs font-medium"
      style={{
        background: copied === copyKey ? 'oklch(55% 0.18 145)' : 'var(--brand-500)',
        color: '#fff', minWidth: 80,
      }}
    >
      {copied === copyKey ? '✓ ' + label : label}
    </button>
  )
}

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60); const s = secs % 60
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`
}

export default function MarketingKitPage() {
  const t = useT()
  const [referralCode, setReferralCode] = useState<string>('')
  const [copied, setCopied] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<VideoIntent | 'all'>('all')
  const [activePlayer, setActivePlayer] = useState<VideoAsset | null>(null)

  useEffect(() => {
    apiFetch<Account>('/api/affiliate/account')
      .then(a => setReferralCode(a.referralCode))
      .catch(() => { /* ignore */ })
  }, [])

  const referralUrl = referralCode
    ? `https://app.myorbisvoice.com/r/${referralCode}`
    : 'https://app.myorbisvoice.com/'

  const visibleVideos = useMemo(
    () => activeTab === 'all' ? VIDEOS : VIDEOS.filter(v => v.intent === activeTab),
    [activeTab],
  )

  const tabs: { key: VideoIntent | 'all'; labelKey: string }[] = [
    { key: 'all',              labelKey: 'partnerMarketingKit.videoLibrary.tabs.all' },
    { key: 'pitch-product',    labelKey: 'partnerMarketingKit.videoLibrary.tabs.pitchProduct' },
    { key: 'recruit-partners', labelKey: 'partnerMarketingKit.videoLibrary.tabs.recruitPartners' },
    { key: 'how-to-sell',      labelKey: 'partnerMarketingKit.videoLibrary.tabs.howToSell' },
    { key: 'social-cuts',      labelKey: 'partnerMarketingKit.videoLibrary.tabs.socialCuts' },
  ]

  const emailTemplates = [
    // Pattern-interrupt cold goes first — it's the highest-stopping-power
    // option. The benefit-led "cold" comes second for partners who want a
    // softer opener. Warm + reengage are conversational follow-ups.
    { key: 'coldCallback', subject: t('partnerMarketingKit.email.coldCallback.subject'), body: t('partnerMarketingKit.email.coldCallback.body', { url: referralUrl }) },
    { key: 'cold',         subject: t('partnerMarketingKit.email.cold.subject'),         body: t('partnerMarketingKit.email.cold.body',         { url: referralUrl }) },
    { key: 'warm',         subject: t('partnerMarketingKit.email.warm.subject'),         body: t('partnerMarketingKit.email.warm.body',         { url: referralUrl }) },
    { key: 'reengage',     subject: t('partnerMarketingKit.email.reengage.subject'),     body: t('partnerMarketingKit.email.reengage.body',     { url: referralUrl }) },
  ]
  const socialPosts = [
    { key: 'linkedin',  label: t('partnerMarketingKit.social.linkedin'),  text: t('partnerMarketingKit.social.linkedinPost',  { url: referralUrl }) },
    { key: 'x',         label: t('partnerMarketingKit.social.x'),         text: t('partnerMarketingKit.social.xPost',         { url: referralUrl }) },
    { key: 'instagram', label: t('partnerMarketingKit.social.instagram'), text: t('partnerMarketingKit.social.instagramPost', { url: referralUrl }) },
  ]
  const talkingPoints: string[] = [
    t('partnerMarketingKit.talkingPoints.tp1'), t('partnerMarketingKit.talkingPoints.tp2'),
    t('partnerMarketingKit.talkingPoints.tp3'), t('partnerMarketingKit.talkingPoints.tp4'),
    t('partnerMarketingKit.talkingPoints.tp5'), t('partnerMarketingKit.talkingPoints.tp6'),
  ]

  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerMarketingKit.title')}</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{t('partnerMarketingKit.subtitle')}</p>

      {/* ─── Video Library ──────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('partnerMarketingKit.videoLibrary.title')}</h2>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {VIDEOS.filter(v => !v.comingSoon).length} / {VIDEOS.length} {t('partnerMarketingKit.videoLibrary.availableSuffix')}
          </span>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>{t('partnerMarketingKit.videoLibrary.subtitle')}</p>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {tabs.map(tab => {
            const active = activeTab === tab.key
            const count = tab.key === 'all' ? VIDEOS.length : VIDEOS.filter(v => v.intent === tab.key).length
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: active ? TEAL : 'var(--surface-raised)',
                  color:      active ? '#fff' : 'var(--text-secondary)',
                  border:     `1px solid ${active ? TEAL : 'var(--border-subtle)'}`,
                }}
              >
                {t(tab.labelKey)} <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleVideos.map(v => (
            <VideoCard
              key={v.id}
              video={v}
              labelTitle={t(`partnerMarketingKit.videoLibrary.videos.${v.id}.title`)}
              labelDesc={t(`partnerMarketingKit.videoLibrary.videos.${v.id}.description`)}
              tComingSoon={t('partnerMarketingKit.videoLibrary.comingSoonBadge')}
              tWatch={t('partnerMarketingKit.videoLibrary.watchAction')}
              tDownload={t('partnerMarketingKit.videoLibrary.downloadAction')}
              tCopyLink={t('partnerMarketingKit.videoLibrary.copyLinkAction')}
              tCopied={t('actions.copied')}
              onWatch={() => setActivePlayer(v)}
              copied={copied}
              setCopied={setCopied}
            />
          ))}
        </div>

        {/* Brand colors — kept here; visually still part of "kit assets" */}
        <div className="rounded-xl p-4 mt-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('partnerMarketingKit.assets.colors.title')}</p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>{t('partnerMarketingKit.assets.colors.body')}</p>
          <div className="flex gap-2 flex-wrap">
            {BRAND_COLORS.map(c => (
              <button
                key={c.hex}
                onClick={async () => {
                  try { await navigator.clipboard.writeText(c.hex); setCopied('color-' + c.hex); setTimeout(() => setCopied(null), 1500) } catch { /* ignore */ }
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

      {/* ─── Email swipes (unchanged) ───────────────────────────────────── */}
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
                <CopyButton text={tpl.subject + '\n\n' + tpl.body} copyKey={'email-' + tpl.key} copied={copied} setCopied={setCopied} label={t('actions.copy')} />
              </div>
              <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit', margin: 0 }}>{tpl.body}</pre>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Social captions (unchanged) ─────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('partnerMarketingKit.social.title')}</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>{t('partnerMarketingKit.social.subtitle')}</p>
        <div className="space-y-3">
          {socialPosts.map(post => (
            <div key={post.key} className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{post.label}</p>
                <CopyButton text={post.text} copyKey={'social-' + post.key} copied={copied} setCopied={setCopied} label={t('actions.copy')} />
              </div>
              <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit', margin: 0 }}>{post.text}</pre>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Talking points (unchanged) ──────────────────────────────────── */}
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

      <p className="text-xs text-center mt-6" style={{ color: 'var(--text-tertiary)' }}>{t('partnerMarketingKit.footer')}</p>

      {/* ─── Modal player ───────────────────────────────────────────────── */}
      {activePlayer && activePlayer.filename && (
        <VideoModal
          src={`${ASSET_BASE}/${activePlayer.filename}`}
          aspectRatio={activePlayer.aspectRatio}
          tClose={t('actions.close')}
          onClose={() => setActivePlayer(null)}
        />
      )}
    </div>
  )
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function VideoCard(props: {
  video:        VideoAsset
  labelTitle:   string
  labelDesc:    string
  tComingSoon:  string
  tWatch:       string
  tDownload:    string
  tCopyLink:    string
  tCopied:      string
  onWatch:      () => void
  copied:       string | null
  setCopied:    (k: string | null) => void
}) {
  const { video, labelTitle, labelDesc, tComingSoon, tWatch, tDownload, tCopyLink, tCopied, onWatch, copied, setCopied } = props
  const isComing = video.comingSoon || !video.filename
  const mp4Url   = video.filename ? `${ASSET_BASE}/${video.filename}` : ''

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', opacity: isComing ? 0.7 : 1 }}
    >
      {/* Thumbnail surface — for live videos we render a muted <video> with
          preload="metadata" so the browser fetches just enough to display
          the first frame as a thumbnail. Click anywhere on the surface
          opens the full-bleed modal player. For coming-soon cards the
          gradient + lock icon remain. */}
      <div
        onClick={isComing ? undefined : onWatch}
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          aspectRatio: video.aspectRatio === 'horizontal' ? '16 / 9' : '9 / 16',
          background:  'linear-gradient(135deg, oklch(40% 0.10 193) 0%, oklch(20% 0.05 193) 100%)',
          maxHeight:   video.aspectRatio === 'horizontal' ? 200 : 320,
          cursor:      isComing ? 'default' : 'pointer',
        }}
      >
        {!isComing && mp4Url && (
          <video
            src={mp4Url + '#t=0.5'}
            preload="metadata"
            muted
            playsInline
            // Don't show native controls on the card — that's reserved for
            // the modal player. The card is a clickable poster.
            controls={false}
            // Ensure first frame paints in cards: jumping to t=0.5 forces
            // most browsers to render a frame even when paused.
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', display: 'block',
            }}
            aria-hidden="true"
          />
        )}

        {/* Play icon when available, lock when not — sits on top of the
            video poster frame. */}
        {isComing ? (
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 2 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onWatch() }}
            className="rounded-full flex items-center justify-center"
            style={{ width: 56, height: 56, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', border: 'none', cursor: 'pointer', position: 'relative', zIndex: 2 }}
            aria-label={tWatch}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}

        {/* Duration pill — z-index 2 to sit above the video poster */}
        <span
          className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded font-mono"
          style={{ background: 'rgba(0,0,0,0.6)', color: 'white', zIndex: 2 }}
        >
          {fmtDuration(video.durationSec)}
        </span>

        {/* Coming Soon pill */}
        {isComing && (
          <span
            className="absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
            style={{ background: TEAL, color: '#fff', letterSpacing: '0.08em', zIndex: 2 }}
          >
            {tComingSoon}
          </span>
        )}

        {/* Aspect indicator */}
        <span
          className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded font-semibold"
          style={{ background: 'rgba(0,0,0,0.6)', color: 'white', letterSpacing: '0.04em', zIndex: 2 }}
        >
          {video.aspectRatio === 'horizontal' ? '16:9' : '9:16'}
        </span>
      </div>

      {/* Card body */}
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-sm font-semibold leading-tight mb-1" style={{ color: 'var(--text-primary)' }}>{labelTitle}</p>
        <p className="text-xs mb-3 flex-1" style={{ color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{labelDesc}</p>

        {!isComing && (
          <div className="flex gap-1.5">
            <button
              onClick={onWatch}
              className="flex-1 px-2 py-1.5 rounded-md text-xs font-medium"
              style={{ background: TEAL, color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              ▶ {tWatch}
            </button>
            <a
              href={mp4Url}
              download={video.filename}
              className="px-2 py-1.5 rounded-md text-xs font-medium text-center"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textDecoration: 'none', minWidth: 36 }}
              title={tDownload}
            >
              ↓
            </a>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(mp4Url)
                  setCopied('vid-' + video.id)
                  setTimeout(() => setCopied(null), 1500)
                } catch { /* ignore */ }
              }}
              className="px-2 py-1.5 rounded-md text-xs font-medium"
              style={{
                background: copied === 'vid-' + video.id ? 'oklch(55% 0.18 145)' : 'var(--surface-app)',
                border: `1px solid ${copied === 'vid-' + video.id ? 'oklch(55% 0.18 145)' : 'var(--border-subtle)'}`,
                color:  copied === 'vid-' + video.id ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', minWidth: 36,
              }}
              title={tCopyLink}
            >
              {copied === 'vid-' + video.id ? '✓' : '⎘'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function VideoModal({ src, aspectRatio, tClose, onClose }: { src: string; aspectRatio: 'horizontal' | 'vertical'; tClose: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative rounded-xl overflow-hidden"
        style={{
          background:  '#000',
          width:       aspectRatio === 'horizontal' ? '90vw' : 'auto',
          maxWidth:    aspectRatio === 'horizontal' ? 1100 : 480,
          maxHeight:   '90vh',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 rounded-full flex items-center justify-center"
          style={{ width: 36, height: 36, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
          aria-label={tClose}
        >
          ✕
        </button>
        <video
          src={src}
          controls
          autoPlay
          preload="metadata"
          style={{ width: '100%', display: 'block', maxHeight: '85vh' }}
        />
      </div>
    </div>
  )
}
