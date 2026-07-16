import type { CSSProperties } from 'react'

/**
 * The Webinar Marketing pages were authored against CSS vars (--accent,
 * --surface, --text, --background, --border-strong) that only exist in the
 * partner-portal theme. Under the admin layout those are undefined, so we alias
 * them to the real admin design tokens on a single wrapper element. One spread
 * on the page root makes all the nested markup render correctly.
 */
export const WEBINAR_THEME_VARS = {
  '--accent':        'oklch(72% 0.12 193)',
  '--accent-hi':     'oklch(80% 0.13 193)',
  '--surface':       'var(--surface-raised)',
  '--text':          'var(--text-primary)',
  '--background':    'var(--surface-app)',
  '--border-strong': 'var(--text-tertiary)',
} as CSSProperties
