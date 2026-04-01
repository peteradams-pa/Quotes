/* Quotes PWA — Service Worker v4 — Full offline with aggressive font caching */
const CACHE_STATIC = 'quotes-static-v4';
const CACHE_FONTS  = 'quotes-fonts-v4';

const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(c => c.addAll(STATIC_ASSETS).catch(err => console.warn('SW static cache partial:', err)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_STATIC && k !== CACHE_FONTS).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Fonts from Google Fonts CDN (CSS + actual woff2 files) — cache-first
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CACHE_FONTS).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          // Use no-cors for font files so they can be cached
          const req = url.includes('fonts.gstatic.com')
            ? new Request(e.request, { mode: 'cors' })
            : e.request;
          const response = await fetch(req);
          if (response.status === 200) {
            cache.put(e.request, response.clone());
          }
          return response;
        } catch {
          return new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  // Icons from Google — cache-first
  if (url.includes('googleapis.com')) {
    e.respondWith(
      caches.open(CACHE_FONTS).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const response = await fetch(e.request);
          if (response.status === 200) cache.put(e.request, response.clone());
          return response;
        } catch {
          return cached || new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  // CDN libraries (jspdf, html2canvas) — cache-first
  if (url.includes('cdnjs.cloudflare.com')) {
    e.respondWith(
      caches.open(CACHE_STATIC).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const response = await fetch(e.request);
          if (response.status === 200) cache.put(e.request, response.clone());
          return response;
        } catch {
          return cached || new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  // App files — network first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response && response.status === 200) {
          caches.open(CACHE_STATIC).then(c => c.put(e.request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then(c => c || new Response('Offline', { status: 503 })))
  );
});
