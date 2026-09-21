/* Sachwert-Tresor Service Worker — App-Shell offline cachen.
   Speichert KEINE Tresor-Daten (die liegen verschlüsselt im localStorage). */
const CACHE = 'sachwert-tresor-v32';
const CORE = ['./', './index.html', './app.js', './qr.js', './manifest.webmanifest', './icon.svg', './vendor/fonts/fonts.css', './vendor/hash-wasm/argon2.umd.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Cache-first: offline lauffähig; neue Assets (z.B. Fonts) werden bei Bedarf nachgecacht.
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
      if (resp && resp.ok && resp.type === 'basic') {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return resp;
      // Offline + nicht im Cache: bei Navigationen die App-Shell liefern statt Netzfehler
    }).catch(() => e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  );
});
