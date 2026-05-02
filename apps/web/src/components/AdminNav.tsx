'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AdminNav() {
  const pathname = usePathname()

  const NAV = [
    {
      section: 'Platform',
      items: [
        { href: '/admin', label: 'Overview', icon: <GridIcon /> },
        { href: '/admin/system-settings', label: 'System Settings', icon: <SettingsIcon /> },
        { href: '/admin/settings', label: 'Platform Status', icon: <StatusIcon /> },
      ],
    },
    {
      section: 'Management',
      items: [
        { href: '/admin/tenants',     label: 'Tenants',     icon: <TenantsIcon /> },
        { href: '/admin/plans',       label: 'Plans',       icon: <PlansIcon /> },
        { href: '/admin/affiliates',  label: 'Affiliates',  icon: <AffiliatesIcon /> },
        { href: '/admin/twilio-logs', label: 'Twilio Call Logs', icon: <CallLogsIcon /> },
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
      {NAV.map((group) => (
        <div key={group.section}>
          <p className="px-3 mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
            {group.section}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
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
      ))}
    </div>
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

function HelpIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M6 6a2 2 0 1 1 3 1.5c-.5.4-1 .7-1 1.5" />
      <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
    </svg>
  )
}
