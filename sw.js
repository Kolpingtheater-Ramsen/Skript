const CACHE_NAME = 'drehbuch-cache-v1'
const ASSETS_TO_CACHE = [
  '/',
  '/static/css/styles.css',
  '/static/css/base.css',
  '/static/css/components.css',
  '/static/css/script.css',
  '/static/css/themes.css',
  '/static/js/main.js',
  '/static/js/vendor/papaparse.min.js',
  '/static/assets/logo.png',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.0.1/socket.io.js',
]

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE)
    })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

// Fetch event - serve from cache, then network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached version first
      if (cachedResponse) {
        // Try to fetch new version in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone())
                // If content is different, post message to client
                if (
                  !cachedResponse.headers.get('ETag') ===
                  networkResponse.headers.get('ETag')
                ) {
                  self.clients.matchAll().then((clients) => {
                    clients.forEach((client) =>
                      client.postMessage({ type: 'CONTENT_UPDATED' })
                    )
                  })
                }
              })
            }
          })
          .catch(() => {
            /* Ignore fetch errors */
          })
        return cachedResponse
      }

      // If not in cache, fetch from network
      return fetch(event.request).then((response) => {
        // Cache the network response for future
        if (response && response.status === 200) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
        }
        return response
      })
    })
  )
})
