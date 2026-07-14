// VGC Helper service worker — makes the PWA installable and usable offline.
// Strategy: stale-while-revalidate for same-origin GETs (app shell + assets),
// network-only for everything else (the battle-data API must stay live).
// Vite fingerprints asset filenames, so caching at runtime keeps the cache
// correct across rebuilds without a precomputed manifest.
const CACHE = 'vgc-helper-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // let the API & sprites hit the network

  event.respondWith(
    (async () => {
      const cached = await caches.match(req)
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      // Serve cache immediately if present; otherwise wait for the network.
      return cached || network
    })()
  )
})
