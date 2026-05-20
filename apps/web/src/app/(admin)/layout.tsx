'use client'

import { useState } from 'react'
import { AuthGuard } from '@/components/AuthGuard'
import { LanguageToggle } from '@/components/LanguageToggle'
import { AdminNav } from '@/components/AdminNav'
import { SignOutButton } from '@/components/SignOutButton'
import { SidebarUserBadge } from '@/components/SidebarUserBadge'
import { IdleTimeout } from '@/components/IdleTimeout'
import { RoleBadge } from '@/components/RoleBadge'

function BrandMark() {
  return (
    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'oklch(55% 0.11 193)' }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="3" fill="oklch(10% 0.01 193)" />
        <circle cx="7" cy="7" r="6" stroke="oklch(10% 0.01 193)" strokeOpacity="0.4" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

// Sidebar inner content — shared by the desktop rail + the mobile drawer.
function SidebarContents({ onNav }: { onNav?: () => void }) {
  return (
    <>
      {/* Brand — pinned */}
      <div className="px-4 py-5 flex items-center gap-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <BrandMark />
        <div>
          <span className="text-xs font-semibold tracking-tight block" style={{ color: 'var(--text-primary)' }}>MyOrbisVoice</span>
          <span className="text-xs" style={{ color: 'oklch(45% 0.11 193)' }}>Admin</span>
        </div>
      </div>

      {/* Nav — flex-1 + min-h-0 so it scrolls internally on short viewports.
         nav-scroll keeps a faint thin scrollbar visible so users see there's
         more below the fold (iOS hides scrollbars by default). */}
      <nav className="flex-1 min-h-0 px-3 py-4 overflow-y-auto nav-scroll" onClick={onNav}>
        <AdminNav />
      </nav>

      {/* Footer — pinned. Sign out always visible. */}
      <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <SidebarUserBadge profileHref="/admin/profile" />
        <SignOutButton />
      </div>
    </>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <AuthGuard>
      <IdleTimeout redirectTo="/login" />
      {/* h-[100dvh] (dynamic viewport height) instead of h-screen / 100vh so
         iOS Safari's collapsing chrome doesn't eat layout space. Desktop rail
         at lg: (≥1024px) — iPad portrait gets the full-height drawer. */}
      <div className="h-[100dvh] flex overflow-hidden" style={{ background: 'var(--surface-app)' }}>

        {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
        <aside
          className="hidden lg:flex w-52 flex-shrink-0 flex-col"
          style={{ background: 'var(--surface-sidebar)', borderRight: '1px solid var(--border-subtle)' }}
        >
          <SidebarContents />
        </aside>

        {/* ── Mobile drawer ────────────────────────────────────────────────── */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setSidebarOpen(false)} />
            <aside
              className="relative flex flex-col w-72 max-w-[85vw] h-full z-50"
              style={{ background: 'var(--surface-sidebar)', borderRight: '1px solid var(--border-subtle)' }}
            >
              <SidebarContents onNav={() => setSidebarOpen(false)} />
            </aside>
          </div>
        )}

        {/* ── Main ─────────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto flex flex-col">
          {/* Mobile top bar — hamburger + brand. Up to lg so iPad portrait sees it. */}
          <header
            className="flex lg:hidden items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-sidebar)' }}
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
            <div className="flex items-center gap-1.5">
              <BrandMark />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Admin</span>
            </div>
            <RoleBadge />
          </header>

          {/* Desktop top bar — lg+ (matches sidebar). */}
          <div
            className="hidden lg:flex items-center justify-end gap-3 px-8 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-sidebar)' }}
          >
            <RoleBadge />
            <LanguageToggle />
          </div>

          {/* Page content — mobile padding up to lg (iPad portrait uses drawer). */}
          <div className="w-full px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
