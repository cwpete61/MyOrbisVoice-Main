'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {},
})

function applyTheme(t: Theme) {
  const html = document.documentElement
  // Apply both class names — CSS uses .dark and .light selectors
  html.classList.remove('dark', 'light')
  html.classList.add(t)
  localStorage.setItem('va_theme', t)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('va_theme') as Theme | null
    // Precedence: explicit user choice (localStorage) → OS preference
    // (prefers-color-scheme) → 'dark' fallback. Honoring the OS preference on
    // first visit means a Mac user in light mode sees a light UI by default
    // instead of being slammed with a dark surface they didn't ask for.
    let initial: Theme
    if (stored === 'light' || stored === 'dark') {
      initial = stored
    } else if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      initial = 'light'
    } else {
      initial = 'dark'
    }
    setTheme(initial)
    applyTheme(initial)
  }, [])

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light'
      applyTheme(next)
      return next
    })
  }, [])

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
