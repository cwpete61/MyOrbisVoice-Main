'use client'

import { useApi } from '@/hooks/useApi'

interface LogoData { logoUrl: string | null }

export function TenantLogo() {
  const { data } = useApi<LogoData>('/api/business-profile/logo')
  const url = data?.logoUrl

  if (!url) {
    return (
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'oklch(55% 0.11 193)' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="3" fill="oklch(10% 0.01 193)" />
          <circle cx="7" cy="7" r="6" stroke="oklch(10% 0.01 193)" strokeOpacity="0.4" strokeWidth="1.5" />
        </svg>
      </div>
    )
  }

  return (
    <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--border-subtle)' }}>
      <img src={url} alt="Logo" className="w-full h-full object-contain" />
    </div>
  )
}
