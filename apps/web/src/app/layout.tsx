import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { I18nProvider, type Locale } from '@/lib/i18n/I18nProvider'

export const metadata: Metadata = {
  title: 'MyOrbisVoice',
  description: 'AI voice automation for your business',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

// Detect preferred locale from Accept-Language. Walks the q-weighted list and
// returns 'es' if Spanish is preferred over English, otherwise 'en'. Returning
// users with a localStorage cache override this on hydration — see I18nProvider.
function detectLocaleFromAcceptLanguage(header: string | null): Locale {
  if (!header) return 'en'
  const entries = header.split(',').map(s => {
    const [tag, ...params] = s.trim().split(';')
    const qParam = params.find(p => p.trim().startsWith('q='))
    const q = qParam ? parseFloat(qParam.split('=')[1] ?? '1') : 1
    return { tag: (tag ?? '').toLowerCase(), q: Number.isFinite(q) ? q : 1 }
  }).sort((a, b) => b.q - a.q)
  for (const { tag } of entries) {
    if (tag.startsWith('es')) return 'es'
    if (tag.startsWith('en')) return 'en'
  }
  return 'en'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const initialLocale = detectLocaleFromAcceptLanguage(h.get('accept-language'))

  // Inline pre-hydration theme bootstrap. Runs before React mounts so the
  // theme class is correct on the first paint — no dark→light flash for users
  // whose OS is in light mode or who have a stored 'light' preference.
  // Precedence here mirrors ThemeProvider exactly:
  //   localStorage va_theme → prefers-color-scheme → 'dark' fallback.
  const themeBootstrap = `
    (function() {
      try {
        var stored = localStorage.getItem('va_theme');
        var t = (stored === 'light' || stored === 'dark')
          ? stored
          : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(t);
      } catch (e) {
        document.documentElement.classList.add('dark');
      }
    })();
  `

  return (
    // className left off — themeBootstrap script populates it before paint.
    // lang attribute mirrors the server-side Accept-Language detection; client
    // hydration refines locale from localStorage cache if present (see I18nProvider).
    <html lang={initialLocale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body style={{ background: 'var(--surface-app)', color: 'var(--text-primary)' }} className="antialiased">
        <ThemeProvider>
          <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
