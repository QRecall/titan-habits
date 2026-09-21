# TITAN · Aviso diario (Web Push) y widget de racha

Fecha: 2026-09-21 · Estado: aprobado en conversación, pendiente de revisión escrita.

## Objetivo

1. Cada día a las **08:00 hora de Madrid** el iPhone recibe un aviso de TITAN y el número del
   icono se actualiza sin abrir la app.
2. Un **widget de Scriptable** en la pantalla de inicio muestra la racha y los compromisos
   pendientes de hoy.

Fuera de alcance: tocar los recordatorios de Google Calendar (se mantienen), avisos a otras
horas, soporte multiusuario más allá de lo que da gratis el diseño por identificador.

## Decisiones

- Hora del aviso: 08:00 todos los días (Europe/Madrid).
- Datos que salen del móvil: **solo** dos números por día (racha y pendientes) para los próximos
  7 días, más la suscripción push. Nada de nombres, notas ni hechos.
- El push llega **sin contenido**: el texto lo compone la app, lo guarda en el móvil y el service worker lo lee. Sin
  cifrado de payload.
- Calendario de Google: se mantiene como está.

## Arquitectura

```
TITAN (PWA, GitHub Pages)                Worker (Cloudflare, gratis)          iPhone (SW)
 estado cambia ─► forecast 7 días ──PUT /table──► KV: {sub, table}
            └──► IndexedDB (copia)                cron 06:00 y 07:00 UTC
 botón "Activar" ─► pushManager.subscribe          └─ si Madrid = 08 → push vacío ─► 'push'
            └──POST /register──► KV                                                lee IndexedDB
 Scriptable ◄───────────── GET /today?id ─── fila de hoy                           notificación + badge
```

### Tabla de previsión (`src/state/forecast.ts`)

`buildForecast(state, fromISO, days = 7): ForecastRow[]` con
`ForecastRow = { date: string; streak: number; pending: number | null }`:

- `pending`: número de compromisos del contrato de la semana de `date`; `null` si esa semana no
  tiene contrato. Para `date === hoy` son los aún sin marcar (`pendingToday`).
- `streak`: racha que se verá la mañana de `date` si no se marca nada más, es decir
  `computeStreakAcross(state, date)`. Para días futuros sale la racha acumulada si hoy queda
  completo, y 0 si no (misma regla que ya usa la app).

`forecastKey(rows)` da una cadena estable para comparar y no subir si no cambia.

### App (`src/push.ts`)

- `VAPID_PUBLIC_KEY` y `WORKER_URL` como constantes.
- Identificador: 128 bits aleatorios en base64url, guardado en `localStorage` (`titan.push.id`).
  No entra en la copia de seguridad.
- `enablePush()`: pide permiso, `pushManager.subscribe({ userVisibleOnly: true,
  applicationServerKey })`, `POST /register {id, subscription}`, y después sube la tabla.
- `syncForecast(rows)`: escribe siempre en IndexedDB (`titan-push` v1 / `kv` / `notices`) los avisos
  ya compuestos con `noticeFor(row)` → `{date, body, badge}`; sube con
  `PUT /table {id, rows}` solo si hay id y `forecastKey` cambió respecto a la última subida
  correcta (`titan.push.lastKey`). Si falla, no guarda la clave y reintenta en el siguiente cambio
  o al abrir la app.
- `sendTestPush()`: `POST /test {id}`.
- `pushStatus()`: `unsupported | off | on | denied`.
- `widgetScript(workerUrl, id, appUrl)` (en `src/state/widget.ts`): devuelve el script de Scriptable con la URL y el id incrustados.

`App.tsx`: en el mismo efecto del badge, `syncForecast(buildForecast(state, today()))`.

`MyData.tsx`: sección "Aviso y widget" con estado y botones **Activar aviso de las 8:00**,
**Enviar aviso de prueba** y **Copiar script del widget**, con una línea de instrucciones para
Scriptable.

### Service worker (`public/sw.js`, VERSION `titan-sw-v3`)

- `push`: lee `notices` de IndexedDB y usa el de la fecha local de hoy (el texto lo compone la
  app con `noticeFor`, probado con Vitest):
  - `pending` numérico → cuerpo `🔥 {streak} días · {pending} compromisos hoy` (singular si 1;
    si `pending` es 0 → `🔥 {streak} días · todo hecho`); badge = `pending`.
  - `pending === null` → `Toca firmar el contrato de la semana`; sin badge.
  - Sin aviso para hoy → `Abre TITAN para ver tu día`.
  - Siempre muestra una notificación (obligatorio en iOS), `tag: 'titan-daily'`.
- `notificationclick`: cierra y enfoca o abre la app.

### Worker (`worker/`)

- `wrangler.toml`: nombre `titan-push` (URL `https://titan-push.titan-habits.workers.dev`), KV
  `TITAN`, crons `0 6 * * *` y `0 7 * * *`, variables `ALLOWED_ORIGIN = https://qrecall.github.io`
  y `VAPID_SUBJECT = https://qrecall.github.io/titan-habits/` (el repo es público: sin correo),
  secreto `VAPID_PRIVATE_JWK`.
- KV: clave `u:<id>` → `{ subscription?: { endpoint }, rows?, updatedAt }`. Solo se guarda el
  `endpoint` (sin payload no hacen falta las claves de cifrado) y solo si es de un servicio push
  conocido (Apple, Google, Mozilla, Microsoft) por https.
- Rutas:
  - `POST /register {id, subscription}` → guarda la suscripción.
  - `PUT /table {id, rows}` → valida (máx. 14 filas, números enteros ≥ 0 o null) y guarda.
  - `GET /today?id=…` → `{ date, found, streak, pending }` de la fila de hoy en Madrid
    (`found: false` y nulos si no hay).
  - `POST /test {id}` → push inmediato a esa suscripción.
  - CORS (`ALLOWED_ORIGIN` = `https://qrecall.github.io`) en todas las respuestas, incluida
    `GET /today`; Scriptable la ignora (no es una petición de navegador).
  - `id` debe ser base64url de 22 caracteres; cualquier otra cosa → 400.
- `scheduled`: si la hora de Madrid es 8 (`madridParts(now).hour === 8` con `Intl.DateTimeFormat`),
  recorre las claves `u:` y envía push vacío a cada suscripción.
- `vapid.ts`: JWT ES256 con WebCrypto (`aud` = origen del endpoint, `exp` = +1 h, `sub` =
  `VAPID_SUBJECT`), cabeceras `Authorization: vapid t=…, k=…`, `TTL: 14400` (4 h por si el móvil está sin red), `Urgency: normal`.
- Respuesta 404/410 del servicio push → borra `subscription` de esa clave.

### Widget de Scriptable

Script pequeño: `GET /today?id=…`, `ListWidget` con fondo oscuro, 🔥 y la racha en grande,
"N pendientes hoy" o "todo hecho" debajo; racha 0 → brasa (color apagado); error o `null` → "—".
`refreshAfterDate` a 30 min.

## Errores

- Sin red al subir: se reintenta en el siguiente cambio o apertura.
- Suscripción caducada: el Worker la borra; en "Mis datos" el estado vuelve a "desactivado" la
  próxima vez que `pushManager.getSubscription()` no la encuentre, y se puede reactivar.
- Más de 7 días sin abrir: el aviso dice "Abre TITAN para ver tu día", el widget "—".
- Cambio de móvil o restaurar copia: hay que reactivar y copiar el script otra vez.

## Pruebas

- Vitest (app): `buildForecast` (racha con hoy completo/incompleto, semana sin contrato, cruce de
  semana, `pending` de hoy frente a días futuros), `forecastKey`.
- Vitest (worker): `madridParts` en invierno (UTC+1) y verano (UTC+2), selección de fila de hoy,
  validación de `id` y de filas.
- Manual en el iPhone: activar, aviso de prueba, badge, widget.

## Pasos del usuario

1. Cuenta de Cloudflare y login (navegador).
2. Instalar Scriptable.
3. Tras publicar: activar el aviso en "Mis datos", pegar el script, añadir el widget.
