import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { I18nProvider } from '@/lib/i18n/I18nProvider'

export const metadata: Metadata = {
  title: 'MyOrbisVoice',
  description: 'AI voice automation for your business',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Default class is "dark" — ThemeProvider replaces it on mount if the user has a stored preference.
    // Default lang is "en" — I18nProvider syncs it to the user's preferredLocale on mount.
    <html lang="en" className="dark" suppressHydrationWarning>
      <body style={{ background: 'var(--surface-app)', color: 'var(--text-primary)' }} className="antialiased">
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
