'use client'

/**
 * Small visual indicator in the admin top bar showing which platform
 * role the current user is operating as. Helps Support staff confirm
 * "I'm in support mode, not admin mode" at a glance.
 *
 * Renders nothing for non-platform users (regular tenants), so it's
 * safe to drop into a layout that's shared with non-admins.
 */

import { getPlatformRoleTier, type PlatformRoleTier } from '@/lib/auth'

const TIER_STYLES: Record<Exclude<PlatformRoleTier, null>, {
  label: string
  bg:    string
  fg:    string
  border: string
}> = {
  super_admin: {
    label:  'Super Admin',
    bg:     'oklch(95% 0.06 25)',     // soft red — highest privilege
    fg:     'oklch(35% 0.18 25)',
    border: 'oklch(80% 0.10 25)',
  },
  admin: {
    label:  'Admin',
    bg:     'oklch(95% 0.06 270)',    // soft purple
    fg:     'oklch(35% 0.16 270)',
    border: 'oklch(80% 0.10 270)',
  },
  support: {
    label:  'Support',
    bg:     'oklch(95% 0.06 230)',    // soft blue — read-mostly
    fg:     'oklch(35% 0.18 230)',
    border: 'oklch(80% 0.10 230)',
  },
}

export function RoleBadge() {
  const tier = getPlatformRoleTier()
  if (!tier) return null
  const style = TIER_STYLES[tier]
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide"
      style={{ background: style.bg, color: style.fg, border: `1px solid ${style.border}` }}
      aria-label={`Platform role: ${style.label}`}
      title={`You are signed in as ${style.label}`}
    >
      {style.label}
    </span>
  )
}
