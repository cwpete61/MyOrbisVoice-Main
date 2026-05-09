'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import enDict from './dictionaries/en.json'
import esDict from './dictionaries/es.json'

export type Locale = 'en' | 'es'
export const SUPPORTED_LOCALES: Locale[] = ['en', 'es']

const DICTIONARIES: Record<Locale, Record<string, unknown>> = {
  en: enDict as Record<string, unknown>,
  es: esDict as Record<string, unknown>,
}

const STORAGE_KEY = 'va_locale'

interface I18nContextValue {
  locale: Locale
  setLocale: (next: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function lookup(dict: Record<string, unknown>, key: string): string | undefined {
  // Dot-path lookup: "nav.items.dashboard" → dict.nav.items.dashboard
  const parts = key.split('.')
  let cur: unknown = dict
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return typeof cur === 'string' ? cur : undefined
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`))
}

interface I18nProviderProps {
  children: ReactNode
  /** Initial locale before /me hydration. Defaults to localStorage cache → 'en'. */
  initialLocale?: Locale
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  // Precedence (most → least authoritative):
  //   1. localStorage cache  — the user's explicit prior choice on this device
  //   2. initialLocale prop  — server-side Accept-Language detection
  //   3. 'en' default
  // On first server render localStorage isn't available, so we fall back to
  // initialLocale. On client hydration the cached value (if present) takes
  // over so returning users never see the auto-detect override their choice.
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      const cached = window.localStorage.getItem(STORAGE_KEY)
      if (cached === 'en' || cached === 'es') return cached
    }
    if (initialLocale && SUPPORTED_LOCALES.includes(initialLocale)) return initialLocale
    return 'en'
  })

  // Hydrate from /me on mount — server-side preference is the source of
  // truth. Don't block render on this; it just refines the cached value.
  useEffect(() => {
    let cancelled = false
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('va_access_token') : null
    if (!token) return
    const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? ''
    fetch(`${apiBase}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : null))
      .then((json: { data?: { user?: { preferredLocale?: string } } } | null) => {
        const next = json?.data?.user?.preferredLocale
        if (!cancelled && (next === 'en' || next === 'es')) {
          setLocaleState(next)
          if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  function setLocale(next: Locale) {
    if (!SUPPORTED_LOCALES.includes(next)) return
    setLocaleState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next)
      // Reflect on <html lang="..."> for assistive tech + browser hints
      document.documentElement.lang = next
    }
    // Persist to server (best-effort — local state is already updated)
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('va_access_token') : null
    if (token) {
      const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? ''
      fetch(`${apiBase}/api/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ preferredLocale: next }),
      }).catch(() => {})
    }
  }

  const value = useMemo<I18nContextValue>(() => {
    const dict = DICTIONARIES[locale]
    const enFallback = DICTIONARIES.en
    return {
      locale,
      setLocale,
      t(key, vars) {
        const template = lookup(dict, key) ?? lookup(enFallback, key) ?? key
        return interpolate(template, vars)
      },
    }
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Hook for translations. Returns `t(key, vars?)`. Outside of provider it
 *  no-ops to English so it never crashes a component rendered out of tree. */
export function useT() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    return (key: string, vars?: Record<string, string | number>) => {
      const template = lookup(DICTIONARIES.en, key) ?? key
      return interpolate(template, vars)
    }
  }
  return ctx.t
}

/** Hook for the current locale + setter. */
export function useLocale(): { locale: Locale; setLocale: (next: Locale) => void } {
  const ctx = useContext(I18nContext)
  if (!ctx) return { locale: 'en', setLocale: () => {} }
  return { locale: ctx.locale, setLocale: ctx.setLocale }
}
