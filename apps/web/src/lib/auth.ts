'use client'

const ACCESS_TOKEN_KEY = 'va_access_token'
const REFRESH_TOKEN_KEY = 'va_refresh_token'

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens(accessToken: string, refreshToken: string | null): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return !!getAccessToken()
}

export function getTokenPayload(): { roleKey?: string; isPlatformRole?: boolean; tenantId?: string; sub?: string } | null {
  const token = getAccessToken()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!))
    return payload as { roleKey?: string; isPlatformRole?: boolean; tenantId?: string; sub?: string }
  } catch {
    return null
  }
}

export function isPlatformAdmin(): boolean {
  return getTokenPayload()?.isPlatformRole === true
}

/** Role-tier helpers for conditional rendering. Each helper admits the
 *  named role AND every role above it — same hierarchy enforced
 *  server-side in apps/api/src/middleware/rbac.ts. UI uses these to
 *  hide/show buttons; the API still independently enforces every guard,
 *  so a malicious user editing the JWT or DOM can't bypass anything. */
export type PlatformRoleTier = 'super_admin' | 'admin' | 'support' | null

export function getPlatformRoleTier(): PlatformRoleTier {
  const role = getTokenPayload()?.roleKey
  if (role === 'platform_super_admin') return 'super_admin'
  if (role === 'platform_admin')       return 'admin'
  if (role === 'platform_support')     return 'support'
  return null
}

export function isPlatformSuperAdmin(): boolean {
  return getPlatformRoleTier() === 'super_admin'
}

/** True for Super Admin OR Platform Admin (matches requirePlatformAdmin
 *  on the server — Support gets false). */
export function canPerformAdminWrites(): boolean {
  const tier = getPlatformRoleTier()
  return tier === 'super_admin' || tier === 'admin'
}

export function getImpersonationInfo(): { tenantName: string; sessionId: string } | null {
  if (typeof window === 'undefined') return null
  const sessionId  = sessionStorage.getItem('impersonation_session_id')
  const tenantName = sessionStorage.getItem('impersonation_tenant_name')
  if (!sessionId || !tenantName) return null
  return { sessionId, tenantName }
}

export function endImpersonation(): void {
  const adminToken = sessionStorage.getItem('impersonation_admin_token')
  sessionStorage.removeItem('impersonation_session_id')
  sessionStorage.removeItem('impersonation_tenant_name')
  sessionStorage.removeItem('impersonation_admin_token')
  if (adminToken) {
    localStorage.setItem('va_access_token', adminToken)
  } else {
    localStorage.removeItem('va_access_token')
  }
}
