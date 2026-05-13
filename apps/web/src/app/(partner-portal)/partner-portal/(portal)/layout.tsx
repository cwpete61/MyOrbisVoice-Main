'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearTokens } from '@/lib/auth'
import { useT } from '@/lib/i18n/I18nProvider'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ContactBlock } from '@/components/ContactBlock'
import { SocialLinks } from '@/components/SocialLinks'
import { IdleTimeout } from '@/components/IdleTimeout'
import { NotificationBell } from '@/components/NotificationBell'
import { PartnerIdBadge } from '@/components/PartnerIdBadge'
import { useApi } from '@/hooks/useApi'

const NAV = [
  { href: '/partner-portal/dashboard',   labelKey: 'partnerNav.dashboard',   icon: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z' },
  { href: '/partner-portal/mailbox',     labelKey: 'partnerNav.mailbox',     icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM2 6l10 7l10-7' },
  { href: '/partner-portal/calendar',    labelKey: 'partnerNav.calendar',    icon: 'M3 9h18M3 5h18v14H3zM8 3v4M16 3v4' },
  { href: '/partner-portal/conversations', labelKey: 'partnerNav.conversations', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { href: '/partner-portal/crm',         labelKey: 'partnerNav.crm',         icon: 'M3 4h4v6H3zm7 0h4v6h-4zm7 0h4v6h-4zM3 13h4v6H3zm7 0h4v6h-4zm7 0h4v6h-4z' },
  { href: '/partner-portal/contacts',    labelKey: 'partnerNav.contacts',    icon: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 21v-2a4 4 0 0 0-3-3.87' },
  { href: '/partner-portal/campaigns',   labelKey: 'partnerNav.campaigns',   icon: 'M3 12l4-4v8l-4-4zm6-5l8 5-8 5V7zm10 0v10' },
  { href: '/partner-portal/referrals',   labelKey: 'partnerNav.referrals',   icon: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
  { href: '/partner-portal/commissions', labelKey: 'partnerNav.commissions', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  { href: '/partner-portal/payouts',     labelKey: 'partnerNav.payouts',     icon: 'M1 5h14v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5zm0-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2' },
  { href: '/partner-portal/marketing-kit', labelKey: 'partnerNav.marketingKit', icon: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z' },
  { href: '/partner-portal/landing-page',  labelKey: 'partnerNav.landingPage',  icon: 'M3 5h18v14H3zM3 9h18M7 5v14' },
  { href: '/partner-portal/market-vault',  labelKey: 'partnerNav.marketVault',  icon: 'M5 7h14l-1 12H6L5 7zM9 7V5a3 3 0 0 1 6 0v2',                                                                                                                                                                                                                                                              comingSoon: true },
  { href: '/partner-portal/help',          labelKey: 'partnerNav.help',         icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01' },
]

// Profile + Sign out live at the bottom of the sidebar — separate from
// the main work nav above. Visually anchors "account stuff" to the
// bottom of the rail.
const PROFILE_NAV = { href: '/partner-portal/profile', labelKey: 'partnerNav.profile', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' }

function Icon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export default function AffiliatePortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useT()
  // Pull username + name + email so we can show the partner who they're
  // signed in as. JWT doesn't carry username so we go to /api/auth/me.
  const { data: me } = useApi<{ user: { username: string; email: string; firstName: string | null; lastName: string | null } }>('/api/auth/me')
  const username = me?.user?.username
  const fullName = [me?.user?.firstName, me?.user?.lastName].filter(Boolean).join(' ').trim() || null
  const initials = (username ?? me?.user?.email ?? '??').slice(0, 2).toUpperCase()

  function logout() {
    clearTokens()
    // Stay within the partner-portal flow on logout — tenant login is a
    // different surface. Partners shouldn't be dropped onto a screen that
    // says "log in to your tenant account."
    router.push('/partner-portal/login')
  }

  return (
    // h-screen + overflow-hidden anchors the sidebar to the viewport so it
    // never scrolls with the content. Main is the only scroll surface.
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--surface-app)' }}>
      <IdleTimeout redirectTo="/partner-portal/login" />
      {/* Sidebar — fixed-height column, no internal scroll. The 7 nav items +
          profile + sign-out fit comfortably in any reasonable viewport. */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: 'var(--surface-raised)', borderRight: '1px solid var(--border-subtle)' }}>
        {/* Brand */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>MyOrbisVoice</p>
          <p className="text-xs mt-0.5" style={{ color: 'oklch(65% 0.15 193)' }}>{t('partnerNav.brandSubtitle')}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={active
                  ? { background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)', fontWeight: 600 }
                  : { color: 'var(--text-secondary)' }}
              >
                <span style={{ opacity: active ? 1 : 0.7 }}><Icon d={item.icon} /></span>
                <span className="flex-1">{t(item.labelKey)}</span>
                {('comingSoon' in item && item.comingSoon) && (
                  <span
                    className="text-[9px] px-1 py-0.5 rounded font-semibold uppercase tracking-wider flex-shrink-0"
                    style={{ background: 'oklch(55% 0.11 193 / 0.15)', color: 'oklch(65% 0.15 193)', letterSpacing: '0.08em' }}
                  >
                    {t('partnerNav.soonPill')}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer — signed-in-as badge, then Profile, then Sign out.
            Username row is the primary identifier; full name (if set)
            shows below as a hint. Both clickable → Profile page. */}
        <div className="px-3 py-3 space-y-0.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {username && (
            <Link
              href={PROFILE_NAV.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
                style={{ background: 'oklch(55% 0.11 193 / 0.18)', color: 'oklch(72% 0.12 193)' }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{username}</p>
                {fullName && <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>{fullName}</p>}
              </div>
            </Link>
          )}
          {(() => {
            const active = pathname === PROFILE_NAV.href || pathname.startsWith(PROFILE_NAV.href + '/')
            return (
              <Link
                href={PROFILE_NAV.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={active
                  ? { background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)', fontWeight: 600 }
                  : { color: 'var(--text-secondary)' }}
              >
                <span style={{ opacity: active ? 1 : 0.7 }}><Icon d={PROFILE_NAV.icon} /></span>
                {t(PROFILE_NAV.labelKey)}
              </Link>
            )
          })()}

          <button
            onClick={logout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <span style={{ opacity: 0.7 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </span>
            {t('actions.signOut')}
          </button>
        </div>
      </aside>

      {/* Main — only scroll surface (sidebar above is anchored to viewport). */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Top bar — partner ID badge, notifications bell, language + theme.
            Mirrors the tenant dashboard's top-right cluster so partners get
            the same affordances. */}
        <div
          className="flex items-center justify-end gap-2 px-8 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-app)' }}
        >
          <PartnerIdBadge />
          <NotificationBell
            endpoint="/api/affiliate/notifications"
            readOne={(id) => `/api/affiliate/notifications/${id}/read`}
            readAll="/api/affiliate/notifications/read-all"
          />
          <LanguageToggle />
          <ThemeToggle />
        </div>
        {/* CRM + Contacts surfaces render full-width to match the tenant
            dashboard's kanban + contact-detail layouts. Every other partner
            page keeps the narrower max-w-4xl reading column the rest of the
            portal was designed for. */}
        {(() => {
          const isFullWidth = pathname.startsWith('/partner-portal/crm')
            || pathname.startsWith('/partner-portal/contacts')
            || pathname.startsWith('/partner-portal/campaigns')
          return isFullWidth ? (
            <div className="w-full px-8 py-8 flex-1">{children}</div>
          ) : (
            <div className="max-w-4xl mx-auto w-full px-8 py-8 flex-1">{children}</div>
          )
        })()}
        {/* Contact emails + social — anchored at the bottom of the partner workspace */}
        <footer className="px-8 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="max-w-4xl mx-auto w-full flex flex-wrap items-center justify-between gap-4">
            <ContactBlock compact />
            <SocialLinks />
          </div>
        </footer>
      </main>
    </div>
  )
}
