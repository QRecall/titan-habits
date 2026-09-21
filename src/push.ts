/* Aviso de las 8:00 (Web Push) y datos del widget.
 * Solo salen del móvil la suscripción y, por día, la racha y los pendientes. */
import { forecastKey, noticeFor, type ForecastRow } from './state/forecast';
import { fromBase64url, newPushId } from './state/pushId';
import { createUploadQueue, createWriteGate } from './state/writeQueue';

export const WORKER_URL = 'https://titan-push.titan-habits.workers.dev';
const VAPID_PUBLIC_KEY = 'BDV1JVfzJ7gxLIMli3Qr60ABJ_Ma4cAStB6TxO6LvwCHX3K_wM6mtbR_s3-DPJ9ZjFeTkbaiYijBNgsO2DJjNr0';
export const APP_URL = 'https://qrecall.github.io/titan-habits/';

const ID_KEY = 'titan.push.id';
const LAST_KEY = 'titan.push.lastKey';
const REG_KEY = 'titan.push.registered';
const DB = 'titan-push';
const STORE = 'kv';

/** Cloudflare KV admite ~1 escritura/segundo por clave; `u:<id>` la comparten
 * POST /register y PUT /table, así que ambas pasan por el mismo espaciador. */
const WORKER_WRITE_SPACING_MS = 1200;
const runSpaced = createWriteGate(WORKER_WRITE_SPACING_MS);

export type PushStatus = 'unsupported' | 'off' | 'on' | 'denied';

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function lsGet(key: string): string | null {
  try {
    return ls()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    ls()?.setItem(key, value);
  } catch {
    /* sin almacenamiento: no persiste */
  }
}

function lsRemove(key: string): void {
  try {
    ls()?.removeItem(key);
  } catch {
    /* sin almacenamiento: no persiste */
  }
}

export function pushId(): string | null {
  return lsGet(ID_KEY);
}

function ensureId(): string {
  const existing = pushId();
  if (existing) return existing;
  const id = newPushId();
  lsSet(ID_KEY, id);
  return id;
}

function supported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

export async function pushStatus(): Promise<PushStatus> {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  const registered = lsGet(REG_KEY);
  return sub && pushId() && registered === sub.endpoint ? 'on' : 'off';
}

/** `tolerated`: códigos de error que esta llamada puede devolver sin que se
 * considere un fallo (el llamante los inspecciona él mismo). Por defecto
 * ninguno: `/register` y `/table` deben lanzar ante cualquier respuesta que
 * no sea 2xx, para que una escritura fallida no se dé nunca por buena (por
 * ejemplo, un 404/410/409 en `/register` no debe guardarse como registrada,
 * ni un 404/410/409 en `/table` debe marcarse como subida). Solo el aviso de
 * prueba, que solo lee el estado para decidir si la suscripción caducó, pasa
 * `[404, 409, 410]`. */
async function call(
  path: string,
  method: 'POST' | 'PUT',
  body: unknown,
  tolerated: readonly number[] = []
): Promise<Response> {
  const res = await runSpaced(() =>
    fetch(`${WORKER_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  if (!res.ok && !tolerated.includes(res.status)) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res;
}

/** Guarda los avisos ya compuestos para que el service worker los lea al llegar el push. */
function saveNotices(rows: ForecastRow[]): Promise<void> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve();
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => resolve();
    open.onsuccess = () => {
      const db = open.result;
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(rows.map(noticeFor), 'notices');
        const done = () => {
          db.close();
          resolve();
        };
        tx.oncomplete = done;
        tx.onerror = done;
        tx.onabort = done;
      } catch {
        db.close();
        resolve();
      }
    };
  });
}

/** Cola de subida de la tabla: como mucho un PUT /table en curso, espaciado
 * frente a cualquier otra escritura al Worker; las llamadas rápidas seguidas
 * (varias marcas de un tirón) se coalescen en la más reciente. Un fallo no
 * reintenta solo: el próximo cambio de estado o apertura de la app lo retoma. */
const tableQueue = createUploadQueue<ForecastRow[]>({
  send: async (rows) => {
    const id = pushId();
    if (!id) return;
    await call('/table', 'PUT', { id, rows });
  },
  key: forecastKey,
  getLastSentKey: () => lsGet(LAST_KEY),
  onSent: (key) => lsSet(LAST_KEY, key),
});

/** Actualiza la copia local (siempre, de inmediato) y, si hay aviso activado,
 * encola la subida de la previsión al Worker (ver `tableQueue`). */
export async function syncForecast(rows: ForecastRow[]): Promise<void> {
  await saveNotices(rows);
  const id = pushId();
  if (!id) return;
  tableQueue.request(rows);
}

export async function enablePush(rows: ForecastRow[]): Promise<PushStatus> {
  if (!supported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: fromBase64url(VAPID_PUBLIC_KEY) as BufferSource,
    }));
  const id = ensureId();
  await call('/register', 'POST', { id, subscription: { endpoint: sub.endpoint } });
  lsSet(REG_KEY, sub.endpoint);
  lsRemove(LAST_KEY);
  await syncForecast(rows);
  return 'on';
}

/** El Worker ya no tiene la suscripción (404/409/410): además de olvidar el
 * endpoint registrado, nos damos de baja localmente para que la próxima
 * activación cree una suscripción nueva en vez de reenviar la caducada. */
async function unsubscribeStale(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch {
    /* sin service worker, sin suscripción o sin permiso: no pasa nada, se
     * reintenta al volver a activar el aviso */
  }
}

export async function sendTestPush(): Promise<{ ok: boolean; status: number }> {
  const id = pushId();
  if (!id) return { ok: false, status: 0 };
  const res = await call('/test', 'POST', { id }, [404, 409, 410]);
  if (res.status === 404 || res.status === 409 || res.status === 410) {
    lsRemove(REG_KEY);
    await unsubscribeStale();
    return { ok: false, status: res.status };
  }
  return (await res.json()) as { ok: boolean; status: number };
}
