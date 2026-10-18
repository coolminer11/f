/*
 * Tapora — service worker du back-office (portée « / »).
 *
 * Il rend l'app installable et affiche un écran « hors ligne » propre quand
 * le téléphone n'a pas de réseau. Il ne met JAMAIS en cache les pages ni les
 * données : la comptabilité ne doit pas traîner dans la mémoire du téléphone,
 * et un chiffre affiché est toujours un chiffre à jour.
 * (Les pages client /stats/… ont leur propre service worker, plus précis.)
 */
const CACHE = 'tapora-bo-v2'
const HORS_LIGNE = '/hors-ligne.html'
const FICHIERS = [HORS_LIGNE]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c.startsWith('tapora-bo-') && c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const r = e.request
  // Seules les navigations (ouvrir une page) sont concernées ; tout le reste
  // va directement au réseau, sans passer par ici.
  if (r.method !== 'GET' || r.mode !== 'navigate') return
  e.respondWith(fetch(r).catch(() => caches.match(HORS_LIGNE)))
})
