import * as Sentry from '@sentry/nextjs'

// Client-side (browser) Sentry init. The DSN is public by design (it ships in
// the client bundle). No-ops when NEXT_PUBLIC_SENTRY_DSN is unset.
const dsn = process.env['NEXT_PUBLIC_SENTRY_DSN']
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'production',
    tracesSampleRate: 0, // errors only
  })
}

// Captures client-side navigation for error context. No-op when Sentry is
// not initialized.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
