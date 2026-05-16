// OrbisVoice service worker — handles incoming Web Push notifications.

self.addEventListener('push', (event) => {
  let data = { title: 'OrbisVoice', body: 'New activity', url: '/' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    // event.data wasn't JSON; fall through with defaults
    if (event.data) data.body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.tag || 'orbisvoice',
      data: { url: data.url || '/' },
      requireInteraction: false,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab if one is already on the target URL.
      for (const client of clientList) {
        if (client.url.endsWith(targetUrl) && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new tab to the target URL.
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    }),
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Minimal fetch handler — present so the dashboard meets PWA installability
// criteria. Pure pass-through (no caching); real offline support comes later.
self.addEventListener('fetch', () => {})
