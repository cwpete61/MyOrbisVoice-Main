const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'

interface ApiCallOptions {
  method?: string
  body?: unknown
  token?: string
}

async function apiCall<T>(path: string, options: ApiCallOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  const json = (await res.json()) as { data?: T; errors?: { code: string; message: string }[] }

  if (!res.ok) {
    const msg = json.errors?.[0]?.message ?? 'Request failed'
    throw new Error(msg)
  }

  return json.data as T
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export async function apiLogin(login: string, password: string) {
  return apiCall<{ user: unknown; tenantId: string | null } & AuthTokens>('/api/auth/login', {
    method: 'POST',
    body: { login, password },
  })
}

export async function apiSignup(username: string, email: string, password: string, businessName: string, affiliateCode?: string) {
  return apiCall<{ user: unknown; tenant: unknown } & AuthTokens>('/api/auth/signup', {
    method: 'POST',
    body: { username, email, password, businessName, ...(affiliateCode ? { affiliateCode } : {}) },
  })
}

export async function apiAffiliateSignup(username: string, email: string, password: string, firstName?: string, lastName?: string) {
  return apiCall<{ user: unknown } & AuthTokens>('/api/auth/affiliate-signup', {
    method: 'POST',
    body: { username, email, password, ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}) },
  })
}

export async function apiRefresh(refreshToken: string) {
  return apiCall<AuthTokens>('/api/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  })
}

export async function apiLogout(refreshToken: string) {
  return apiCall<{ success: boolean }>('/api/auth/logout', {
    method: 'POST',
    body: { refreshToken },
  })
}

export async function apiMe(token: string) {
  return apiCall<{ user: unknown; memberships: unknown[] }>('/api/auth/me', { token })
}
