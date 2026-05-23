'use client'

import { useEffect, useState, useMemo } from 'react'
import { apiFetch, API_BASE } from '@/hooks/useApi'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'

// Marketing-asset proxy streams whitelisted videos from Bunny. The whitelist
// is now driven by the admin-managed MarketingKitVideo DB table — admins
// upload + edit + delete videos from "Content > Marketing Kit" in the admin
// portal, no code change needed.
const ASSET_BASE = `${API_BASE}/api/public/marketing-asset`

const TEAL = 'oklch(55% 0.11 193)'

type Account = { referralCode: string }

type VideoIntent =
  | 'pitch-product'        // pitch a product to a customer
  | 'recruit-partners'     // pitch the partner program to prospective partners
  | 'how-to-sell'          // walkthroughs for current partners
  | 'social-cuts'          // short 9:16 hooks for partners' organic social

// One row of MarketingKitVideo from /api/public/marketing-kit/videos.
type MediaType = 'video' | 'image' | 'audio' | 'carousel'
interface VideoAsset {
  id:            string
  intent:        VideoIntent
  durationSec:   number
  aspectRatio:   'horizontal' | 'vertical'
  filename:      string | null
  titleEn:       string
  titleEs:       string
  descriptionEn: string
  descriptionEs: string
  comingSoon:    boolean
  mediaType:     MediaType
  mimeType:      string | null
  secondaryFilenames: string[]
}

interface KitSettings {
  columnsDesktop: number
  columnsTablet:  number
  columnsMobile:  number
  defaultSort:    string  // 'manual' | 'newest' | 'duration'
  defaultTab:     string  // 'all' | VideoIntent
  hiddenTabs:     string[]  // VideoIntent slugs hidden from this list
}

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
  const { locale } = useLocale()
  const [referralCode, setReferralCode] = useState<string>('')
  const [copied, setCopied] = useState<string | null>(null)
  const [videos, setVideos] = useState<VideoAsset[]>([])
  const [settings, setSettings] = useState<KitSettings | null>(null)
  const [activeTab, setActiveTab] = useState<VideoIntent | 'all'>('all')
  const [activePlayer, setActivePlayer] = useState<VideoAsset | null>(null)

  useEffect(() => {
    apiFetch<Account>('/api/affiliate/account')
      .then(a => setReferralCode(a.referralCode))
      .catch(() => { /* ignore */ })
    // Library data comes from the admin-managed table. Visible-only.
    apiFetch<{ videos: VideoAsset[]; settings: KitSettings }>('/api/public/marketing-kit/videos')
      .then(({ videos, settings }) => {
        setVideos(videos); setSettings(settings)
        // Honor the admin's default tab on first render — unless that tab
        // was also marked hidden, in which case fall back to "All".
        if (settings.defaultTab && settings.defaultTab !== 'all' && !settings.hiddenTabs?.includes(settings.defaultTab)) {
          setActiveTab(settings.defaultTab as VideoIntent)
        }
      })
      .catch(() => { /* keep empty list — page still renders the other sections */ })
  }, [])

  const referralUrl = referralCode
    ? `https://app.myorbisvoice.com/r/${referralCode}`
    : 'https://app.myorbisvoice.com/'

  // Each row carries copy in ONE language (admin choice on upload). Show only
  // rows whose ACTIVE-LOCALE copy is filled — never display untranslated
  // content from the other language. Also drop rows whose intent (tab) the
  // admin has hidden, so hidden tabs don't bleed into the "All" view.
  const localized = useMemo(() => {
    const h = new Set(settings?.hiddenTabs ?? [])
    return videos.filter(v =>
      !h.has(v.intent)
      && (locale === 'es' ? !!v.titleEs?.trim() : !!v.titleEn?.trim()),
    )
  }, [videos, locale, settings?.hiddenTabs])
  // Sort by the admin's chosen mode, then filter by the active tab.
  const sortedVideos = useMemo(() => {
    const sort = settings?.defaultSort ?? 'manual'
    const out = [...localized]
    if (sort === 'newest') return out // server returns sortOrder asc already; client-side: leave
    if (sort === 'duration') out.sort((a, b) => a.durationSec - b.durationSec)
    return out
  }, [localized, settings?.defaultSort])
  const visibleVideos = useMemo(
    () => activeTab === 'all' ? sortedVideos : sortedVideos.filter(v => v.intent === activeTab),
    [sortedVideos, activeTab],
  )

  // Admin can hide tabs from the partner-side list via MarketingKitSettings.
  // The "All" tab is always present. If the partner's currently-selected tab
  // is hidden by the admin, snap them back to "All".
  const hidden = new Set(settings?.hiddenTabs ?? [])
  const ALL_TABS: { key: VideoIntent | 'all'; labelKey: string }[] = [
    { key: 'all',              labelKey: 'partnerMarketingKit.videoLibrary.tabs.all' },
    { key: 'pitch-product',    labelKey: 'partnerMarketingKit.videoLibrary.tabs.pitchProduct' },
    { key: 'recruit-partners', labelKey: 'partnerMarketingKit.videoLibrary.tabs.recruitPartners' },
    { key: 'how-to-sell',      labelKey: 'partnerMarketingKit.videoLibrary.tabs.howToSell' },
    { key: 'social-cuts',      labelKey: 'partnerMarketingKit.videoLibrary.tabs.socialCuts' },
  ]
  const tabs = ALL_TABS.filter(t => t.key === 'all' || !hidden.has(t.key))
  useEffect(() => {
    if (activeTab !== 'all' && hidden.has(activeTab)) setActiveTab('all')
  }, [activeTab, hidden])

  // Admin sets column counts per breakpoint at runtime. Tailwind classes can't
  // be synthesized from runtime values, so we inject a tiny scoped stylesheet
  // with media queries.
  const cols = {
    mobile:  settings?.columnsMobile  ?? 1,
    tablet:  settings?.columnsTablet  ?? 2,
    desktop: settings?.columnsDesktop ?? 3,
  }

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
            {localized.filter(v => !v.comingSoon).length} / {localized.length} {t('partnerMarketingKit.videoLibrary.availableSuffix')}
          </span>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>{t('partnerMarketingKit.videoLibrary.subtitle')}</p>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {tabs.map(tab => {
            const active = activeTab === tab.key
            const count = tab.key === 'all' ? localized.length : localized.filter(v => v.intent === tab.key).length
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

        {/* Grid — column counts driven by MarketingKitSettings (admin-controlled). */}
        <style>{`
          .mk-grid { display: grid; gap: 12px; grid-template-columns: repeat(${cols.mobile}, minmax(0, 1fr)); }
          @media (min-width: 640px)  { .mk-grid { grid-template-columns: repeat(${cols.tablet}, minmax(0, 1fr)); } }
          @media (min-width: 1024px) { .mk-grid { grid-template-columns: repeat(${cols.desktop}, minmax(0, 1fr)); } }
        `}</style>
        <div className="mk-grid">
          {visibleVideos.map(v => (
            <VideoCard
              key={v.id}
              video={v}
              labelTitle={locale === 'es' ? v.titleEs : v.titleEn}
              labelDesc={locale === 'es' ? v.descriptionEs : v.descriptionEn}
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
      {/* Audio has no modal — it plays inline on the card. Everything else
          (video, image, carousel) opens the appropriate full-screen modal. */}
      {activePlayer && activePlayer.filename && activePlayer.mediaType !== 'audio' && (
        <MediaModal
          asset={activePlayer}
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
  const isComing  = video.comingSoon || !video.filename
  const mediaUrl  = video.filename ? `${ASSET_BASE}/${video.filename}` : ''
  const mt        = video.mediaType ?? 'video'
  const isAudio   = mt === 'audio'
  const slideCount = (video.secondaryFilenames?.length ?? 0) + 1

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', opacity: isComing ? 0.7 : 1 }}
    >
      {/* Thumbnail surface — content branches by mediaType:
          - video    → muted <video> first-frame poster + Play button → modal
          - image    → <img> + click → lightbox
          - carousel → cover <img> + "1 / N" slide-count badge + click → swiper modal
          - audio    → speaker icon (no thumbnail); player goes inline below
          coming-soon = gradient + lock icon, no click. */}
      <div
        onClick={isComing || isAudio ? undefined : onWatch}
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          aspectRatio: video.aspectRatio === 'horizontal' ? '16 / 9' : '9 / 16',
          background:  'linear-gradient(135deg, oklch(40% 0.10 193) 0%, oklch(20% 0.05 193) 100%)',
          maxHeight:   video.aspectRatio === 'horizontal' ? 200 : 320,
          cursor:      isComing || isAudio ? 'default' : 'pointer',
        }}
      >
        {!isComing && mediaUrl && (mt === 'video') && (
          <video src={mediaUrl + '#t=0.5'} preload="metadata" muted playsInline controls={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} aria-hidden="true" />
        )}
        {!isComing && mediaUrl && (mt === 'image' || mt === 'carousel') && (
          <img src={mediaUrl} alt={labelTitle} loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        {!isComing && isAudio && (
          // Speaker / waveform icon for audio cards.
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 2, opacity: 0.85 }}>
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}

        {/* Play / lock icon overlay. Hidden for audio (player is inline). */}
        {isComing ? (
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 2 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ) : !isAudio ? (
          <button onClick={(e) => { e.stopPropagation(); onWatch() }}
            className="rounded-full flex items-center justify-center"
            style={{ width: 56, height: 56, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', border: 'none', cursor: 'pointer', position: 'relative', zIndex: 2 }}
            aria-label={tWatch}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              {mt === 'image' || mt === 'carousel'
                ? <path d="M15 3h6v6M14 10l7-7M9 21H3v-6M10 14l-7 7" />
                : <path d="M8 5v14l11-7z" />}
            </svg>
          </button>
        ) : null}

        {/* Duration pill (video/audio) OR slide-count badge (carousel). */}
        {(mt === 'video' || mt === 'audio') && video.durationSec > 0 && (
          <span className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded font-mono"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'white', zIndex: 2 }}>
            {fmtDuration(video.durationSec)}
          </span>
        )}
        {mt === 'carousel' && (
          <span className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold"
            style={{ background: 'rgba(0,0,0,0.7)', color: 'white', zIndex: 2 }}>
            1 / {slideCount}
          </span>
        )}

        {isComing && (
          <span className="absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
            style={{ background: TEAL, color: '#fff', letterSpacing: '0.08em', zIndex: 2 }}>
            {tComingSoon}
          </span>
        )}

        {/* Media-type / aspect indicator. */}
        <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
          style={{ background: 'rgba(0,0,0,0.6)', color: 'white', letterSpacing: '0.04em', zIndex: 2 }}>
          {mt === 'audio' ? 'AUDIO' : mt === 'image' ? 'IMAGE' : mt === 'carousel' ? `CAROUSEL` : (video.aspectRatio === 'horizontal' ? '16:9' : '9:16')}
        </span>
      </div>

      {/* Inline audio player — audio cards show <audio controls> directly
          below the thumbnail surface. No modal needed. */}
      {!isComing && isAudio && mediaUrl && (
        <div className="px-3 pt-3">
          <audio controls preload="metadata" src={mediaUrl} className="w-full" style={{ height: 36 }}>
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

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
              href={mediaUrl}
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
                  await navigator.clipboard.writeText(mediaUrl)
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

// Media-aware modal: picks the right inner element from the row's mediaType.
// Video → autoplay <video controls>. Image → fullsize <img>. Carousel →
// swiper with prev/next buttons + slide indicator. (Audio never opens here.)
function MediaModal({ asset, tClose, onClose }: { asset: VideoAsset; tClose: string; onClose: () => void }) {
  const [slideIdx, setSlideIdx] = useState(0)
  const slides = asset.mediaType === 'carousel'
    ? [asset.filename!, ...(asset.secondaryFilenames ?? [])]
    : [asset.filename!]
  const src = `${ASSET_BASE}/${slides[slideIdx]}`
  const isVideo = asset.mediaType === 'video'
  const isImage = asset.mediaType === 'image' || asset.mediaType === 'carousel'

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.88)' }}>
      <div onClick={(e) => e.stopPropagation()} className="relative rounded-xl overflow-hidden"
        style={{
          background: '#000',
          width:     asset.aspectRatio === 'horizontal' ? '90vw' : 'auto',
          maxWidth:  asset.aspectRatio === 'horizontal' ? 1100 : 600,
          maxHeight: '90vh',
        }}>
        <button onClick={onClose} className="absolute top-2 right-2 z-10 rounded-full flex items-center justify-center"
          style={{ width: 36, height: 36, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
          aria-label={tClose}>✕</button>

        {isVideo && <video src={src} controls autoPlay preload="metadata" style={{ width: '100%', display: 'block', maxHeight: '85vh' }} />}
        {isImage && <img src={src} alt="" style={{ width: '100%', display: 'block', maxHeight: '85vh', objectFit: 'contain' }} />}

        {/* Carousel controls: prev / next + slide indicator. */}
        {asset.mediaType === 'carousel' && slides.length > 1 && (
          <>
            <button onClick={() => setSlideIdx((i) => (i - 1 + slides.length) % slides.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center"
              style={{ width: 44, height: 44, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
              aria-label="Previous slide">‹</button>
            <button onClick={() => setSlideIdx((i) => (i + 1) % slides.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center"
              style={{ width: 44, height: 44, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
              aria-label="Next slide">›</button>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs font-mono px-2 py-1 rounded"
              style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>
              {slideIdx + 1} / {slides.length}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
