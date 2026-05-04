'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearTokens } from '@/lib/auth'

const NAV = [
  { href: '/partner-portal/dashboard',   label: 'Dashboard',   icon: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z' },
  { href: '/partner-portal/referrals',   label: 'Referral Links', icon: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
  { href: '/partner-portal/commissions', label: 'Commissions', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  { href: '/partner-portal/payouts',     label: 'Payouts',     icon: 'M1 5h14v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5zm0-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2' },
  { href: '/partner-portal/profile',     label: 'Profile',     icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
]

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

  function logout() {
    clearTokens()
    // Stay within the partner-portal flow on logout — tenant login is a
    // different surface. Partners shouldn't be dropped onto a screen that
    // says "log in to your tenant account."
    router.push('/partner-portal/login')
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--surface-app)' }}>
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
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs w-full px-2 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
