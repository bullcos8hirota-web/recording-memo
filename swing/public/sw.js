const CACHE_NAME = 'swing-trade-app-v1'
const SCOPE_URL = self.registration.scope
const INDEX_URL = new URL('index.html', SCOPE_URL).href
const APP_SHELL = [
  SCOPE_URL,
  INDEX_URL,
  new URL('favicon.svg', SCOPE_URL).href,
  new URL('icon-192.png', SCOPE_URL).href,
  new URL('icon-512.png', SCOPE_URL).href,
  new URL('manifest.webmanifest', SCOPE_URL).href,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(INDEX_URL, response.clone())),
            )
          }
          return response
        })
        .catch(() => caches.match(INDEX_URL)),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) {
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())),
        )
      }
      return response
    }),
  )
})
