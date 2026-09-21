/* Aviso de las 8:00 (Web Push) y datos del widget.
 * Solo salen del móvil la suscripción y, por día, la racha y los pendientes. */
import { forecastKey, noticeFor, type ForecastRow } from './state/forecast';
import { fromBase64url, newPushId } from './state/pushId';

export const WORKER_URL = 'https://titan-push.titan-habits.workers.dev';
const VAPID_PUBLIC_KEY = 'BDV1JVfzJ7gxLIMli3Qr60ABJ_Ma4cAStB6TxO6LvwCHX3K_wM6mtbR_s3-DPJ9ZjFeTkbaiYijBNgsO2DJjNr0';
export const APP_URL = 'https://qrecall.github.io/titan-habits/';

const ID_KEY = 'titan.push.id';
const LAST_KEY = 'titan.push.lastKey';
const REG_KEY = 'titan.push.registered';
const DB = 'titan-push';
const STORE = 'kv';

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

async function call(path: string, method: 'POST' | 'PUT', body: unknown): Promise<Response> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 409) throw new Error(`HTTP ${res.status}`);
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

/** Actualiza la copia local y, si hay aviso activado y la previsión cambió, la sube. */
export async function syncForecast(rows: ForecastRow[]): Promise<void> {
  await saveNotices(rows);
  const id = pushId();
  if (!id) return;
  const key = forecastKey(rows);
  if (lsGet(LAST_KEY) === key) return;
  try {
    await call('/table', 'PUT', { id, rows });
    lsSet(LAST_KEY, key);
  } catch {
    /* sin conexión: se reintenta en el próximo cambio o al abrir la app */
  }
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

export async function sendTestPush(): Promise<{ ok: boolean; status: number }> {
  const id = pushId();
  if (!id) return { ok: false, status: 0 };
  const res = await call('/test', 'POST', { id });
  if (res.status === 409) {
    lsRemove(REG_KEY);
    return { ok: false, status: 409 };
  }
  return (await res.json()) as { ok: boolean; status: number };
}
