'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

interface NavGroup {
  label: string
  items: NavItem[]
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <Icon d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z" /> },
    ],
  },
  {
    label: 'Configure',
    items: [
      { href: '/business-dna', label: 'Business DNA', icon: <Icon d="M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2zm0 0v2m0 8v2M2 8h2m8 0h2" /> },
      { href: '/prompts',      label: 'Prompts',      icon: <Icon d="M4 6h8M4 10h5M2 3h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /> },
      { href: '/agents',       label: 'Agents',       icon: <Icon d="M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 6a5 5 0 0 1 10 0" /> },
      { href: '/channels',     label: 'Channels',     icon: <Icon d="M2 8a6 6 0 1 0 12 0A6 6 0 0 0 2 8zm6-2v4m-2-2h4" /> },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/integrations',   label: 'Integrations',   icon: <Icon d="M13 8a5 5 0 0 1-10 0M8 3v5m0 0-2-2m2 2 2-2" /> },
      { href: '/phone-numbers',  label: 'Phone Numbers',  icon: <Icon d="M4 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm4 10h.01M6 5h4M6 7h4M6 9h2" /> },
      { href: '/appointments',  label: 'Appointments',  icon: <Icon d="M4 3h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm3 4h2M7 10h2M4 6h8" /> },
      { href: '/contacts',      label: 'Contacts',      icon: <Icon d="M10 9a3 3 0 1 0-6 0M5 15a5 5 0 0 1 6 0M13 7a2 2 0 1 0-4 0M14 13a4 4 0 0 0-3-1" /> },
      { href: '/campaigns',     label: 'Campaigns',     icon: <Icon d="M3 5h10M3 8h7M3 11h4m6-4v6m0 0-2-2m2 2 2-2" /> },
      { href: '/affiliate',     label: 'Affiliate',     icon: <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 0-2 2-2-2m2 2V9" /> },
      { href: '/conversations',  label: 'Conversations', icon: <Icon d="M2 4h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2V5a1 1 0 0 1 1-1zm3 3h6M5 9h4" /> },
      { href: '/widget-test',   label: 'Widget Test',   icon: <Icon d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-6v2m0 0v2m0-2h2m-2 0H6" /> },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/billing',  label: 'Billing',  icon: <Icon d="M1 5h14v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5zm0-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" /> },
      { href: '/settings', label: 'Settings', icon: <Icon d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4.3-1.3A4.5 4.5 0 0 0 12.5 8a4.5 4.5 0 0 0-.2-.7l1.5-1.2-1-1.7-1.8.6A4.5 4.5 0 0 0 9.7 4.2L9.5 2.5h-2l-.2 1.7A4.5 4.5 0 0 0 5.9 5 l-1.8-.6-1 1.7 1.5 1.2A4.5 4.5 0 0 0 4.5 8a4.5 4.5 0 0 0 .1.7L3.1 9.9l1 1.7 1.8-.6a4.5 4.5 0 0 0 1.4.8l.2 1.7h2l.2-1.7a4.5 4.5 0 0 0 1.4-.8l1.8.6 1-1.7z" /> },
    ],
  },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <div className="space-y-5 pt-1">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p
            className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
          >
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={
                      active
                        ? { background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)', fontWeight: 600 }
                        : { color: 'var(--text-secondary)' }
                    }
                  >
                    <span style={{ opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
