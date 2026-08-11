// Build version - replaced at build time
const CACHE_VERSION = 'BUILD_TIMESTAMP_PLACEHOLDER';
const CACHE_NAME = `drehbuch-cache-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  '/',
  '/static/css/styles.css',
  '/static/css/base.css',
  '/static/css/components.css',
  '/static/css/script.css',
  '/static/css/themes.css',
  '/static/js/main.js',
  '/static/js/vendor/papaparse.min.js',
  '/static/js/state.js',
  '/static/js/config.js',
  '/static/js/socket.js',
  '/static/js/ui-controls.js',
  '/static/js/loading-screen.js',
  '/static/js/utils.js',
  '/static/js/navigation.js',
  '/static/js/app-events.js',
  '/static/js/script-loader.js',
  '/static/js/director.js',
  '/static/js/renderer.js',
  '/static/js/sheet-validation.js',
  '/static/js/data-manager.js',
  '/static/js/actor-groups.js',
  '/static/js/filter-presets.js',
  '/static/js/inline-text.js',
  '/static/js/mic-cue-generator.js',
  '/static/js/runtime.js',
  '/static/data/plays.json',
  '/static/assets/logo.png',
  '/static/assets/theme-backgrounds/background-light.webp?v=theater-v2',
  '/static/assets/theme-backgrounds/background-dark.webp?v=theater-v2',
  '/static/assets/theme-backgrounds/background-pink.webp?v=theater-v2',
  '/manifest.json',
];

const FALLBACK_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);

// Install event - cache assets and skip waiting
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${CACHE_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${CACHE_VERSION}`);
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('drehbuch-cache-')) {
              console.log(`[SW] Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
      .then(() => {
        // Notify all clients that a new version is active
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION });
          });
        });
      })
  );
});

// Fetch event - network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip external requests (except CDN assets we want to cache)
  if (!url.origin.includes(self.location.origin) && 
      !url.href.includes('cdnjs.cloudflare.com/ajax/libs/socket.io')) {
    return;
  }

  // Network-first for HTML pages and API calls
  if (event.request.mode === 'navigate' || 
      url.pathname.endsWith('.html') || 
      url.pathname === '/' ||
      url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Cache-first for static assets
  event.respondWith(cacheFirst(event.request));
});

// Network-first strategy: try network, fall back to cache
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    if (networkResponse && FALLBACK_STATUSES.has(networkResponse.status)) {
      const cachedResponse = await matchCachedFallback(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await matchCachedFallback(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function matchCachedFallback(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  if (request.mode === 'navigate') {
    return caches.match('/');
  }

  return null;
}

// Cache-first strategy: try cache, fall back to network
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // Update cache in background
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, networkResponse);
          });
        }
      })
      .catch(() => { /* Ignore background fetch errors */ });
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.status === 200) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
