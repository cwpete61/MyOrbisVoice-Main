'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearTokens } from '@/lib/auth'
import { useT } from '@/lib/i18n/I18nProvider'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ContactBlock } from '@/components/ContactBlock'
import { IdleTimeout } from '@/components/IdleTimeout'

const NAV = [
  { href: '/partner-portal/dashboard',   labelKey: 'partnerNav.dashboard',   icon: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z' },
  { href: '/partner-portal/referrals',   labelKey: 'partnerNav.referrals',   icon: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
  { href: '/partner-portal/commissions', labelKey: 'partnerNav.commissions', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  { href: '/partner-portal/payouts',     labelKey: 'partnerNav.payouts',     icon: 'M1 5h14v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5zm0-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2' },
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

  function logout() {
    clearTokens()
    // Stay within the partner-portal flow on logout — tenant login is a
    // different surface. Partners shouldn't be dropped onto a screen that
    // says "log in to your tenant account."
    router.push('/partner-portal/login')
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface-app)' }}>
      <IdleTimeout redirectTo="/partner-portal/login" />
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: 'var(--surface-raised)', borderRight: '1px solid var(--border-subtle)' }}>
        {/* Brand */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>OrbisVoice</p>
          <p className="text-xs mt-0.5" style={{ color: 'oklch(65% 0.15 193)' }}>Partner Portal</p>
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
                {t(item.labelKey)}
              </Link>
            )
          })}
        </nav>

        {/* Footer — Profile then Sign out, anchored to bottom of sidebar */}
        <div className="px-3 py-3 space-y-0.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
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

      {/* Main */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Top bar — language toggle anchored top-right */}
        <div
          className="flex items-center justify-end px-8 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-app)' }}
        >
          <LanguageToggle />
        </div>
        <div className="max-w-4xl mx-auto w-full px-8 py-8 flex-1">
          {children}
        </div>
        {/* Contact emails — anchored at the bottom of the partner workspace */}
        <footer className="px-8 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="max-w-4xl mx-auto w-full">
            <ContactBlock compact />
          </div>
        </footer>
      </main>
    </div>
  )
}
