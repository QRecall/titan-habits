/* TITAN · service worker
 * Objetivo: que la app abra sin conexión una vez visitada.
 *  · Navegaciones (index.html): red primero, caché si falla.
 *  · Recursos propios (js, css, iconos, fuentes locales): caché primero,
 *    actualizando en segundo plano.
 *  · Nunca toca peticiones a otros dominios (fuentes de Google, etc.).
 * Sin precarga de nombres con hash: se cachea lo que se va pidiendo.
 * Aviso de las 8:00: al llegar un push (vacío) muestra el aviso del día
 * guardado por la app en IndexedDB y pone el número del icono.
 */
const VERSION = 'titan-sw-v3';
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

// ── Aviso de las 8:00 ─────────────────────────────────────────────
// El push llega vacío: el texto lo dejó preparado la app en IndexedDB.
function readNotices() {
  return new Promise((resolve) => {
    const open = indexedDB.open('titan-push', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      const db = open.result;
      try {
        const req = db.transaction('kv', 'readonly').objectStore('kv').get('notices');
        req.onsuccess = () => {
          db.close();
          resolve(req.result || null);
        };
        req.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch (e) {
        try {
          db.close();
        } catch (_) {
          /* ya cerrada o inválida */
        }
        resolve(null);
      }
    };
  });
}

function localISODate(d) {
  const p = (n) => (n < 10 ? '0' : '') + n;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      const notices = await readNotices();
      const today = localISODate(new Date());
      const n = Array.isArray(notices) ? notices.find((x) => x && x.date === today) : null;
      if (self.navigator.setAppBadge) {
        try {
          if (n && n.badge > 0) await self.navigator.setAppBadge(n.badge);
          else await self.navigator.clearAppBadge();
        } catch (e) {
          /* sin permiso de número: seguimos con el aviso */
        }
      }
      await self.registration.showNotification('TITAN', {
        body: n ? n.body : 'Abre TITAN para ver tu día',
        tag: 'titan-daily',
        icon: new URL('icons/icon-192.png', self.registration.scope).href,
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) if ('focus' in w) return w.focus();
      return self.clients.openWindow(self.registration.scope);
    })()
  );
});
