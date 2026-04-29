'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiSignup } from '@/lib/api'
import { setTokens } from '@/lib/auth'
import { PasswordInput } from '@/components/PasswordInput'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function SignupPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await apiSignup(username, email, password, businessName)
      setTokens(result.accessToken, result.refreshToken)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface-base)' }}>
      {/* Left — decorative */}
      <div
        className="hidden lg:flex flex-1 flex-col justify-between p-12"
        style={{ background: 'oklch(19% 0.04 193)', minHeight: '100vh' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'oklch(55% 0.11 193 / 0.15)' }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="3" fill="white" fillOpacity="0.9" />
              <circle cx="7" cy="7" r="6" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" />
            </svg>
          </div>
          <span className="text-sm font-semibold" style={{ color: 'oklch(90% 0.07 193)' }}>MyOrbisVoice</span>
        </div>

        <ul className="space-y-4 max-w-xs">
          {[
            'Voice agents that answer, book, and follow up — automatically.',
            'Connect your Google Calendar and let the agent do the scheduling.',
            'Full visibility into every conversation, appointment, and outcome.',
          ].map((text) => (
            <li key={text} className="flex items-start gap-3">
              <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'oklch(55% 0.11 193 / 0.15)' }}>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-sm leading-relaxed" style={{ color: 'oklch(72% 0.10 193)' }}>{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-sm mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1.5" style={{ color: 'var(--text-primary)' }}>
            Create your account
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Get your voice agents running in minutes.
          </p>
        </div>

        {error && (
          <div className="alert-error mb-6">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="label">Username</label>
            <input
              id="username"
              type="text"
              required
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="yourname"
            />
          </div>
          <div>
            <label htmlFor="businessName" className="label">Business name</label>
            <input
              id="businessName"
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="input"
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <label htmlFor="email" className="label">Work email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <PasswordInput
              id="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="At least 8 characters"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Creating account…' : 'Get started'}
          </button>
        </form>

        <p className="mt-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-medium hover:underline" style={{ color: 'oklch(72% 0.12 193)' }}>
            Sign in
          </Link>
        </p>
      </div>

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
    </div>
  )
}
