import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { I18nProvider, type Locale } from '@/lib/i18n/I18nProvider'

export const metadata: Metadata = {
  title: 'MyOrbisVoice',
  description: 'AI voice automation for your business',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'MyOrbisVoice', statusBarStyle: 'default' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1a9898',
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

  // Light mode is enforced site-wide (Phase G.5) — dark mode retired. This
  // inline script just guarantees the `light` class is on <html> before the
  // first paint. No localStorage read, no OS-preference check, no dark path.
  const themeBootstrap = `
    (function() {
      try {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } catch (e) {}
    })();
  `

  // Register the service worker on load — required for the dashboard to be an
  // installable PWA (paired with /manifest.webmanifest). sw.js also handles
  // Web Push; one registration covers both.
  const swRegister = `
    (function() {
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/sw.js').catch(function() {});
        });
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
        <script dangerouslySetInnerHTML={{ __html: swRegister }} />
      </head>
      <body style={{ background: 'var(--surface-app)', color: 'var(--text-primary)' }} className="antialiased">
        <ThemeProvider>
          <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
