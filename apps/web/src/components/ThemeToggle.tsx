'use client'

/**
 * Phase G.5 — light mode is enforced site-wide; dark mode retired.
 *
 * The theme toggle is intentionally a no-op render (`null`). The component is
 * kept so the ~10 call sites that render `<ThemeToggle />` don't need editing;
 * they simply render nothing now. Remove the call sites in a later cleanup.
 */
export function ThemeToggle(_: { className?: string } = {}) {
  return null
}
