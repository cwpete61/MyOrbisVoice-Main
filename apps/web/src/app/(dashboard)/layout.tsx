import { AuthGuard } from '@/components/AuthGuard'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SidebarNav } from '@/components/SidebarNav'
import { SignOutButton } from '@/components/SignOutButton'
import { SidebarUserBadge } from '@/components/SidebarUserBadge'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="h-screen flex overflow-hidden" style={{ background: 'var(--surface-app)' }}>
        {/* Sidebar */}
        <aside
          className="w-52 flex-shrink-0 flex flex-col"
          style={{
            background: 'var(--surface-sidebar)',
            borderRight: '1px solid var(--border-subtle)',
          }}
        >
          {/* Brand */}
          <div className="px-4 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'oklch(55% 0.11 193)' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="3" fill="oklch(10% 0.01 193)" />
                  <circle cx="7" cy="7" r="6" stroke="oklch(10% 0.01 193)" strokeOpacity="0.4" strokeWidth="1.5" />
                </svg>
              </div>
              <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                MyOrbisVoice
              </span>
            </div>
            <ThemeToggle />
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            <SidebarNav />
          </nav>

          {/* Footer */}
          <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <SidebarUserBadge profileHref="/profile" />
            <SignOutButton />
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-3xl mx-auto px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
