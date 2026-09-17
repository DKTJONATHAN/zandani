// ============================================
// Za Ndani PWA Service Worker
// Version: 1.3.0
// ============================================

const CACHE_NAME = 'zandani-v1.3.0';
const OFFLINE_URL = '/offline.html';

const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/logo.png',
  '/favicon.ico'
];

const CACHEABLE_EXTENSIONS = [
  '.js', '.css', '.json',
  '.png', '.jpg', '.jpeg', '.webp', '.svg',
  '.woff', '.woff2', '.ttf'
];

const NO_CACHE_PATTERNS = [
  '/api/',
  '/get-views',
  '/analytics',
  '/ads.txt'
];

function shouldCache(url) {
  if (!url.startsWith('https') && !url.startsWith('http')) return false;

  if (url.includes('google-analytics') ||
      url.includes('googletagmanager') ||
      url.includes('pagead2') ||
      url.includes('doubleclick')) return false;

  for (const pattern of NO_CACHE_PATTERNS) {
    if (url.includes(pattern)) return false;
  }

  for (const ext of CACHEABLE_EXTENSIONS) {
    if (url.includes(ext)) return true;
  }

  try {
    const urlObj = new URL(url);
    if (urlObj.origin === self.location.origin && !urlObj.pathname.includes('.')) {
      return true;
    }
  } catch (e) {
    return false;
  }

  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] Install failed:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Network-first for HTML navigations so users always get the latest shell
  if (request.mode === 'navigate' ||
      (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          return (await caches.match(request)) ||
            (await caches.match(OFFLINE_URL)) ||
            new Response('Offline', { status: 503 });
        })
    );
    return;
  }

  if (shouldCache(url.href)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          event.waitUntil(
            fetch(request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse);
                });
              }
            }).catch(() => {})
          );
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone());
            });
          }
          return networkResponse;
        });
      }).catch(() => {
        if (url.href.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          return caches.match('/logo.png');
        }
        return new Response('Offline - content unavailable', { status: 404 });
      })
    );
    return;
  }

  event.respondWith(fetch(request));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Web Push: show notification as soon as a post is published ──
self.addEventListener('push', (event) => {
  let data = { title: 'Za Ndani', body: 'New story just published', url: '/' };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    try {
      data.body = event.data ? event.data.text() : data.body;
    } catch (_) { /* ignore */ }
  }

  const options = {
    body: data.body || 'New story just published',
    icon: '/logo.png',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    tag: data.url || 'zandani-news',
    renotify: true,
    data: { url: data.url || '/' },
    actions: [{ action: 'open', title: 'Read' }],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Za Ndani', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
