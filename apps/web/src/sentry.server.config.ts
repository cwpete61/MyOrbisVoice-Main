import * as Sentry from '@sentry/nextjs'

// Server-side (Node runtime) Sentry init. No-ops when no DSN is set, so the
// web app runs identically with or without error monitoring.
const dsn = process.env['SENTRY_DSN_WEB'] || process.env['NEXT_PUBLIC_SENTRY_DSN']
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'production',
    tracesSampleRate: 0, // errors only
  })
}
