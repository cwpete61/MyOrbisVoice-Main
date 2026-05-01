'use client'

import { useState } from 'react'
import { AuthGuard } from '@/components/AuthGuard'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SidebarNav } from '@/components/SidebarNav'
import { SignOutButton } from '@/components/SignOutButton'
import { SidebarUserBadge } from '@/components/SidebarUserBadge'
import { NotificationBell } from '@/components/NotificationBell'

function SidebarContents({ onNav }: { onNav?: () => void }) {
  return (
    <>
      {/* Brand */}
      <div className="px-4 py-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
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
      <nav className="flex-1 px-3 py-4 overflow-y-auto" onClick={onNav}>
        <SidebarNav />
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <SidebarUserBadge profileHref="/profile" />
        <SignOutButton />
      </div>
    </>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <AuthGuard>
      <div className="h-screen flex overflow-hidden" style={{ background: 'var(--surface-app)' }}>

        {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
        <aside
          className="hidden md:flex w-52 flex-shrink-0 flex-col"
          style={{ background: 'var(--surface-sidebar)', borderRight: '1px solid var(--border-subtle)' }}
        >
          <SidebarContents />
        </aside>

        {/* ── Mobile sidebar overlay ──────────────────────────────────────── */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.5)' }}
              onClick={() => setSidebarOpen(false)}
            />
            {/* Drawer */}
            <aside
              className="relative flex flex-col w-64 h-full z-50"
              style={{ background: 'var(--surface-sidebar)', borderRight: '1px solid var(--border-subtle)' }}
            >
              <SidebarContents onNav={() => setSidebarOpen(false)} />
            </aside>
          </div>
        )}

        {/* ── Main area ───────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Mobile top bar */}
          <header
            className="flex md:hidden items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ background: 'var(--surface-sidebar)', borderBottom: '1px solid var(--border-subtle)' }}
          >
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <div className="flex items-center gap-1.5">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: 'oklch(55% 0.11 193)' }}
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="3" fill="oklch(10% 0.01 193)" />
                  <circle cx="7" cy="7" r="6" stroke="oklch(10% 0.01 193)" strokeOpacity="0.4" strokeWidth="1.5" />
                </svg>
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>MyOrbisVoice</span>
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>

          {/* Desktop top bar — bell always visible top-right */}
          <div
            className="hidden md:flex items-center justify-end px-8 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-sidebar)' }}
          >
            <div className="flex items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-auto">
            <div className="w-full px-4 py-6 md:px-8 md:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
