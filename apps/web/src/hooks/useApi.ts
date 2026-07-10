'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/lib/auth'

// Exported so callers that build their own fetch (multipart uploads, EventSource,
// websockets) can prefix the same base URL apiFetch uses — keeps prod / local
// switching consistent across every call site.
//
// Host-aware: the SAME build serves both app.myorbisvoice.com and the isolated
// app.myorbisagents.com. Agents must call their OWN API host so auth (OIDC
// login/callback, logout) stays scoped to myorbisagents.com and never touches
// the Voice/Hub session. Runtime check — the client knows its own host.
export const API_BASE =
  (typeof window !== 'undefined' && window.location.host === 'app.myorbisagents.com')
    ? 'https://api.myorbisagents.com'
    : (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000')

// Silent-SSO login: send the browser to the server OIDC login endpoint, which
// rides the shared Keycloak session (no second sign-in when a Hub session
// exists) and returns to `next`. Host-aware via API_BASE. Feature-flagged so
// local dev / OIDC-off environments keep the classic login flow.
export const OIDC_ENABLED = (process.env['NEXT_PUBLIC_OIDC_ENABLED'] ?? '') === 'true'
export function oidcLoginHref(next?: string): string {
  const n = next ? `?next=${encodeURIComponent(next)}` : ''
  return `${API_BASE}/api/auth/oidc/login${n}`
}

function buildHeaders(token: string | null, extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

async function tryRefresh(): Promise<string | null> {
  const rt = getRefreshToken()
  if (!rt) return null
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: { accessToken: string; refreshToken: string } }
    if (!json.data?.accessToken) return null
    setTokens(json.data.accessToken, json.data.refreshToken)
    return json.data.accessToken
  } catch {
    return null
  }
}

function redirectToLogin() {
  clearTokens()
  if (typeof window === 'undefined') return
  // Stay within the surface the user is on. A partner whose token expires
  // while inside /partner-portal/* should go back to /partner-portal/login,
  // not the tenant login screen. Same logic for any future portal routes.
  const path = window.location.pathname
  if (path.startsWith('/partner-portal')) {
    window.location.href = '/partner-portal/login'
  } else if (OIDC_ENABLED) {
    // Silently re-auth from the shared KC session instead of bouncing to the hub.
    window.location.href = oidcLoginHref(path + window.location.search)
  } else {
    window.location.href = '/login'
  }
}

/** Wraps fetch() with one silent retry on transient network failures (e.g.
 *  Chromium's ERR_NETWORK_CHANGED when WiFi/VPN flips mid-request, or a
 *  ECONNRESET on a flaky connection). These surface as a thrown TypeError
 *  with no Response object, distinguished from HTTP errors which return a
 *  Response with res.ok === false. We only retry the throw case — HTTP
 *  errors are the server's answer, not a network blip.
 *
 *  Single retry after 500ms. Doesn't add latency on the happy path.
 *  Eliminates the "click again, it works" UX reported during feature-test
 *  sprint. */
async function fetchWithNetworkRetry(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (err) {
    // Only retry on TypeError (= network failure / DNS / connection drop).
    // AbortError, RangeError, etc. are not transient network issues.
    if (!(err instanceof TypeError)) throw err
    await new Promise(r => setTimeout(r, 500))
    return fetch(input, init)
  }
}

export async function apiFetchRaw(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  const extraHeaders = options.headers as Record<string, string> | undefined
  const res = await fetchWithNetworkRetry(`${API_BASE}${path}`, {
    ...options,
    headers: buildHeaders(token, extraHeaders),
  })
  if (res.status === 401) {
    const newToken = await tryRefresh()
    if (!newToken) { redirectToLogin(); throw new Error('Session expired') }
    return fetchWithNetworkRetry(`${API_BASE}${path}`, { ...options, headers: buildHeaders(newToken, extraHeaders) })
  }
  return res
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken()
  const extraHeaders = options.headers as Record<string, string> | undefined

  const res = await fetchWithNetworkRetry(`${API_BASE}${path}`, {
    ...options,
    headers: buildHeaders(token, extraHeaders),
  })

  // Auto-refresh on 401 (expired token) then retry once. 403 is a permission error, not a session error.
  if (res.status === 401) {
    const newToken = await tryRefresh()
    if (!newToken) {
      redirectToLogin()
      throw new Error('Session expired. Please sign in again.')
    }
    const retry = await fetchWithNetworkRetry(`${API_BASE}${path}`, {
      ...options,
      headers: buildHeaders(newToken, extraHeaders),
    })
    const retryJson = (await retry.json()) as { data?: T; errors?: { code: string; message: string }[] }
    if (!retry.ok) throw new Error(retryJson.errors?.[0]?.message ?? 'Request failed')
    return retryJson.data as T
  }

  const json = (await res.json()) as { data?: T; errors?: { code: string; message: string }[] }
  if (!res.ok) throw new Error(json.errors?.[0]?.message ?? 'Request failed')
  return json.data as T
}

// Upload a native file as raw binary — no base64, Content-Type set to the file's mime type
export async function apiUploadFile<T>(path: string, _fieldName: string, file: File): Promise<T> {
  const token = getAccessToken()
  const headers: Record<string, string> = { 'Content-Type': file.type }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: file })

  if (res.status === 401) {
    const newToken = await tryRefresh()
    if (!newToken) { redirectToLogin(); throw new Error('Session expired') }
    const retry = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type, Authorization: `Bearer ${newToken}` },
      body: file,
    })
    const retryJson = (await retry.json()) as { data?: T; errors?: { code: string; message: string }[] }
    if (!retry.ok) throw new Error(retryJson.errors?.[0]?.message ?? 'Upload failed')
    return retryJson.data as T
  }

  const json = (await res.json()) as { data?: T; errors?: { code: string; message: string }[] }
  if (!res.ok) throw new Error(json.errors?.[0]?.message ?? 'Upload failed')
  return json.data as T
}

export function useApi<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!path) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const result = await apiFetch<T>(path)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps])

  useEffect(() => { void load() }, [load])

  return { data, loading, error, reload: load }
}
