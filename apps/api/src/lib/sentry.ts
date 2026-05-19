import * as Sentry from '@sentry/node'

// Error monitoring for the API. No-ops cleanly when SENTRY_DSN_API is unset,
// so the platform runs identically with or without it — the DSN is added to
// .env.prod once the Sentry project exists, and monitoring lights up on the
// next deploy with no code change.

let enabled = false

/** Initialize Sentry. Call once, as early as possible in process startup. */
export function initSentry(): void {
  const dsn = process.env['SENTRY_DSN_API']
  if (!dsn) {
    console.log('[sentry] SENTRY_DSN_API not set — error monitoring disabled')
    return
  }
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'production',
    // Errors only — no performance tracing, keeps volume + cost minimal.
    tracesSampleRate: 0,
  })
  enabled = true
  console.log('[sentry] error monitoring enabled')
}

/** Report an unhandled error to Sentry. No-op when Sentry is not configured. */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return
  Sentry.captureException(err, context ? { extra: context } : undefined)
}
