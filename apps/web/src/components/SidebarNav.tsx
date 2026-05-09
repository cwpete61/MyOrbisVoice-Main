'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useT } from '@/lib/i18n/I18nProvider'

interface NavItem {
  href: string
  labelKey: string
  icon: React.ReactNode
}

interface NavGroup {
  labelKey: string
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
    labelKey: 'nav.groups.getStarted',
    items: [
      { href: '/dashboard',  labelKey: 'nav.items.dashboard',  icon: <Icon d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z" /> },
      { href: '/onboarding', labelKey: 'nav.items.getStarted', icon: <Icon d="M8 1.5l1.8 4 4.4.4-3.3 3 1 4.3L8 11l-3.9 2.2 1-4.3-3.3-3 4.4-.4z" /> },
    ],
  },
  {
    labelKey: 'nav.groups.build',
    items: [
      { href: '/business-dna', labelKey: 'nav.items.businessDna', icon: <Icon d="M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2zm0 0v2m0 8v2M2 8h2m8 0h2" /> },
      { href: '/prompts',      labelKey: 'nav.items.prompts',      icon: <Icon d="M4 6h8M4 10h5M2 3h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /> },
      { href: '/agents',       labelKey: 'nav.items.agents',       icon: <Icon d="M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 6a5 5 0 0 1 10 0" /> },
      { href: '/agent-studio', labelKey: 'nav.items.agentStudio',  icon: <Icon d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm4.5-7.5l1.5 1.5M3.5 11.5l1.5 1.5M12 8h2M2 8H0M8 2V0M8 14v2" /> },
      { href: '/channels',     labelKey: 'nav.items.channels',     icon: <Icon d="M2 8a6 6 0 1 0 12 0A6 6 0 0 0 2 8zm6-2v4m-2-2h4" /> },
    ],
  },
  {
    labelKey: 'nav.groups.connect',
    items: [
      { href: '/integrations',   labelKey: 'nav.items.integrations',   icon: <Icon d="M13 8a5 5 0 0 1-10 0M8 3v5m0 0-2-2m2 2 2-2" /> },
      { href: '/phone-numbers',  labelKey: 'nav.items.phoneNumbers',   icon: <Icon d="M4 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm4 10h.01M6 5h4M6 7h4M6 9h2" /> },
      { href: '/a2p',            labelKey: 'nav.items.smsCompliance',  icon: <Icon d="M3 4h10v6a1 1 0 0 1-1 1H7l-3 2V5a1 1 0 0 1 1-1zm2 3h6M5 9h4" /> },
    ],
  },
  {
    labelKey: 'nav.groups.engage',
    items: [
      { href: '/contacts',      labelKey: 'nav.items.contacts',       icon: <Icon d="M10 9a3 3 0 1 0-6 0M5 15a5 5 0 0 1 6 0M13 7a2 2 0 1 0-4 0M14 13a4 4 0 0 0-3-1" /> },
      { href: '/conversations', labelKey: 'nav.items.conversations',  icon: <Icon d="M2 4h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2V5a1 1 0 0 1 1-1zm3 3h6M5 9h4" /> },
      { href: '/appointments',  labelKey: 'nav.items.appointments',   icon: <Icon d="M4 3h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm3 4h2M7 10h2M4 6h8" /> },
      { href: '/campaigns',     labelKey: 'nav.items.campaigns',      icon: <Icon d="M3 5h10M3 8h7M3 11h4m6-4v6m0 0-2-2m2 2 2-2" /> },
      { href: '/outbound',      labelKey: 'nav.items.outbound',       icon: <Icon d="M15 3l-4 4M3 13l4-4M11 7l2 2-6 6-2-2zm-3 7l-3 2 1-3" /> },
    ],
  },
  {
    labelKey: 'nav.groups.account',
    items: [
      { href: '/usage',    labelKey: 'nav.items.usage',    icon: <Icon d="M2 12h2V8H2zm3 0h2V4H5zm3 0h2V6H8zm3 0h2v-3h-2zM2 14h12" /> },
      { href: '/billing',  labelKey: 'nav.items.billing',  icon: <Icon d="M1 5h14v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5zm0-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" /> },
      { href: '/staff',    labelKey: 'nav.items.staff',    icon: <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4 4a3 3 0 0 0-3-2h-1" /> },
      { href: '/settings', labelKey: 'nav.items.settings', icon: <Icon d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4.3-1.3A4.5 4.5 0 0 0 12.5 8a4.5 4.5 0 0 0-.2-.7l1.5-1.2-1-1.7-1.8.6A4.5 4.5 0 0 0 9.7 4.2L9.5 2.5h-2l-.2 1.7A4.5 4.5 0 0 0 5.9 5 l-1.8-.6-1 1.7 1.5 1.2A4.5 4.5 0 0 0 4.5 8a4.5 4.5 0 0 0 .1.7L3.1 9.9l1 1.7 1.8-.6a4.5 4.5 0 0 0 1.4.8l.2 1.7h2l.2-1.7a4.5 4.5 0 0 0 1.4-.8l1.8.6 1-1.7z" /> },
      { href: '/help',     labelKey: 'nav.items.help',     icon: <Icon d="M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2zm0 4a1.5 1.5 0 0 0-1.5 1.5h1a.5.5 0 0 1 1 0c0 .5-.5.75-.87 1.06A1.5 1.5 0 0 0 7 9.5h1c0-.34.13-.5.63-.84C9.38 8.25 10 7.75 10 6.5A2.5 2.5 0 0 0 8 4zM7.5 11h1v1h-1z" /> },
    ],
  },
]

export function SidebarNav() {
  const pathname = usePathname()
  const t = useT()

  return (
    <div className="space-y-5 pt-1">
      {NAV_GROUPS.map((group) => (
        <div key={group.labelKey}>
          <p
            className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
          >
            {t(group.labelKey)}
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
                    {t(item.labelKey)}
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
