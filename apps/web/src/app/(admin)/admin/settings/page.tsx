'use client'

import { useApi } from '@/hooks/useApi'

interface PlatformStatus {
  google: { configured: boolean; redirectUri: string }
  stripe: { configured: boolean }
  twilio: { configured: boolean }
}

interface Row {
  label: string
  envVar: string
  present: boolean
  secret?: boolean
}

export default function PlatformSettingsPage() {
  const { data, loading } = useApi<PlatformStatus>('/api/admin/platform/status')

  const sections = data ? [
    {
      title: 'Google OAuth',
      description: 'Required for tenant Google account connections (agent mailbox, Calendar). Create a project at console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client ID.',
      configured: data.google.configured,
      rows: [
        { label: 'Client ID', envVar: 'GOOGLE_CLIENT_ID', present: data.google.configured, secret: false },
        { label: 'Client Secret', envVar: 'GOOGLE_CLIENT_SECRET', present: data.google.configured, secret: true },
        { label: 'Redirect URI (whitelist this in Google Cloud)', envVar: 'GOOGLE_OAUTH_REDIRECT_URI', present: true, secret: false },
      ] as Row[],
      extra: (
        <div className="mt-3 px-4 py-3 rounded-lg text-xs font-mono break-all" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}>
          {data.google.redirectUri}
        </div>
      ),
    },
    {
      title: 'Stripe',
      description: 'Required for subscription billing, checkout sessions, and webhook lifecycle. Use test mode keys during development.',
      configured: data.stripe.configured,
      rows: [
        { label: 'Secret Key', envVar: 'STRIPE_SECRET_KEY', present: data.stripe.configured, secret: true },
        { label: 'Webhook Secret', envVar: 'STRIPE_WEBHOOK_SECRET', present: data.stripe.configured, secret: true },
      ] as Row[],
    },
    {
      title: 'Twilio',
      description: 'Required for inbound and outbound voice calls and SMS. Not needed until Phase 6.',
      configured: data.twilio.configured,
      rows: [
        { label: 'Account SID', envVar: 'TWILIO_ACCOUNT_SID', present: data.twilio.configured, secret: false },
        { label: 'Auth Token', envVar: 'TWILIO_AUTH_TOKEN', present: data.twilio.configured, secret: true },
      ] as Row[],
    },
  ] : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Platform Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Platform-level credentials are set as environment variables on the server and take effect after an API restart.
        </p>
      </div>

      {loading && <div className="h-4 w-48 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />}

      {sections.map((section) => (
        <div key={section.title} className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-start justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{section.title}</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{section.description}</p>
            </div>
            <span
              className="badge flex-shrink-0"
              style={section.configured
                ? { background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }
                : { background: 'oklch(13% 0.04 25)', color: 'oklch(68% 0.20 25)' }
              }
            >
              {section.configured ? 'Configured' : 'Missing'}
            </span>
          </div>

          <div className="px-6 py-5 space-y-3">
            {section.rows.map((row) => (
              <div key={row.envVar} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{row.label}</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{row.envVar}</p>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                  style={row.present
                    ? { background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }
                    : { background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }
                  }
                >
                  {row.present ? (row.secret ? '••••••••' : 'Set') : 'Not set'}
                </span>
              </div>
            ))}
            {section.extra}
          </div>
        </div>
      ))}
    </div>
  )
}
