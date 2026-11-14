// Mitemshub Billing Studio service worker: keeps the app shell available offline.
// API traffic is always live — ledger data and sessions are never served stale.
const CACHE = 'mitems-shell-v1';
const FONT_CACHE = 'mitems-fonts-v1';
const SCOPE = self.registration.scope;

const scoped = (path) => new URL(path, SCOPE).toString();
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'].map(
  scoped
);

const remember = (cacheName, request, response) =>
  caches.open(cacheName).then((cache) => cache.put(request, response)).catch(() => undefined);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE && key !== FONT_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === location.origin;

  // Sessions and ledger data must always come from the server.
  if (sameOrigin && url.pathname.includes('/api/')) return;

  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (isFont) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request)
              .then((response) => {
                void remember(FONT_CACHE, request, response.clone());
                return response;
              })
              .catch(() => hit)
        )
      )
    );
    return;
  }

  if (!sameOrigin) return;

  // Navigations: network first, so a redeploy is picked up, with the shell as fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          void remember(CACHE, request, response.clone());
          return response;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match(scoped('./index.html')))
        )
    );
    return;
  }

  // Vite emits content-hashed assets, so cache-first is safe.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) void remember(CACHE, request, response.clone());
          return response;
        })
    )
  );
});
