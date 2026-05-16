'use client'

import { createContext, useContext, useEffect } from 'react'

/**
 * Phase G.5 — light mode is enforced site-wide. Dark mode has been retired.
 *
 * This provider is kept (rather than deleted) so existing `useTheme()` callers
 * don't break, but it is now a fixed light-only shim: theme is always 'light'
 * and toggle is a no-op. The `light` class is applied on <html> by the inline
 * bootstrap in app/layout.tsx; this effect just re-asserts it + clears any
 * stale `dark` class / stored preference from before the cutover.
 */
type Theme = 'light'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement
    html.classList.remove('dark')
    html.classList.add('light')
    // Clear any pre-cutover stored preference so it can't resurrect dark mode.
    try { localStorage.removeItem('va_theme') } catch { /* ignore */ }
  }, [])

  return <ThemeContext.Provider value={{ theme: 'light', toggle: () => {} }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
