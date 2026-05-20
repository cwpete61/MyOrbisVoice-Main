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

// NO fetch handler on purpose.
//
// We previously registered an empty `self.addEventListener('fetch', () => {})`
// for "PWA installability." That was wrong on two counts:
//   1. Registering ANY fetch listener forces the browser to route every
//      network request through this SW. Returning undefined from an empty
//      handler is meant to fall through to the native fetch — but iOS Safari
//      WebKit (and iOS Chrome, which uses the same engine on Apple's
//      mandate) treats it as a hang and eventually serves a blank document
//      or "Safari couldn't open the page because the server stopped
//      responding." Chronic intermittent blank screens on iPad / iPhone.
//   2. Modern installability heuristics don't require a fetch handler; the
//      installable PWA in this product is the separate "MyOrbisVoice Preview"
//      surface at myorbisresults.com/preview/, not the app dashboard.
//
// Without a fetch listener registered, the browser handles every request
// natively. Push notifications + notification-click flow above are
// unaffected — those run on separate events.
