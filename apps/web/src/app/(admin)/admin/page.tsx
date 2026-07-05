'use client'

import Link from 'next/link'
import { useApi } from '@/hooks/useApi'
import { getPlatformRoleTier, type PlatformRoleTier } from '@/lib/auth'

interface PlatformStatus {
  google: { configured: boolean }
  stripe: { configured: boolean }
  twilio: { configured: boolean }
  // All counts EXCLUDE soft-deleted tenants (deletedAt IS NOT NULL).
  tenantCount:      number
  activeCount:      number
  trialCount:       number
  suspendedCount:   number
  softDeletedCount: number
}

// True on the isolated MyOrbisAgents admin door. The card hub is agents-only;
// the Voice admin keeps its existing overview. Client component → window is safe.
function isAgentsHost(): boolean {
  return typeof window !== 'undefined' && window.location.host === 'app.myorbisagents.com'
}

// Role ranking so a card's `min` admits that tier and everything above it.
type Tier = Exclude<PlatformRoleTier, null>
const RANK: Record<Tier, number> = { super_admin: 3, admin: 2, support: 1 }

type Card = { label: string; href: string; icon: string; desc: string; min: Tier; group: string }

// Every MyOrbisAgents admin control, one card each. Deep-links into the full
// (existing) config page; role-gated. Grouped for the hub layout.
const ADMIN_CARDS: Card[] = [
  { group: 'Tenants & billing', label: 'Tenants',         href: '/admin/tenants',         icon: '🏢', desc: 'Search, view, configure, suspend, impersonate.', min: 'support' },
  { group: 'Tenants & billing', label: 'Plans & pricing', href: '/admin/plans',           icon: '💳', desc: 'Plans, entitlements, price mapping.',            min: 'admin' },
  { group: 'Tenants & billing', label: 'Comp codes',      href: '/admin/comp-codes',      icon: '🎟️', desc: 'Generate & track complimentary access codes.',   min: 'admin' },
  { group: 'Tenants & billing', label: 'Prospects',       href: '/admin/prospects',       icon: '🌱', desc: 'Inbound leads & onboarding pipeline.',           min: 'admin' },
  { group: 'Tenants & billing', label: 'Agent demos',     href: '/admin/agent-demos',     icon: '🏡', desc: 'Build a live Orby demo from an agent + 3 listings.', min: 'admin' },

  { group: 'Telephony & compliance', label: 'A2P compliance',  href: '/admin/a2p',             icon: '📋', desc: 'Review & submit 10DLC brand + campaigns.',      min: 'support' },
  { group: 'Telephony & compliance', label: 'Phone numbers',   href: '/admin/phone-numbers',   icon: '☎️', desc: 'Provisioned numbers, forwarding, capabilities.', min: 'admin' },
  { group: 'Telephony & compliance', label: 'Number requests', href: '/admin/number-requests', icon: '📨', desc: 'Approve & fulfill number requests.',             min: 'admin' },
  { group: 'Telephony & compliance', label: 'Call log',        href: '/admin/call-log',        icon: '📞', desc: 'Platform-wide call activity & recordings.',     min: 'support' },
  { group: 'Telephony & compliance', label: 'Twilio logs',     href: '/admin/twilio-logs',     icon: '🧾', desc: 'Raw Twilio webhook & delivery events.',         min: 'support' },

  { group: 'Partners & content', label: 'Partners',      href: '/admin/partners',      icon: '🤝', desc: 'Affiliate accounts, tiers, payouts.',      min: 'admin' },
  { group: 'Partners & content', label: 'Marketing kit', href: '/admin/marketing-kit', icon: '🎨', desc: 'Shared assets, decks, brand material.',     min: 'admin' },
  { group: 'Partners & content', label: 'Media center',  href: '/admin/media-center',  icon: '🎬', desc: 'Videos, images, downloadable resources.',  min: 'admin' },
  { group: 'Partners & content', label: 'Scripts',       href: '/admin/scripts',       icon: '📝', desc: 'Agent scripts & prompt library.',          min: 'admin' },

  { group: 'System', label: 'System settings', href: '/admin/system-settings', icon: '🔐', desc: 'Credentials & platform config (write-only).', min: 'super_admin' },
  { group: 'System', label: 'Team',            href: '/admin/team',            icon: '👥', desc: 'Grant/revoke platform-staff roles.',          min: 'super_admin' },
  { group: 'System', label: 'Email policy',    href: '/admin/email-policy',    icon: '✉️', desc: 'Sending domains, suppression, routing.',      min: 'admin' },
  { group: 'System', label: 'Errors',          href: '/admin/errors',          icon: '🚨', desc: 'Recent platform errors & failed workflows.', min: 'admin' },
]

const GROUP_ORDER = ['Tenants & billing', 'Telephony & compliance', 'Partners & content', 'System']

function AgentsAdminHub({ status, loading }: { status: PlatformStatus | null; loading: boolean }) {
  const tier = getPlatformRoleTier()
  const rank = tier ? RANK[tier] : 0
  const cards = ADMIN_CARDS.filter((c) => rank >= RANK[c.min])
  const grouped = GROUP_ORDER.map((g) => ({ group: g, items: cards.filter((c) => c.group === g) })).filter((x) => x.items.length)

  const tenantSub = status
    ? `${status.activeCount} active · ${status.trialCount} trial${status.suspendedCount ? ` · ${status.suspendedCount} suspended` : ''}`
    : ''

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>MyOrbisAgents — Admin</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Configure and track every part of the platform. Cards match your access.</p>
      </div>

      {/* headline tenant stat + integrations */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl px-5 py-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Tenants</p>
          <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{loading ? '—' : status?.tenantCount ?? 0}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{tenantSub}</p>
        </div>
        {(['google', 'stripe', 'twilio'] as const).map((k) => (
          <div key={k} className="rounded-xl px-5 py-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs mb-1 capitalize" style={{ color: 'var(--text-tertiary)' }}>{k}</p>
            <p className="text-sm font-semibold mt-2" style={{ color: status?.[k].configured ? 'oklch(72% 0.12 193)' : 'var(--text-tertiary)' }}>
              {status?.[k].configured ? '● Connected' : '○ Not set'}
            </p>
          </div>
        ))}
      </div>

      {grouped.map(({ group, items }) => (
        <section key={group} className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{group}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((c) => (
              <Link key={c.href} href={c.href} className="group rounded-xl px-5 py-5 transition hover:-translate-y-0.5"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', display: 'block' }}>
                <div className="flex items-start gap-3">
                  <span style={{ fontSize: 22 }}>{c.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.label}</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{c.desc}</p>
                    <p className="text-xs mt-3 font-medium" style={{ color: 'oklch(72% 0.12 193)' }}>Configure →</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default function AdminOverviewPage() {
  const { data, loading } = useApi<PlatformStatus>('/api/admin/platform/status')

  if (isAgentsHost()) return <AgentsAdminHub status={data ?? null} loading={loading} />

  // ---- MyOrbisVoice admin overview (unchanged) ----
  const cards = data ? [
    {
      label: 'Tenants',
      value: data.tenantCount,
      sub: `${data.activeCount} active · ${data.trialCount} trial${data.suspendedCount > 0 ? ` · ${data.suspendedCount} suspended` : ''}${data.softDeletedCount > 0 ? ` · ${data.softDeletedCount} archived` : ''}`,
    },
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

      {cards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl px-6 py-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{c.label}</p>
              <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{c.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.sub}</p>
            </div>
          ))}
        </div>
      )}

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
