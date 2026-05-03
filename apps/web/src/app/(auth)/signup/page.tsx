'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiSignup } from '@/lib/api'
import { setTokens } from '@/lib/auth'
import { PasswordInput } from '@/components/PasswordInput'

function getReferralCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(/(?:^|; )ref=([^;]*)/)
  return match ? decodeURIComponent(match[1]!) : undefined
}

function RefCapture({ onRef }: { onRef: (code: string) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    const code = searchParams.get('ref') ?? getReferralCookie()
    if (code) onRef(code)
  }, [searchParams, onRef])
  return null
}

function SignupForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refCode, setRefCode] = useState<string | undefined>()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      const result = await apiSignup(username, email, password, businessName, refCode)
      setTokens(result.accessToken, result.refreshToken)
      router.push('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'var(--surface-app)' }}
    >
      <Suspense fallback={null}>
        <RefCapture onRef={setRefCode} />
      </Suspense>
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-7">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'oklch(55% 0.11 193)' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="3.5" fill="oklch(10% 0.01 193)" />
              <circle cx="9" cy="9" r="7.5" stroke="oklch(10% 0.01 193)" strokeOpacity="0.45" strokeWidth="2" />
            </svg>
          </div>
          <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>MyOrbisVoice</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: 'var(--text-primary)' }}>
          Create your account
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Free to start — no credit card required.
        </p>

        {error && <div className="alert-error mb-5">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Username</label>
            <input
              type="text"
              required
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="yourhandle"
            />
          </div>
          <div>
            <label className="label">Business name</label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="input"
              placeholder="Acme Services LLC"
            />
          </div>
          <div>
            <label className="label">Email address</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@yourbusiness.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <PasswordInput
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="At least 8 characters"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>or continue with</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
        </div>

        <a
          href="https://app.myorbisvoice.com/login"
          className="btn-ghost w-full flex items-center justify-center gap-2.5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </a>

        <p className="text-center mt-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          By signing up you agree to our{' '}
          <a href="https://myorbisvoice.com/terms.html" target="_blank" rel="noopener" style={{ color: 'oklch(55% 0.11 193)' }}>Terms</a>
          {' '}and{' '}
          <a href="https://myorbisvoice.com/privacy.html" target="_blank" rel="noopener" style={{ color: 'oklch(55% 0.11 193)' }}>Privacy Policy</a>.
        </p>

        <p className="text-center mt-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold" style={{ color: 'oklch(55% 0.11 193)' }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}
