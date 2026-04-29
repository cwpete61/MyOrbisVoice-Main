'use client'

import Link from 'next/link'
import { useApi } from '@/hooks/useApi'

interface PlatformStatus {
  google: { configured: boolean }
  stripe: { configured: boolean }
  twilio: { configured: boolean }
  tenantCount: number
  activeCount: number
}

export default function AdminOverviewPage() {
  const { data, loading } = useApi<PlatformStatus>('/api/admin/platform/status')

  const cards = data ? [
    { label: 'Tenants', value: data.tenantCount, sub: `${data.activeCount} active` },
  ] : []

  const integrations = data ? [
    { name: 'Google OAuth', ok: data.google.configured, hint: 'GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET' },
    { name: 'Stripe', ok: data.stripe.configured, hint: 'STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET' },
    { name: 'Twilio', ok: data.twilio.configured, hint: 'TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN' },
  ] : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Platform Overview</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          MyOrbisVoice platform status and configuration.
        </p>
      </div>

      {loading && <div className="h-4 w-48 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />}

      {/* Stats */}
      {cards.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl px-6 py-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{c.label}</p>
              <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{c.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Integration status */}
      {integrations.length > 0 && (
        <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Platform Integrations</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Set missing credentials in your server environment, then restart the API.
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {integrations.map((i) => (
              <div key={i.name} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{i.name}</p>
                  {!i.ok && (
                    <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-tertiary)' }}>{i.hint}</p>
                  )}
                </div>
                <span
                  className="badge"
                  style={i.ok
                    ? { background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }
                    : { background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }
                  }
                >
                  {i.ok ? 'Configured' : 'Not configured'}
                </span>
              </div>
            ))}
          </div>
          <div className="px-6 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <Link href="/admin/settings" className="text-xs font-medium hover:underline" style={{ color: 'oklch(72% 0.12 193)' }}>
              View Platform Settings →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
