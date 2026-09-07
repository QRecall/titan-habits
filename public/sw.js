/* TITAN · service worker
 * Objetivo: que la app abra sin conexión una vez visitada.
 *  · Navegaciones (index.html): red primero, caché si falla.
 *  · Recursos propios (js, css, iconos, fuentes locales): caché primero,
 *    actualizando en segundo plano.
 *  · Nunca toca peticiones a otros dominios (fuentes de Google, etc.).
 * Sin precarga de nombres con hash: se cachea lo que se va pidiendo.
 */
const VERSION = 'titan-sw-v2';
const SHELL = [new URL('./', self.location).pathname];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(SHELL[0], copy));
          return res;
        })
        .catch(() => caches.match(SHELL[0]))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
