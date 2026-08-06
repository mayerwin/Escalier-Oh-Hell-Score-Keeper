/**
 * Service worker — the offline guarantee.
 *
 * Every file the app needs is precached on install, so once the page has been
 * opened one time it works with the radio off: no module fetch, no font, no
 * icon ever needs the network again. Games themselves live in localStorage and
 * never touch it in the first place.
 *
 * Strategy is cache-first for our own assets. There is nothing dynamic to be
 * stale about, and cache-first is the only strategy that behaves identically
 * on a plane and on a fast connection.
 *
 * `CACHE` embeds the app version; bumping `src/version.js` must bump this too,
 * which `tests/build.test.js` enforces.
 */

const VERSION = '2.0.0';
const CACHE = `escalier-v${VERSION}`;

/** The shell. If any of these fail to cache, the install fails loudly. */
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/app.css',
  './src/main.js',
  './src/model.js',
  './src/i18n.js',
  './src/storage.js',
  './src/share.js',
  './src/export.js',
  './src/dom.js',
  './src/sheet.js',
  './src/store.js',
  './src/ui.js',
  './src/chart.js',
  './src/version.js',
  './src/locales/en.js',
  './src/locales/fr.js',
  './src/locales/de.js',
  './src/locales/es.js',
  './src/locales/it.js',
  './src/locales/pt.js',
  './src/views/board.js',
  './src/views/chart.js',
  './src/views/games.js',
  './src/views/play.js',
  './src/views/roundsheet.js',
  './src/views/settings.js',
  './src/views/setup.js',
  './src/views/share.js',
  './src/views/stairs.js',
];

/** Nice to have. A missing icon should never cost the user offline support. */
const EXTRAS = [
  './assets/fonts/fraunces-latin.woff2',
  './assets/fonts/fraunces-latin-ext.woff2',
  './assets/fonts/instrument-sans-latin.woff2',
  './assets/fonts/instrument-sans-latin-ext.woff2',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-512.png',
  './assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE);
      await Promise.allSettled(EXTRAS.map((url) => cache.add(url)));
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('escalier-') && key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations always resolve to the app shell: the router lives client-side
  // and the fragment (where shared games travel) never reaches the network.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match('./index.html');
        if (cached) return cached;
        try {
          return await fetch(request);
        } catch {
          return new Response('<h1>Offline</h1>', { status: 503, headers: { 'Content-Type': 'text/html' } });
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;

      try {
        const response = await fetch(request);
        // Keep same-origin successes for next time; opaque and error responses
        // are not worth persisting.
        if (response && response.ok && response.type === 'basic') {
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const shell = await cache.match('./index.html');
        if (shell && request.destination === 'document') return shell;
        throw error;
      }
    })()
  );
});
