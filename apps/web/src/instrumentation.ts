import * as Sentry from '@sentry/nextjs'

// Next.js instrumentation hook — loads the runtime-appropriate Sentry config
// at server startup. Each config file no-ops without a DSN.
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env['NEXT_RUNTIME'] === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Captures errors thrown in server components / route handlers. No-op when
// Sentry is not initialized.
export const onRequestError = Sentry.captureRequestError
