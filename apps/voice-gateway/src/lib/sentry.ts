import * as Sentry from '@sentry/node'

// Error monitoring for the voice gateway. No-ops cleanly when
// SENTRY_DSN_GATEWAY is unset. Sentry's init auto-installs handlers for
// uncaughtException + unhandledRejection, so a gateway crash is captured
// even without explicit try/catch in the WebSocket handlers.

let enabled = false

/** Initialize Sentry. Call once, as early as possible in process startup. */
export function initSentry(): void {
  const dsn = process.env['SENTRY_DSN_GATEWAY']
  if (!dsn) {
    console.log('[sentry] SENTRY_DSN_GATEWAY not set — error monitoring disabled')
    return
  }
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'production',
    tracesSampleRate: 0,
  })
  enabled = true
  console.log('[sentry] error monitoring enabled')
}

/** Report an error to Sentry. No-op when Sentry is not configured. */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return
  Sentry.captureException(err, context ? { extra: context } : undefined)
}
