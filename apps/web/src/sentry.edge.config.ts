import * as Sentry from '@sentry/nextjs'

// Edge-runtime Sentry init. No-ops when no DSN is set.
const dsn = process.env['SENTRY_DSN_WEB'] || process.env['NEXT_PUBLIC_SENTRY_DSN']
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'production',
    tracesSampleRate: 0,
  })
}
