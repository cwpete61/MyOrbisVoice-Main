'use client'

import { useEffect, useState } from 'react'
import { apiFetch, apiFetchRaw } from '@/hooks/useApi'

const DISMISS_KEY = 'orbisvoice_push_banner_dismissed'

type State = 'loading' | 'show' | 'hidden' | 'busy'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = typeof window !== 'undefined' ? window.atob(b64) : ''
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

// Renders a "turn on call notifications" banner on the dashboard if the
// user hasn't subscribed yet AND hasn't permanently dismissed it. Hidden
// once they enable, deny permission, or click "Not now". Settings page
// always remains the way to (re-)enable.
export function EnableNotificationsBanner() {
  const [state, setState] = useState<State>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      if (typeof window === 'undefined') return
      // Permanently dismissed already?
      if (localStorage.getItem(DISMISS_KEY) === '1') {
        setState('hidden')
        return
      }
      // Browser support
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState('hidden')
        return
      }
      // Already denied at the OS/browser level
      if (Notification.permission === 'denied') {
        setState('hidden')
        return
      }
      // Already subscribed?
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        const sub = await reg?.pushManager.getSubscription()
        if (sub) {
          setState('hidden')
          return
        }
      } catch { /* fall through to show */ }
      // VAPID configured on the server?
      try {
        const r = await apiFetchRaw('/api/push/vapid-public-key')
        if (!r.ok) { setState('hidden'); return }
      } catch { setState('hidden'); return }

      setState('show')
    })()
  }, [])

  async function enable() {
    setState('busy'); setError(null)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setState('hidden')
        if (perm === 'denied') {
          setError('Permission was denied — re-enable in your browser site settings if you change your mind.')
        }
        return
      }
      const r = await apiFetchRaw('/api/push/vapid-public-key')
      const j = await r.json() as { data?: { publicKey: string } }
      if (!j.data?.publicKey) { setState('hidden'); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(j.data.publicKey) as unknown as BufferSource,
      })
      const subJson = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } }
      await apiFetch('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: { p256dh: subJson.keys?.p256dh ?? '', auth: subJson.keys?.auth ?? '' },
        }),
      })
      // Fire a confirmation push so the user immediately sees one
      try { await apiFetch('/api/push/test', { method: 'POST' }) } catch { /* non-blocking */ }
      setState('hidden')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable notifications.')
      setState('show')
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setState('hidden')
  }

  if (state === 'loading' || state === 'hidden') return null

  return (
    <div
      className="rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
      style={{ background: 'oklch(98% 0.02 193)', border: '1px solid oklch(85% 0.10 193)' }}
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: 'oklch(35% 0.16 193)' }}>
          Get notified when calls come in
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'oklch(45% 0.10 193)' }}>
          One click and your desktop alerts you on every new conversation. You can change this anytime in Settings.
        </p>
        {error && (
          <p className="text-xs mt-1" style={{ color: 'oklch(45% 0.18 25)' }}>{error}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={dismiss}
          disabled={state === 'busy'}
          className="text-sm px-3 py-1.5 rounded-lg"
          style={{ color: 'oklch(45% 0.10 193)' }}
        >
          Not now
        </button>
        <button
          onClick={enable}
          disabled={state === 'busy'}
          className="text-sm font-medium px-4 py-2 rounded-lg"
          style={{ background: 'oklch(55% 0.16 193)', color: 'white' }}
        >
          {state === 'busy' ? 'Enabling…' : 'Enable notifications'}
        </button>
      </div>
    </div>
  )
}
