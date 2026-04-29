'use client'

import { useEffect, useState } from 'react'
import { apiFetch, apiFetchRaw, useApi } from '@/hooks/useApi'

interface GoogleStatus {
  status: 'NOT_CONNECTED' | 'CONNECTED' | 'ERROR' | 'RECONNECT_REQUIRED' | 'DISABLED'
  email: string | null; lastVerifiedAt: string | null; calendarCount: number
}
interface TwilioStatus {
  status: 'NOT_CONNECTED' | 'CONNECTED'
  accountSid: string | null; lastVerifiedAt: string | null
}
interface IntegrationsData {
  google: GoogleStatus
  twilio: TwilioStatus
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  CONNECTED:          { bg: 'oklch(19% 0.04 193)', text: 'oklch(72% 0.12 193)', label: 'Connected' },
  NOT_CONNECTED:      { bg: 'var(--surface-overlay)', text: 'var(--text-secondary)', label: 'Not connected' },
  ERROR:              { bg: 'oklch(13% 0.04 25)', text: 'oklch(68% 0.20 25)', label: 'Error' },
  RECONNECT_REQUIRED: { bg: 'oklch(14% 0.04 75)', text: 'oklch(70% 0.16 75)', label: 'Reconnect required' },
  DISABLED:           { bg: 'var(--surface-overlay)', text: 'var(--text-tertiary)', label: 'Disabled' },
}

const inp = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function IntegrationsPage() {
  const { data, loading, error, reload } = useApi<IntegrationsData>('/api/integrations')
  const [connecting, setConnecting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Twilio form state
  const [twilioForm, setTwilioForm] = useState({ accountSid: '', authToken: '' })
  const [twilioSaving, setTwilioSaving] = useState(false)

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 5000)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('google')
    const email  = params.get('email')
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
      const res  = await apiFetchRaw(endpoint, { method: 'POST' })
      const json = (await res.json()) as { data?: { url: string }; errors?: { message: string }[] }
      if (!res.ok) { showToast('error', json.errors?.[0]?.message ?? 'Failed'); return }
      window.location.href = json.data!.url
    } catch { showToast('error', 'Failed to start Google connection') }
    finally { setConnecting(false) }
  }

  async function disconnectGoogle() {
    if (!confirm('Disconnect your Google account? This will disable Gmail and Calendar integrations.')) return
    setConnecting(true)
    try {
      const res  = await apiFetchRaw('/api/integrations/google', { method: 'DELETE' })
      if (!res.ok) {
        const json = (await res.json()) as { errors?: { message: string }[] }
        showToast('error', json.errors?.[0]?.message ?? 'Failed to disconnect')
        return
      }
      showToast('success', 'Google account disconnected.')
      reload()
    } catch { showToast('error', 'Failed to disconnect Google account') }
    finally { setConnecting(false) }
  }

  async function saveTwilio() {
    if (!twilioForm.accountSid || !twilioForm.authToken) return
    setTwilioSaving(true)
    try {
      await apiFetch('/api/integrations/twilio', {
        method: 'POST',
        body: JSON.stringify({ accountSid: twilioForm.accountSid, authToken: twilioForm.authToken }),
      })
      setTwilioForm({ accountSid: '', authToken: '' })
      showToast('success', 'Twilio credentials saved.')
      reload()
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed') }
    finally { setTwilioSaving(false) }
  }

  async function disconnectTwilio() {
    if (!confirm('Disconnect Twilio? Inbound calls will stop routing to the AI agent.')) return
    try {
      await apiFetch('/api/integrations/twilio', { method: 'DELETE' })
      showToast('success', 'Twilio disconnected.')
      reload()
    } catch { showToast('error', 'Failed to disconnect Twilio') }
  }

  const google      = data?.google
  const twilio      = data?.twilio
  const googleStyle = STATUS_STYLES[google?.status ?? 'NOT_CONNECTED']!
  const twilioStyle = STATUS_STYLES[twilio?.status ?? 'NOT_CONNECTED']!

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Integrations</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Connect third-party services your agents use to book, call, and communicate.
        </p>
      </div>

      {toast && <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>}
      {loading && <div className="h-4 rounded animate-pulse w-48" style={{ background: 'var(--border-subtle)' }} />}
      {error   && <div className="alert-error">Failed to load integration status.</div>}

      {/* ── Google ─────────────────────────────────────────────────────── */}
      {!loading && google && (
        <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'oklch(19% 0.04 193)' }}>
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
            <span className="badge" style={{ background: googleStyle.bg, color: googleStyle.text }}>{googleStyle.label}</span>
          </div>
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
                    <dd className="text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(google.lastVerifiedAt).toLocaleString()}</dd>
                  </div>
                )}
              </dl>
            )}
            {google.status === 'NOT_CONNECTED' && <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>Connect your Google account to enable appointment booking and email confirmations.</p>}
            {(google.status === 'ERROR' || google.status === 'RECONNECT_REQUIRED') && <p className="text-sm mb-5" style={{ color: 'var(--error-600)' }}>Your Google connection needs to be reauthorized. Click Reconnect to fix it.</p>}
            <div className="flex flex-wrap gap-2.5">
              {google.status === 'NOT_CONNECTED' && (
                <button onClick={() => startOAuth('/api/integrations/google/start')} disabled={connecting} className="btn-primary">{connecting ? 'Redirecting…' : 'Connect Google'}</button>
              )}
              {(google.status === 'CONNECTED' || google.status === 'ERROR' || google.status === 'RECONNECT_REQUIRED') && (
                <>
                  <button onClick={() => startOAuth('/api/integrations/google/reconnect')} disabled={connecting} className="btn-ghost">{connecting ? 'Redirecting…' : 'Reconnect'}</button>
                  <button onClick={disconnectGoogle} disabled={connecting} className="btn-danger">Disconnect</button>
                </>
              )}
            </div>
          </div>
          <div className="px-6 py-3.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Required scopes: Gmail Send, Gmail Read, Google Calendar. Tokens are encrypted at rest and never displayed.</p>
          </div>
        </div>
      )}

      {/* ── Twilio ─────────────────────────────────────────────────────── */}
      {!loading && twilio && (
        <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f22f46' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3a7 7 0 1 1 0 14A7 7 0 0 1 12 5zm-2.5 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-5 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Twilio</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Inbound calls · Outbound calls · SMS</p>
              </div>
            </div>
            <span className="badge" style={{ background: twilioStyle.bg, color: twilioStyle.text }}>{twilioStyle.label}</span>
          </div>

          <div className="px-6 py-5 space-y-4">
            {twilio.status === 'CONNECTED' && (
              <dl className="space-y-2">
                <div className="flex items-center gap-6">
                  <dt className="text-xs w-28 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>Account SID</dt>
                  <dd className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{twilio.accountSid}</dd>
                </div>
                <div className="flex items-center gap-6">
                  <dt className="text-xs w-28 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>Auth Token</dt>
                  <dd className="text-sm" style={{ color: 'var(--text-tertiary)' }}>••••••••••••••••••••••••••••••••</dd>
                </div>
                {twilio.lastVerifiedAt && (
                  <div className="flex items-center gap-6">
                    <dt className="text-xs w-28 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>Saved</dt>
                    <dd className="text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(twilio.lastVerifiedAt).toLocaleString()}</dd>
                  </div>
                )}
              </dl>
            )}

            {/* Webhook URLs — always visible so they can be copied into Twilio */}
            <div className="p-4 rounded-lg space-y-2" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Paste these into Twilio → Phone Numbers → Voice Configuration
              </p>
              {[
                { label: 'Voice webhook',   value: 'https://api.myorbisvoice.com/api/webhooks/twilio/voice'  },
                { label: 'Status callback', value: 'https://api.myorbisvoice.com/api/webhooks/twilio/status' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs w-28 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                  <code className="text-xs font-mono flex-1 truncate px-2 py-1 rounded" style={{ background: 'var(--surface-base)', color: 'var(--text-primary)' }}>{value}</code>
                  <button onClick={() => navigator.clipboard.writeText(value)}
                    className="text-xs px-2 py-1 rounded" style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                    Copy
                  </button>
                </div>
              ))}
            </div>

            {/* Credentials form */}
            <div className="space-y-3 pt-2">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {twilio.status === 'CONNECTED' ? 'Rotate credentials' : 'Connect Twilio'}
              </p>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Account SID</label>
                <input value={twilioForm.accountSid} onChange={(e) => setTwilioForm({ ...twilioForm, accountSid: e.target.value })}
                  className={inp} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Auth Token</label>
                <input type="password" value={twilioForm.authToken} onChange={(e) => setTwilioForm({ ...twilioForm, authToken: e.target.value })}
                  className={inp} placeholder="Your Twilio auth token" autoComplete="new-password" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveTwilio} disabled={twilioSaving || !twilioForm.accountSid || !twilioForm.authToken} className="btn-primary">
                  {twilioSaving ? 'Saving…' : twilio.status === 'CONNECTED' ? 'Rotate' : 'Save credentials'}
                </button>
                {twilio.status === 'CONNECTED' && (
                  <button onClick={disconnectTwilio} className="btn-danger">Disconnect</button>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-3.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Auth token is encrypted at rest and never displayed. Find your credentials at console.twilio.com → Account → API keys & tokens.
            </p>
          </div>
        </div>
      )}

      {/* ── API Integration (Coming Soon) ───────────────────────────────── */}
      <div className="rounded-xl opacity-60" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-overlay)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 9l-3 3 3 3M16 9l3 3-3 3M12 5v14" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>REST API</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Connect your own systems via API key</p>
            </div>
          </div>
          <span className="badge" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>Coming soon</span>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Generate API keys to push contacts, trigger campaigns, and pull conversation data directly from your CRM, website, or custom tooling.
          </p>
          <div className="mt-4 flex gap-2">
            <button disabled className="btn-primary opacity-40 cursor-not-allowed">Generate API key</button>
            <button disabled className="btn-ghost opacity-40 cursor-not-allowed">View docs</button>
          </div>
        </div>
        <div className="px-6 py-3.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Available in a future release. You&apos;ll be able to create scoped keys with read/write permissions per resource.</p>
        </div>
      </div>
    </div>
  )
}
