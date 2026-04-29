'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/lib/auth'

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'

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
  if (typeof window !== 'undefined') window.location.href = '/login'
}

export async function apiFetchRaw(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  const extraHeaders = options.headers as Record<string, string> | undefined
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: buildHeaders(token, extraHeaders),
  })
  if (res.status === 401 || res.status === 403) {
    const newToken = await tryRefresh()
    if (!newToken) { redirectToLogin(); throw new Error('Session expired') }
    return fetch(`${API_BASE}${path}`, { ...options, headers: buildHeaders(newToken, extraHeaders) })
  }
  return res
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken()
  const extraHeaders = options.headers as Record<string, string> | undefined

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: buildHeaders(token, extraHeaders),
  })

  // Auto-refresh on 401 (expired token) or 403 (stale token with missing tenantId), then retry once
  if (res.status === 401 || res.status === 403) {
    const newToken = await tryRefresh()
    if (!newToken) {
      redirectToLogin()
      throw new Error('Session expired. Please sign in again.')
    }
    const retry = await fetch(`${API_BASE}${path}`, {
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
