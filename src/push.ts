/* Aviso de las 8:00 (Web Push) y datos del widget.
 * Solo salen del móvil la suscripción y, por día, la racha y los pendientes. */
import { forecastKey, noticeFor, type ForecastRow } from './state/forecast';
import { fromBase64url, newPushId } from './state/pushId';

export const WORKER_URL = 'https://titan-push.titan-habits.workers.dev';
const VAPID_PUBLIC_KEY = 'BDV1JVfzJ7gxLIMli3Qr60ABJ_Ma4cAStB6TxO6LvwCHX3K_wM6mtbR_s3-DPJ9ZjFeTkbaiYijBNgsO2DJjNr0';
export const APP_URL = 'https://qrecall.github.io/titan-habits/';

const ID_KEY = 'titan.push.id';
const LAST_KEY = 'titan.push.lastKey';
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

export function pushId(): string | null {
  try {
    return ls()?.getItem(ID_KEY) ?? null;
  } catch {
    return null;
  }
}

function ensureId(): string {
  const existing = pushId();
  if (existing) return existing;
  const id = newPushId();
  try {
    ls()?.setItem(ID_KEY, id);
  } catch {
    /* sin almacenamiento: el id vive solo esta sesión */
  }
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
  return sub && pushId() ? 'on' : 'off';
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
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(rows.map(noticeFor), 'notices');
      tx.oncomplete = tx.onerror = () => {
        db.close();
        resolve();
      };
    };
  });
}

/** Actualiza la copia local y, si hay aviso activado y la previsión cambió, la sube. */
export async function syncForecast(rows: ForecastRow[]): Promise<void> {
  await saveNotices(rows);
  const id = pushId();
  if (!id) return;
  const key = forecastKey(rows);
  if (ls()?.getItem(LAST_KEY) === key) return;
  try {
    await call('/table', 'PUT', { id, rows });
    ls()?.setItem(LAST_KEY, key);
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
  ls()?.removeItem(LAST_KEY);
  await syncForecast(rows);
  return 'on';
}

export async function sendTestPush(): Promise<{ ok: boolean; status: number }> {
  const id = pushId();
  if (!id) return { ok: false, status: 0 };
  const res = await call('/test', 'POST', { id });
  if (res.status === 409) return { ok: false, status: 409 };
  return (await res.json()) as { ok: boolean; status: number };
}
