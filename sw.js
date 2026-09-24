// Service worker: makes Questbook load offline after the first visit.
// Strategy: serve from cache immediately, refresh the cache in the background
// (stale-while-revalidate). Bump VERSION when shipping to clear old caches.
const VERSION = 'questbook-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './styles/tokens.css',
  './styles/base.css',
  './styles/components.css',
  './styles/views.css',
  './js/app.js',
  './js/store.js',
  './js/files.js',
  './js/ui.js',
  './js/util.js',
  './js/components.js',
  './js/views/home.js',
  './js/views/classes.js',
  './js/views/schedule.js',
  './js/views/assignments.js',
  './js/views/timer.js',
  './js/views/notes.js',
  './js/views/games.js',
  './js/views/progress.js',
  './js/views/design.js',
  './js/views/settings.js',
  './js/views/help.js',
  './js/views/onboarding.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const cacheable = url.origin === location.origin || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (!cacheable) return;

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const network = fetch(request)
        .then((res) => {
          if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached || (request.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return cached || network;
    }),
  );
});
