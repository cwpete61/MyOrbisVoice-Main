'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiLogin } from '@/lib/api'
import { setTokens, clearTokens, isPlatformAdmin } from '@/lib/auth'
import { PasswordInput } from '@/components/PasswordInput'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function LoginPage() {
  const router = useRouter()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    clearTokens()
    try {
      const result = await apiLogin(login, password)
      setTokens(result.accessToken, result.refreshToken)
      router.push(isPlatformAdmin() ? '/admin' : '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface-base)' }}>
      {/* Left — form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-sm mx-auto w-full">
        <div className="mb-12">
          <div className="flex items-center gap-2.5 mb-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'oklch(19% 0.04 193)' }}
            >
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="3" fill="white" fillOpacity="0.9" />
                <circle cx="7" cy="7" r="6" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>MyOrbisVoice</span>
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1.5" style={{ color: 'var(--text-primary)' }}>
            Welcome back
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Sign in to your workspace
          </p>
        </div>

        {error && (
          <div className="alert-error mb-6">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="login" className="label">Username or email</label>
            <input
              id="login"
              type="text"
              required
              autoComplete="username"
              autoFocus
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="input"
              placeholder="Username or you@company.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <PasswordInput
              id="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-medium hover:underline" style={{ color: 'oklch(72% 0.12 193)' }}>
            Create one
          </Link>
        </p>
      </div>

      {/* Right — decorative panel */}
      <div
        className="hidden lg:flex flex-1 flex-col justify-end p-12"
        style={{ background: 'oklch(19% 0.04 193)', minHeight: '100vh' }}
      >
        <blockquote className="max-w-xs">
          <p className="text-lg font-medium leading-relaxed mb-4" style={{ color: 'oklch(90% 0.07 193)' }}>
            &ldquo;Our agents handle the phones. We handle the business.&rdquo;
          </p>
          <footer className="text-sm" style={{ color: 'oklch(55% 0.09 193)' }}>
            Voice automation for growing teams
          </footer>
        </blockquote>
      </div>

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
    </div>
  )
}
