import { AuthGuard } from '@/components/AuthGuard'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AdminNav } from '@/components/AdminNav'
import { SignOutButton } from '@/components/SignOutButton'
import { SidebarUserBadge } from '@/components/SidebarUserBadge'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="h-screen flex overflow-hidden" style={{ background: 'var(--surface-app)' }}>
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
              <div>
                <span className="text-xs font-semibold tracking-tight block" style={{ color: 'var(--text-primary)' }}>
                  MyOrbisVoice
                </span>
                <span className="text-xs" style={{ color: 'oklch(55% 0.09 193)' }}>Admin</span>
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            <AdminNav />
          </nav>

          {/* Footer */}
          <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <SidebarUserBadge profileHref="/admin/profile" />
            <SignOutButton />
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="w-full px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
