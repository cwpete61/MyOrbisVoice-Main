'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getPlatformRoleTier, type PlatformRoleTier } from '@/lib/auth'

/** Minimum role required to see a nav item. Items without this default
 *  to 'support' (anyone with platform access). */
type RoleTier = Exclude<PlatformRoleTier, null>

interface NavItem {
  href:    string
  label:   string
  icon:    React.JSX.Element
  /** If set, hide the item unless the user's role is at least this tier. */
  minTier?: RoleTier
}

const TIER_RANK: Record<RoleTier, number> = {
  support:     1,
  admin:       2,
  super_admin: 3,
}

function userMeetsTier(userTier: RoleTier | null, requiredTier: RoleTier | undefined): boolean {
  if (!requiredTier) return true              // no requirement = visible to everyone
  if (!userTier) return false                 // no role at all
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier]
}

export function AdminNav() {
  const pathname = usePathname()
  const tier = getPlatformRoleTier()

  const NAV: { section: string; items: NavItem[] }[] = [
    {
      section: 'Platform',
      items: [
        { href: '/admin', label: 'Overview', icon: <GridIcon /> },
        // System Settings includes credential editing (Super only) — Support
        // shouldn't see this in nav at all (the page itself 403s anyway).
        { href: '/admin/system-settings', label: 'System Settings', icon: <SettingsIcon />, minTier: 'super_admin' },
        { href: '/admin/team',            label: 'Users',           icon: <TeamIcon />,     minTier: 'super_admin' },
        { href: '/admin/settings',        label: 'Platform Status', icon: <StatusIcon />,   minTier: 'admin' },
      ],
    },
    {
      section: 'Management',
      items: [
        // Tenants list/detail are readable by Support — they need to do real work
        { href: '/admin/tenants',     label: 'Tenants',          icon: <TenantsIcon /> },
        // Plans / Pricing / Comp Codes / Partners are write-heavy — Admin or above
        { href: '/admin/plans',       label: 'Plans',            icon: <PlansIcon />,       minTier: 'admin' },
        { href: '/admin/pricing',     label: 'Pricing',          icon: <PricingIcon />,     minTier: 'admin' },
        { href: '/admin/comp-codes',  label: 'Comp Codes',       icon: <CompCodesIcon />,   minTier: 'admin' },
        { href: '/admin/partners',    label: 'Partners',         icon: <AffiliatesIcon />,  minTier: 'admin' },
        { href: '/admin/email-policy', label: 'Email Policy',     icon: <SettingsIcon />,    minTier: 'admin' },
        // Phone Numbers / A2P have read paths Support uses; the write actions
        // inside those pages are individually role-gated
        { href: '/admin/phone-numbers', label: 'Phone Numbers',  icon: <PhoneIcon /> },
        { href: '/admin/twilio-logs', label: 'Twilio Call Logs', icon: <CallLogsIcon /> },
        { href: '/admin/a2p',         label: 'A2P 10DLC',        icon: <A2PIcon /> },
        { href: '/admin/errors',      label: 'Errors',           icon: <ErrorsIcon /> },
      ],
    },
    {
      section: 'Account',
      items: [
        { href: '/admin/profile', label: 'Profile', icon: <UserIcon /> },
        { href: '/admin/help',    label: 'Help',    icon: <HelpIcon /> },
      ],
    },
  ]

  return (
    <div className="space-y-5">
      {NAV.map((group) => {
        const visibleItems = group.items.filter(item => userMeetsTier(tier, item.minTier))
        if (visibleItems.length === 0) return null
        return (
        <div key={group.section}>
          <p className="px-3 mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
            {group.section}
          </p>
          <div className="space-y-0.5">
            {visibleItems.map((item) => {
              const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors"
                  style={{
                    color: active ? 'oklch(72% 0.12 193)' : 'var(--text-secondary)',
                    background: active ? 'oklch(55% 0.11 193 / 0.12)' : 'transparent',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
        )
      })}
    </div>
  )
}

function TeamIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="6" r="2.2" />
      <circle cx="11" cy="6" r="2.2" />
      <path d="M1.5 13c0-2 1.6-3.5 3.5-3.5S8.5 11 8.5 13" />
      <path d="M7.5 13c0-2 1.6-3.5 3.5-3.5S14.5 11 14.5 13" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.2 3.2l1.06 1.06M11.74 11.74l1.06 1.06M3.2 12.8l1.06-1.06M11.74 4.26l1.06-1.06" />
    </svg>
  )
}

function StatusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" /><path d="M8 5v3l2 2" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="5" r="3" /><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" />
    </svg>
  )
}

function TenantsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 14V6l6-4 6 4v8" /><path d="M6 14v-4h4v4" />
    </svg>
  )
}

function CallLogsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path d="M5 6h6M5 8.5h4M5 11h3" />
    </svg>
  )
}

function A2PIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h10v6a1 1 0 0 1-1 1H7l-3 2V5a1 1 0 0 1 1-1z" />
      <path d="M6 7h4" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 2.5h2l1 3-1.5 1a8 8 0 0 0 3.5 3.5l1-1.5 3 1v2a1 1 0 0 1-1 1A11 11 0 0 1 3.5 3.5a1 1 0 0 1 1-1z" />
    </svg>
  )
}

function PlansIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="14" height="10" rx="1.5" />
      <path d="M5 8h6M5 10.5h3" />
    </svg>
  )
}

function AffiliatesIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4" cy="8" r="2" /><circle cx="12" cy="4" r="2" /><circle cx="12" cy="12" r="2" />
      <path d="M6 7.5l4-2M6 8.5l4 2" />
    </svg>
  )
}

function PricingIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 1.5h-5L1.5 4.5l6.5 9 6.5-9z" />
      <path d="M1.5 4.5h13" />
      <path d="M5.5 4.5l2.5 9 2.5-9" />
    </svg>
  )
}

function CompCodesIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1" />
      <path d="M1.5 8h13" />
      <path d="M5 5.5l1 1m0-1l-1 1" />
      <path d="M5 10.5l1 1m0-1l-1 1" />
    </svg>
  )
}

function ErrorsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L1.5 13h13L8 1.5z" />
      <line x1="8" y1="6" x2="8" y2="9.5" />
      <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M6 6a2 2 0 1 1 3 1.5c-.5.4-1 .7-1 1.5" />
      <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
    </svg>
  )
}
