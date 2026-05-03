'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

type Status = 'unsupported' | 'unconfigured' | 'denied' | 'unsubscribed' | 'subscribed' | 'loading'

// Helper: VAPID public key comes as URL-safe base64; convert to Uint8Array
// for PushManager.subscribe.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = typeof window !== 'undefined' ? window.atob(b64) : ''
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function PushNotificationToggle() {
  const [status, setStatus] = useState<Status>('loading')
  const [busy, setBusy]     = useState(false)
  const [msg, setMsg]       = useState<string | null>(null)

  // Detect current state on mount
  useEffect(() => {
    void (async () => {
      if (typeof window === 'undefined') return
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        setStatus('denied')
        return
      }
      // Check if we have a server-side VAPID key + an active subscription
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        const sub = await reg?.pushManager.getSubscription()
        if (sub) {
          setStatus('subscribed')
          return
        }
        // Not subscribed yet — make sure server has VAPID configured
        const vapidRes = await fetch('/api/push/vapid-public-key')
        if (vapidRes.status === 503) { setStatus('unconfigured'); return }
        setStatus('unsubscribed')
      } catch {
        setStatus('unsubscribed')
      }
    })()
  }, [])

  async function enable() {
    setBusy(true); setMsg(null)
    try {
      // Register the service worker
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Permission prompt
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'denied' : 'unsubscribed')
        setMsg(perm === 'denied'
          ? 'Permission denied. Re-enable in your browser site settings to use push notifications.'
          : 'Permission was not granted.')
        return
      }

      // Fetch VAPID key
      const r = await fetch('/api/push/vapid-public-key')
      const j = await r.json() as { data?: { publicKey: string } }
      if (!j.data?.publicKey) {
        setStatus('unconfigured')
        setMsg('Push not configured on the platform. Contact support.')
        return
      }

      // Subscribe via the browser PushManager. Casting to BufferSource because
      // Next 14's TS lib types Uint8Array<ArrayBufferLike> incompatibly here —
      // at runtime PushManager accepts the typed array unchanged.
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(j.data.publicKey) as unknown as BufferSource,
      })

      // POST the subscription to the API
      const subJson = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } }
      await apiFetch('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh ?? '',
            auth:   subJson.keys?.auth ?? '',
          },
        }),
      })

      setStatus('subscribed')
      setMsg('Notifications enabled — sending a test now.')

      // Fire a test notification so user immediately sees it works
      try {
        await apiFetch('/api/push/test', { method: 'POST' })
      } catch { /* test failure is non-blocking */ }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to enable notifications.')
    } finally { setBusy(false) }
  }

  async function disable() {
    setBusy(true); setMsg(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      setStatus('unsubscribed')
      setMsg('Notifications disabled on this device. (Server-side cleanup happens on next push.)')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to disable.')
    } finally { setBusy(false) }
  }

  if (status === 'loading') {
    return <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Checking notification status…</div>
  }
  if (status === 'unsupported') {
    return <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Your browser does not support push notifications.</p>
  }
  if (status === 'unconfigured') {
    return <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Push notifications are not yet enabled on this platform — contact support.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Desktop notifications {status === 'subscribed' && <span className="text-xs font-normal" style={{ color: 'oklch(45% 0.16 160)' }}>(active on this device)</span>}
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Get a popup when a new call comes in, even if this tab is in the background.
          </p>
        </div>
        {status === 'subscribed' ? (
          <button onClick={disable} disabled={busy} className="text-sm px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            {busy ? 'Disabling…' : 'Disable'}
          </button>
        ) : (
          <button onClick={enable} disabled={busy || status === 'denied'} className="btn-primary text-sm">
            {busy ? 'Enabling…' : status === 'denied' ? 'Blocked in browser' : 'Enable'}
          </button>
        )}
      </div>
      {msg && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}>
          {msg}
        </div>
      )}
      {status === 'denied' && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          You previously blocked notifications. To enable, click the lock icon in the address bar → Site settings → Notifications → Allow.
        </p>
      )}
    </div>
  )
}
