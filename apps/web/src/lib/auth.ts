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

export function getTokenPayload(): { roleKey?: string; isPlatformRole?: boolean } | null {
  const token = getAccessToken()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!))
    return payload as { roleKey?: string; isPlatformRole?: boolean }
  } catch {
    return null
  }
}

export function isPlatformAdmin(): boolean {
  return getTokenPayload()?.isPlatformRole === true
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
