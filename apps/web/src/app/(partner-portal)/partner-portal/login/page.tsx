'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiLogin } from '@/lib/api'
import { setTokens, clearTokens, getTokenPayload } from '@/lib/auth'
import { PasswordInput } from '@/components/PasswordInput'

export default function AffiliateLoginPage() {
  const router = useRouter()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    clearTokens()
    try {
      const result = await apiLogin(loginId, password)
      setTokens(result.accessToken, result.refreshToken)
      const payload = getTokenPayload()
      if (payload?.roleKey === 'affiliate' || payload?.isPlatformRole) {
        router.push('/partner-portal/dashboard')
      } else {
        setError('This account is not a partner account. Log in to the main app instead.')
        clearTokens()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--surface-app)' }}>
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'oklch(55% 0.11 193)' }}>
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="3.5" fill="oklch(10% 0.01 193)" />
              <circle cx="9" cy="9" r="7.5" stroke="oklch(10% 0.01 193)" strokeOpacity="0.45" strokeWidth="2" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm leading-none" style={{ color: 'var(--text-primary)' }}>OrbisVoice</p>
            <p className="text-xs mt-0.5" style={{ color: 'oklch(65% 0.15 193)' }}>Partner Portal</p>
          </div>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Partner login</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Sign in to your partner account.</p>

          {error && <div className="alert-error mb-5">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username or email</label>
              <input
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <PasswordInput
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="Your password"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
              {loading ? 'Signing in…' : 'Sign in to Partner Portal'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            New partner?{' '}
            <Link href="/partner-portal/signup" className="font-semibold" style={{ color: 'oklch(55% 0.11 193)' }}>
              Create an account
            </Link>
          </p>
          <p className="text-center mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Not a partner?{' '}
            <Link href="/login" style={{ color: 'oklch(55% 0.11 193)' }}>
              Sign in to the main app
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
