/*
 * Tapora Services — service worker du portail du personnel (/service/…).
 *
 * Un seul rôle : recevoir les notifications des demandes des clients et
 * ouvrir le portail au toucher. Aucune mise en cache : la file reste
 * toujours fraîche.
 */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let m = {}
  try {
    m = e.data ? e.data.json() : {}
  } catch {
    m = { titre: 'Tapora', corps: e.data ? e.data.text() : '' }
  }
  e.waitUntil(
    self.registration.showNotification(m.titre || 'Nouvelle demande', {
      body: m.corps || '',
      icon: '/icones/icone-192.png',
      badge: '/icones/icone-192.png',
      tag: m.etiquette || 'tapora-service',
      renotify: true,
      requireInteraction: false,
      vibrate: [120, 60, 120],
      data: { url: m.url || '/service/' },
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL((e.notification.data && e.notification.data.url) || '/service/', self.location.origin).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if (f.url.split('?')[0] === url.split('?')[0] && 'focus' in f) return f.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
