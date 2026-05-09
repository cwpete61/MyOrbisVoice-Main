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

  return (
    // Default class is "dark" — ThemeProvider replaces it on mount if the user has a stored preference.
    // lang attribute mirrors the server-side Accept-Language detection; client hydration
    // refines it from localStorage cache if present.
    <html lang={initialLocale} className="dark" suppressHydrationWarning>
      <body style={{ background: 'var(--surface-app)', color: 'var(--text-primary)' }} className="antialiased">
        <ThemeProvider>
          <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
