'use client'

import { useRouter } from 'next/navigation'
import { clearTokens, getRefreshToken } from '@/lib/auth'
import { useT } from '@/lib/i18n/I18nProvider'

export function SignOutButton() {
  const router = useRouter()
  const t = useT()

  async function handleSignOut() {
    const rt = getRefreshToken()
    // Best-effort server-side revocation — don't block UI on failure
    if (rt) {
      fetch(`${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      }).catch(() => {})
    }
    clearTokens()
    router.push('/login')
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors w-full text-left"
      style={{ color: 'var(--text-tertiary)' }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2H13a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10M7 11l3-3-3-3M2 8h9" />
      </svg>
      {t('actions.signOut')}
    </button>
  )
}
