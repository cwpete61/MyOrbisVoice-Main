'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearTokens } from '@/lib/auth'
import { useT } from '@/lib/i18n/I18nProvider'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ContactBlock } from '@/components/ContactBlock'
import { SocialLinks } from '@/components/SocialLinks'
import { IdleTimeout } from '@/components/IdleTimeout'
import { NotificationBell } from '@/components/NotificationBell'
import { PartnerIdBadge } from '@/components/PartnerIdBadge'
import { useApi } from '@/hooks/useApi'

const NAV = [
  { href: '/partner-portal/dashboard',   labelKey: 'partnerNav.dashboard',   icon: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z' },
  { href: '/partner-portal/getting-started', labelKey: 'partnerNav.gettingStarted', icon: 'M9 11l3 3L20 5M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  { href: '/partner-portal/mailbox',     labelKey: 'partnerNav.mailbox',     icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM2 6l10 7l10-7' },
  { href: '/partner-portal/calendar',    labelKey: 'partnerNav.calendar',    icon: 'M3 9h18M3 5h18v14H3zM8 3v4M16 3v4' },
  { href: '/partner-portal/phone-numbers', labelKey: 'partnerNav.phoneNumbers', icon: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' },
  { href: '/partner-portal/a2p',           labelKey: 'partnerNav.a2p',          icon: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4zM9 12l2 2 4-4' },
  { href: '/partner-portal/conversations', labelKey: 'partnerNav.conversations', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { href: '/partner-portal/crm',         labelKey: 'partnerNav.crm',         icon: 'M3 4h4v6H3zm7 0h4v6h-4zm7 0h4v6h-4zM3 13h4v6H3zm7 0h4v6h-4zm7 0h4v6h-4z' },
  { href: '/partner-portal/contacts',    labelKey: 'partnerNav.contacts',    icon: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 21v-2a4 4 0 0 0-3-3.87' },
  { href: '/partner-portal/leads',       labelKey: 'partnerNav.leads',       icon: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z' },
  { href: '/partner-portal/campaigns',   labelKey: 'partnerNav.campaigns',   icon: 'M3 12l4-4v8l-4-4zm6-5l8 5-8 5V7zm10 0v10' },
  { href: '/partner-portal/referrals',   labelKey: 'partnerNav.referrals',   icon: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
  { href: '/partner-portal/commissions', labelKey: 'partnerNav.commissions', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  { href: '/partner-portal/payouts',     labelKey: 'partnerNav.payouts',     icon: 'M1 5h14v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5zm0-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2' },
  { href: '/partner-portal/marketing-kit', labelKey: 'partnerNav.marketingKit', icon: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z' },
  { href: '/partner-portal/landing-page',  labelKey: 'partnerNav.landingPage',  icon: 'M3 5h18v14H3zM3 9h18M7 5v14' },
  { href: '/partner-portal/market-vault',  labelKey: 'partnerNav.marketVault',  icon: 'M5 7h14l-1 12H6L5 7zM9 7V5a3 3 0 0 1 6 0v2',                                                                                                                                                                                                                                                              comingSoon: true },
  { href: '/partner-portal/bulk-email',  labelKey: 'partnerNav.bulkEmail',   icon: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z', accent: 'red' },
  { href: '/partner-portal/help',          labelKey: 'partnerNav.help',         icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01' },
]

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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: me } = useApi<{ user: { username: string; email: string; firstName: string | null; lastName: string | null } }>('/api/auth/me')
  const username = me?.user?.username
  const fullName = [me?.user?.firstName, me?.user?.lastName].filter(Boolean).join(' ').trim() || null
  const initials = (username ?? me?.user?.email ?? '??').slice(0, 2).toUpperCase()

  function logout() {
    clearTokens()
    router.push('/partner-portal/login')
  }

  // Sidebar inner content — shared by the desktop rail + the mobile drawer.
  // `onNav` closes the mobile drawer after a tap.
  function SidebarContents({ onNav }: { onNav?: () => void }) {
    return (
      <>
        {/* Brand — pinned */}
        <div className="px-5 py-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>MyOrbisVoice</p>
          <p className="text-xs mt-0.5" style={{ color: 'oklch(45% 0.13 193)' }}>{t('partnerNav.brandSubtitle')}</p>
        </div>

        {/* Nav — flex-1 + min-h-0 so it scrolls internally on short viewports. */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-0.5" onClick={onNav}>
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            // Red-accent items (Bulk Email) render solid red with white text +
            // icon at all times — a deliberate "this is a different system" cue.
            const isRed = 'accent' in item && item.accent === 'red'
            const style = isRed
              ? { background: active ? 'oklch(48% 0.20 25)' : 'oklch(55% 0.21 25)', color: 'white', fontWeight: 600 }
              : active
                ? { background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)', fontWeight: 600 }
                : { color: 'var(--text-secondary)' }
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={style}
              >
                <span style={{ opacity: isRed || active ? 1 : 0.7 }}><Icon d={item.icon} /></span>
                <span className="flex-1">{t(item.labelKey)}</span>
                {('comingSoon' in item && item.comingSoon) && (
                  <span
                    className="text-[9px] px-1 py-0.5 rounded font-semibold uppercase tracking-wider flex-shrink-0"
                    style={{ background: 'oklch(55% 0.11 193 / 0.15)', color: 'oklch(45% 0.13 193)', letterSpacing: '0.08em' }}
                  >
                    {t('partnerNav.soonPill')}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer — pinned. Profile + Sign out always visible. */}
        <div className="px-3 py-3 space-y-0.5 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {username && (
            <Link
              href={PROFILE_NAV.href}
              onClick={onNav}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
                style={{ background: 'oklch(55% 0.11 193 / 0.18)', color: 'oklch(45% 0.13 193)' }}
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
                onClick={onNav}
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
      </>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--surface-app)' }}>
      <IdleTimeout redirectTo="/partner-portal/login" />

      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col" style={{ background: 'var(--surface-raised)', borderRight: '1px solid var(--border-subtle)' }}>
        <SidebarContents />
      </aside>

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setSidebarOpen(false)} />
          <aside
            className="relative flex flex-col w-72 max-w-[85vw] h-full z-50"
            style={{ background: 'var(--surface-raised)', borderRight: '1px solid var(--border-subtle)' }}
          >
            <SidebarContents onNav={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Mobile top bar — hamburger + brand + bell. */}
        <header
          className="flex md:hidden items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-app)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>MyOrbisVoice</span>
          <div className="flex items-center gap-1">
            <NotificationBell
              endpoint="/api/affiliate/notifications"
              readOne={(id) => `/api/affiliate/notifications/${id}/read`}
              readAll="/api/affiliate/notifications/read-all"
            />
            <LanguageToggle />
          </div>
        </header>

        {/* Desktop top bar. */}
        <div
          className="hidden md:flex items-center justify-end gap-2 px-8 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-app)' }}
        >
          <PartnerIdBadge />
          <NotificationBell
            endpoint="/api/affiliate/notifications"
            readOne={(id) => `/api/affiliate/notifications/${id}/read`}
            readAll="/api/affiliate/notifications/read-all"
          />
          <LanguageToggle />
        </div>

        {/* Page content — full-width across the portal; tighter padding on mobile. */}
        <div className="w-full px-4 py-6 md:px-8 md:py-8 flex-1">{children}</div>

        {/* Contact emails + social — anchored at the bottom. */}
        <footer className="px-4 md:px-8 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="w-full flex flex-wrap items-center justify-between gap-4">
            <ContactBlock compact />
            <SocialLinks />
          </div>
        </footer>
      </main>
    </div>
  )
}
