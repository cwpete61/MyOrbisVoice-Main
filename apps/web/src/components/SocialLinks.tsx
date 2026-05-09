'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/I18nProvider'

type SocialMap = {
  youtube?:   string
  linkedin?:  string
  tiktok?:    string
  instagram?: string
  pinterest?: string
  x?:         string
}

// Cached across page navigations within the same session — the social URLs
// change rarely, the API endpoint sets a 5-minute Cache-Control header, and
// fetching them repeatedly on every layout mount would be wasteful.
let cache: { data: SocialMap; at: number } | null = null
const TTL_MS = 5 * 60 * 1000

const API_BASE = (
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:4000'
    : 'https://api.myorbisvoice.com'
)

const ICONS: Record<keyof SocialMap, { label: string; path: string }> = {
  youtube: {
    label: 'YouTube',
    // Filled play-button square (YouTube identity)
    path:  'M23 6.2s-.2-1.7-.9-2.4c-.8-.9-1.7-.9-2.1-.9C17 2.7 12 2.7 12 2.7s-5 0-8 .2c-.4 0-1.3 0-2.1.9C1.2 4.5 1 6.2 1 6.2S.7 8.2.7 10.2v1.6c0 2 .3 4 .3 4s.2 1.7.9 2.4c.8.9 2 .9 2.4 1 1.7.2 7.7.2 7.7.2s5 0 8-.2c.4 0 1.3 0 2.1-.9.7-.7.9-2.4.9-2.4s.3-2 .3-4v-1.6c0-2-.3-4-.3-4zM9.7 14V7.4l5.3 3.3-5.3 3.3z',
  },
  linkedin: {
    label: 'LinkedIn',
    path:  'M19 0H5C2.2 0 0 2.2 0 5v14c0 2.8 2.2 5 5 5h14c2.8 0 5-2.2 5-5V5c0-2.8-2.2-5-5-5zM8 19H5V8h3v11zM6.5 6.7C5.6 6.7 5 6 5 5.2c0-.8.7-1.5 1.6-1.5s1.5.7 1.5 1.5c0 .8-.6 1.5-1.6 1.5zM20 19h-3v-5.6c0-1.5-.6-2.1-1.6-2.1-1 0-1.6.7-1.6 2.1V19h-3V8h2.9v1.3c.5-.8 1.4-1.5 2.7-1.5 1.9 0 3.6 1.1 3.6 4V19z',
  },
  tiktok: {
    label: 'TikTok',
    path:  'M20 8.3a7.4 7.4 0 0 1-4.4-1.4v6.6a5.7 5.7 0 1 1-5-5.6v3.3a2.4 2.4 0 1 0 1.7 2.3V0h3.3a4.1 4.1 0 0 0 4.4 4.1v4.2z',
  },
  instagram: {
    label: 'Instagram',
    // Rounded-square camera (Instagram identity) using a stroke-only path so
    // currentColor renders correctly across themes.
    path:  'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm5.5-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  },
  pinterest: {
    label: 'Pinterest',
    path:  'M12 0C5.4 0 0 5.4 0 12c0 5 3.1 9.3 7.5 11.1-.1-.9-.2-2.4 0-3.4.2-.9 1.4-5.7 1.4-5.7s-.4-.7-.4-1.7c0-1.6 1-2.8 2.1-2.8 1 0 1.5.7 1.5 1.6 0 1-.6 2.5-1 3.9-.3 1.2.6 2.1 1.7 2.1 2.1 0 3.7-2.2 3.7-5.4 0-2.8-2-4.7-4.9-4.7-3.3 0-5.3 2.5-5.3 5.1 0 1 .4 2.1.9 2.7.1.1.1.2.1.3-.1.4-.3 1.2-.4 1.4-.1.2-.2.3-.4.2-1.5-.7-2.4-2.9-2.4-4.6 0-3.8 2.7-7.2 7.9-7.2 4.1 0 7.4 3 7.4 6.9 0 4.1-2.6 7.4-6.2 7.4-1.2 0-2.4-.6-2.7-1.4l-.7 2.8c-.3 1-1 2.4-1.5 3.1 1.1.4 2.3.5 3.6.5 6.6 0 12-5.4 12-12S18.6 0 12 0z',
  },
  x: {
    label: 'X',
    path:  'M14.3 10.2 23.3 0h-2.1l-7.8 8.9L7.1 0H0l9.4 13.5L0 24h2.1l8.2-9.4 6.6 9.4H24L14.3 10.2zm-2.9 3.3-1-1.4L2.9 1.6h3.3l6.1 8.7 1 1.4 7.9 11.3h-3.3l-6.5-9.2z',
  },
}

const ORDER: (keyof SocialMap)[] = ['youtube', 'linkedin', 'tiktok', 'instagram', 'pinterest', 'x']

export function SocialLinks({ compact = false }: { compact?: boolean }) {
  const t = useT()
  const [links, setLinks] = useState<SocialMap | null>(null)

  useEffect(() => {
    if (cache && Date.now() - cache.at < TTL_MS) {
      setLinks(cache.data)
      return
    }
    fetch(`${API_BASE}/api/public/social-links`)
      .then(r => r.ok ? r.json() : null)
      .then((j: { data?: SocialMap } | null) => {
        const data = j?.data ?? {}
        cache = { data, at: Date.now() }
        setLinks(data)
      })
      .catch(() => setLinks({}))
  }, [])

  if (!links) return null
  const present = ORDER.filter(k => links[k] && (links[k] as string).length > 0)
  if (present.length === 0) return null

  const size = compact ? 16 : 20

  return (
    <div className={compact ? 'flex items-center gap-3' : 'flex items-center gap-2'}>
      {!compact && (
        <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
          {t('partnerSocial.followUs')}
        </span>
      )}
      {present.map(k => {
        const icon = ICONS[k]
        return (
          <a
            key={k}
            href={links[k]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={icon.label}
            className="inline-flex items-center justify-center transition-opacity hover:opacity-100"
            style={{ color: 'var(--text-tertiary)', opacity: 0.75 }}
          >
            <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={icon.path} />
            </svg>
          </a>
        )
      })}
    </div>
  )
}
