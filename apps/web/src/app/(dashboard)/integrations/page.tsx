'use client'

import { useEffect, useState } from 'react'
import { apiFetchRaw, useApi } from '@/hooks/useApi'

interface GoogleStatus {
  status: 'NOT_CONNECTED' | 'CONNECTED' | 'ERROR' | 'RECONNECT_REQUIRED' | 'DISABLED'
  email: string | null
  lastVerifiedAt: string | null
  calendarCount: number
}

interface IntegrationsData {
  google: GoogleStatus
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  CONNECTED:          { bg: 'oklch(19% 0.04 193)', text: 'oklch(72% 0.12 193)', label: 'Connected' },
  NOT_CONNECTED:      { bg: 'var(--surface-overlay)', text: 'var(--text-secondary)', label: 'Not connected' },
  ERROR:              { bg: 'oklch(13% 0.04 25)', text: 'oklch(68% 0.20 25)', label: 'Error' },
  RECONNECT_REQUIRED: { bg: 'oklch(14% 0.04 75)', text: 'oklch(70% 0.16 75)', label: 'Reconnect required' },
  DISABLED:           { bg: 'var(--surface-overlay)', text: 'var(--text-tertiary)', label: 'Disabled' },
}

export default function IntegrationsPage() {
  const { data, loading, error, reload } = useApi<IntegrationsData>('/api/integrations')
  const [connecting, setConnecting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 5000)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('google')
    const email = params.get('email')
    const reason = params.get('reason')
    if (result === 'success' && email) {
      showToast('success', `Google account connected: ${email}`)
      reload()
      window.history.replaceState({}, '', '/integrations')
    } else if (result === 'error') {
      showToast('error', `Google connection failed: ${reason ?? 'unknown error'}`)
      window.history.replaceState({}, '', '/integrations')
    }
  }, [reload])

  async function startOAuth(endpoint: string) {
    setConnecting(true)
    try {
      const res = await apiFetchRaw(endpoint, { method: 'POST' })
      const json = (await res.json()) as { data?: { url: string }; errors?: { message: string }[] }
      if (!res.ok) { showToast('error', json.errors?.[0]?.message ?? 'Failed'); return }
      window.location.href = json.data!.url
    } catch {
      showToast('error', 'Failed to start Google connection')
    } finally {
      setConnecting(false)
    }
  }

  async function disconnectGoogle() {
    if (!confirm('Disconnect your Google account? This will disable Gmail and Calendar integrations.')) return
    setConnecting(true)
    try {
      const res = await apiFetchRaw('/api/integrations/google', { method: 'DELETE' })
      if (!res.ok) {
        const json = (await res.json()) as { errors?: { message: string }[] }
        showToast('error', json.errors?.[0]?.message ?? 'Failed to disconnect')
        return
      }
      showToast('success', 'Google account disconnected.')
      reload()
    } catch {
      showToast('error', 'Failed to disconnect Google account')
    } finally {
      setConnecting(false)
    }
  }

  const google = data?.google
  const statusStyle = STATUS_STYLES[google?.status ?? 'NOT_CONNECTED'] ?? STATUS_STYLES['NOT_CONNECTED']!

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Integrations</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Connect third-party services your agents use to book, email, and communicate.
        </p>
      </div>

      {toast && (
        <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>
      )}

      {loading && (
        <div className="h-4 rounded animate-pulse w-48" style={{ background: 'var(--border-subtle)' }} />
      )}
      {error && (
        <div className="alert-error">Failed to load integration status.</div>
      )}

      {!loading && google && (
        <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              {/* Google G */}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'oklch(19% 0.04 193)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Google Workspace</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Gmail · Google Calendar</p>
              </div>
            </div>
            <span
              className="badge"
              style={{ background: statusStyle.bg, color: statusStyle.text }}
            >
              {statusStyle.label}
            </span>
          </div>

          {/* Details */}
          <div className="px-6 py-5">
            {google.status === 'CONNECTED' && (
              <dl className="space-y-2 mb-5">
                <div className="flex items-center gap-6">
                  <dt className="text-xs w-28 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>Account</dt>
                  <dd className="text-sm" style={{ color: 'var(--text-primary)' }}>{google.email}</dd>
                </div>
                <div className="flex items-center gap-6">
                  <dt className="text-xs w-28 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>Calendars</dt>
                  <dd className="text-sm" style={{ color: 'var(--text-primary)' }}>{google.calendarCount} found</dd>
                </div>
                {google.lastVerifiedAt && (
                  <div className="flex items-center gap-6">
                    <dt className="text-xs w-28 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>Last verified</dt>
                    <dd className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(google.lastVerifiedAt).toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {google.status === 'NOT_CONNECTED' && (
              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
                Connect your Google account to enable appointment booking and email confirmations.
              </p>
            )}

            {(google.status === 'ERROR' || google.status === 'RECONNECT_REQUIRED') && (
              <p className="text-sm mb-5" style={{ color: 'var(--error-600)' }}>
                Your Google connection needs to be reauthorized. Click Reconnect to fix it.
              </p>
            )}

            <div className="flex flex-wrap gap-2.5">
              {google.status === 'NOT_CONNECTED' && (
                <button onClick={() => startOAuth('/api/integrations/google/start')} disabled={connecting} className="btn-primary">
                  {connecting ? 'Redirecting…' : 'Connect Google'}
                </button>
              )}
              {(google.status === 'CONNECTED' || google.status === 'ERROR' || google.status === 'RECONNECT_REQUIRED') && (
                <>
                  <button onClick={() => startOAuth('/api/integrations/google/reconnect')} disabled={connecting} className="btn-ghost">
                    {connecting ? 'Redirecting…' : 'Reconnect'}
                  </button>
                  <button onClick={disconnectGoogle} disabled={connecting} className="btn-danger">
                    Disconnect
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Required scopes: Gmail Send, Gmail Read, Google Calendar. Tokens are encrypted at rest and never displayed.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
