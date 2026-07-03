'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageToggle } from '@/components/LanguageToggle'
import { SidebarNav } from '@/components/SidebarNav'
import { SignOutButton } from '@/components/SignOutButton'
import { SidebarUserBadge } from '@/components/SidebarUserBadge'
import { NotificationBell } from '@/components/NotificationBell'
import { TenantLogo } from '@/components/TenantLogo'
import { TenantIdBadge } from '@/components/TenantIdBadge'
import { TierBadge } from '@/components/TierBadge'
import { IdleTimeout } from '@/components/IdleTimeout'
import { getImpersonationInfo, endImpersonation } from '@/lib/auth'
import { apiFetch } from '@/hooks/useApi'
import { useTenantContext } from '@/hooks/useTenantContext'
import { useT } from '@/lib/i18n/I18nProvider'

// MyOrbisAgents is a branded vertical of the Voice app: real-estate tenants see
// "MyOrbisAgents" in the dashboard chrome; everyone else stays "MyOrbisVoice".
const AGENTS_VERTICALS = ['REAL_ESTATE', 'REALTOR']
const AGENTS_HOME = 'https://myorbisagents.com'
const AGENTS_PRICING = 'https://myorbisagents.com/#pricing'
// House-account booking link. Routes through the product's OWN public booking
// page (/book/<affiliate-slug>), which writes straight onto that account's
// connected Google Calendar — no external Google appointment-schedule link
// needed. crawford.peterson2 = the "My Orbis Results" house affiliate, with
// myorbisresults@gmail.com connected (GOOGLE/CONNECTED, calendarReady=true).
// Empty = bar hidden (no dead link).
const HOUSE_BOOKING_URL = 'https://app.myorbisvoice.com/book/crawford.peterson2'
function useIsAgents(): boolean {
  const ctx = useTenantContext()
  // Host-based first: anyone on the isolated app.myorbisagents.com door is an
  // agent surface regardless of tenant vertical. Falls back to vertical for the
  // reskin on the shared Voice host.
  if (typeof window !== 'undefined' && window.location.host === 'app.myorbisagents.com') return true
  return !!ctx && AGENTS_VERTICALS.includes(ctx.industryCode)
}
function useBrandName(): string {
  return useIsAgents() ? 'MyOrbisAgents' : 'MyOrbisVoice'
}

function DemoBanner() {
  const ctx = useTenantContext()
  const t = useT()
  if (!ctx?.isDemo) return null
  return (
    <div
      className="px-4 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center text-sm font-medium"
      style={{ background: 'oklch(60% 0.14 75)', color: '#fff' }}
    >
      <span>{t('demoBanner.text')}</span>
      <a
        href={AGENTS_PRICING}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center rounded-md px-3 py-1 text-xs font-semibold whitespace-nowrap"
        style={{ background: '#fff', color: 'oklch(45% 0.14 75)' }}
      >
        {t('demoBanner.payCta')}
      </a>
    </div>
  )
}

// Thin bar above the demo banner: lets an agent book a call with the MyOrbis
// team on the house account calendar. Only renders for MyOrbisAgents tenants
// and only when HOUSE_BOOKING_URL is set (no dead link otherwise).
function BookingBar() {
  const isAgents = useIsAgents()
  const t = useT()
  if (!isAgents || !HOUSE_BOOKING_URL) return null
  return (
    <div
      className="px-4 py-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs"
      style={{ background: 'var(--surface-sidebar)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
    >
      <span>{t('bookingBar.prompt')}</span>
      <a
        href={HOUSE_BOOKING_URL}
        target="_blank"
        rel="noreferrer"
        className="font-semibold whitespace-nowrap"
        style={{ color: 'oklch(55% 0.11 193)' }}
      >
        {t('bookingBar.cta')}
      </a>
    </div>
  )
}

function SidebarContents({ onNav }: { onNav?: () => void }) {
  const brandName = useBrandName()
  const isAgents = useIsAgents()
  return (
    <>
      {/* Brand */}
      <div className="px-4 py-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5">
          <TenantLogo />
          <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {brandName}
          </span>
        </div>
        <ThemeToggle />
      </div>

      {/* Nav. nav-scroll keeps a faint thin scrollbar visible so the user can
         see there's more below the fold (iOS hides scrollbars by default,
         which buried Settings / Help at the bottom of the 23-item rail on iPad). */}
      <nav className="flex-1 min-h-0 px-3 py-4 overflow-y-auto nav-scroll" onClick={onNav}>
        <SidebarNav />
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <SidebarUserBadge profileHref="/profile" />
        <SignOutButton redirectTo={isAgents ? AGENTS_HOME : undefined} />
      </div>
    </>
  )
}

function ImpersonationBanner() {
  const router = useRouter()
  const [info, setInfo] = useState<{ tenantName: string; sessionId: string } | null>(null)

  useEffect(() => { setInfo(getImpersonationInfo()) }, [])

  if (!info) return null

  async function exit() {
    try {
      await apiFetch(`/api/admin/impersonation/${info!.sessionId}/end`, { method: 'POST', body: '{}' })
    } catch { /* non-fatal */ }
    endImpersonation()
    router.push('/admin/tenants')
  }

  // Sticky-overlay banner instead of a pinned flex row — frees the ~32px it
  // used to take from the main content's pinned height. Still always visible
  // (sticky top-0, high z), but the underlying content can scroll under it
  // and the sidebar nav gets back the bottom-most items it would otherwise lose.
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between px-4 py-2 text-xs font-medium"
      style={{
        background: 'oklch(30% 0.12 45 / 0.96)',
        color: 'oklch(92% 0.06 75)',
        borderBottom: '1px solid oklch(40% 0.14 45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <span>Support mode — acting as <strong>{info.tenantName}</strong>. All actions are audit-logged.</span>
      <button onClick={exit} className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: 'oklch(45% 0.16 45)', color: 'white' }}>
        Exit support mode
      </button>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const brandName = useBrandName()
  const isAgents = useIsAgents()
  // Per-tenant tab title: the root metadata is a static "MyOrbisVoice"; override
  // it client-side so RE tenants see "MyOrbisAgents" in the browser tab.
  useEffect(() => { document.title = brandName }, [brandName])

  return (
    <AuthGuard>
      <IdleTimeout redirectTo={isAgents ? AGENTS_HOME : 'https://myorbisresults.com'} />
      {/* h-[100dvh] not h-screen — iOS Safari's 100vh includes chrome that's
         actually hiding part of the layout. Desktop sidebar at lg: (≥1024px)
         so iPad portrait (768px) gets the full-height drawer instead of a
         narrow nested-scroll rail. */}
      <div className="h-[100dvh] flex overflow-hidden" style={{ background: 'var(--surface-app)' }}>

        {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
        <aside
          className="hidden lg:flex w-52 flex-shrink-0 flex-col"
          style={{ background: 'var(--surface-sidebar)', borderRight: '1px solid var(--border-subtle)' }}
        >
          <SidebarContents />
        </aside>

        {/* ── Mobile sidebar overlay ──────────────────────────────────────── */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
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
          <ImpersonationBanner />

          {/* Mobile top bar — shown up to lg so iPad portrait sees the hamburger. */}
          <header
            className="flex lg:hidden items-center justify-between px-4 py-3 flex-shrink-0"
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
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{brandName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {!isAgents && <TierBadge />}
              <NotificationBell />
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </header>

          {/* Desktop top bar — bell always visible top-right (lg+). */}
          <div
            className="hidden lg:flex items-center justify-end px-8 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-sidebar)' }}
          >
            <div className="flex items-center gap-2">
              {!isAgents && <TierBadge />}
              <TenantIdBadge />
              <NotificationBell />
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>

          {/* Page content — mobile padding up to lg (iPad portrait uses drawer). */}
          <main className="flex-1 overflow-auto">
            <BookingBar />
            <DemoBanner />
            <div className="w-full px-4 py-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
