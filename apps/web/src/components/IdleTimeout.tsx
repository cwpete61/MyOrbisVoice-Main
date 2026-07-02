'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ssoLogout } from '@/lib/auth'
import { useT } from '@/lib/i18n/I18nProvider'

interface Props {
  /** Idle window in milliseconds before the warning modal appears. */
  idleMs?: number
  /** Grace period in milliseconds after the warning before forced logout. */
  graceMs?: number
  /** Deprecated — logout now always SSO-logs-out to the hub dashboard. Kept for API compat. */
  redirectTo?: string
}

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel'] as const

/**
 * Idle-session auto-logout. After `idleMs` of no user activity, shows a
 * "Are you still there?" warning modal. The user has `graceMs` to click
 * "I'm still here" or they're forcibly logged out and redirected.
 *
 * Activity during the warning is intentionally ignored — only an explicit
 * button click resets the timer (matches the security-lock convention used
 * by banks and healthcare apps).
 *
 * Activity events are throttled to once per second so we don't reset the
 * timer hundreds of times per second on mousemove.
 */
export function IdleTimeout({
  idleMs = 10 * 60 * 1000,   // 10 minutes
  graceMs = 60 * 1000,       // 60 seconds
  redirectTo,
}: Props) {
  const t = useT()
  const [warning, setWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(graceMs / 1000))

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastResetRef = useRef(0)

  function clearAllTimers() {
    if (idleTimerRef.current)  { clearTimeout(idleTimerRef.current); idleTimerRef.current = null }
    if (graceTimerRef.current) { clearTimeout(graceTimerRef.current); graceTimerRef.current = null }
    if (countdownRef.current)  { clearInterval(countdownRef.current); countdownRef.current = null }
  }

  const forceLogout = useCallback(() => {
    clearAllTimers()
    setWarning(false)
    ssoLogout(redirectTo)
  }, [redirectTo])

  const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      // Idle window elapsed — show warning, start grace period.
      setWarning(true)
      setSecondsLeft(Math.ceil(graceMs / 1000))

      if (countdownRef.current) clearInterval(countdownRef.current)
      countdownRef.current = setInterval(() => {
        setSecondsLeft(s => Math.max(0, s - 1))
      }, 1000)

      if (graceTimerRef.current) clearTimeout(graceTimerRef.current)
      graceTimerRef.current = setTimeout(forceLogout, graceMs)
    }, idleMs)
  }, [idleMs, graceMs, forceLogout])

  // Called on real user activity. Only resets the idle timer when the
  // warning is NOT showing — once the modal is up, only the explicit
  // "I'm still here" click counts.
  const handleActivity = useCallback(() => {
    if (warning) return
    const now = Date.now()
    if (now - lastResetRef.current < 1000) return  // throttle to 1/sec
    lastResetRef.current = now
    startIdleTimer()
  }, [warning, startIdleTimer])

  // Explicit "I'm still here" — resets everything.
  function dismissWarning() {
    clearAllTimers()
    setWarning(false)
    lastResetRef.current = Date.now()
    startIdleTimer()
  }

  useEffect(() => {
    startIdleTimer()
    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, handleActivity, { passive: true }),
    )
    return () => {
      clearAllTimers()
      ACTIVITY_EVENTS.forEach(ev =>
        window.removeEventListener(ev, handleActivity),
      )
    }
  }, [startIdleTimer, handleActivity])

  if (!warning) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-warning-title"
        className="w-full max-w-sm rounded-2xl p-6 text-center"
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
          style={{ background: 'oklch(55% 0.11 193 / 0.12)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="oklch(55% 0.11 193)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h2
          id="idle-warning-title"
          className="text-lg font-semibold mb-1.5"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('idleTimeout.title')}
        </h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
          {t('idleTimeout.body', { seconds: secondsLeft })}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={forceLogout}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'var(--surface-overlay)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {t('idleTimeout.logoutNow')}
          </button>
          <button
            type="button"
            onClick={dismissWarning}
            autoFocus
            className="btn-primary flex-1"
          >
            {t('idleTimeout.stay')}
          </button>
        </div>
      </div>
    </div>
  )
}
