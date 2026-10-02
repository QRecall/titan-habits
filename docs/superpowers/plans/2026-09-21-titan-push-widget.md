# TITAN · Aviso de las 8:00 y widget de racha · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aviso diario a las 08:00 (Madrid) con racha y pendientes, número del icono actualizado sin abrir la app, y un widget de Scriptable con la racha.

**Architecture:** La app calcula una previsión de 7 días (racha y pendientes por día). Guarda en IndexedDB los textos de aviso ya compuestos y sube solo los números a un Worker de Cloudflare (KV). El Worker manda cada mañana un push vacío firmado con VAPID; el service worker lee IndexedDB y muestra el aviso y el número. El widget lee `GET /today` del Worker.

**Tech Stack:** React 18 + Vite + Vitest (app), Cloudflare Workers + KV + Cron Triggers + WebCrypto (worker, sin dependencias), Scriptable (widget), `npx wrangler@4`.

**Spec:** `docs/superpowers/specs/2026-09-21-titan-push-widget-design.md`

## Global Constraints

- Hora del aviso: 08:00 Europe/Madrid, todos los días. Crons `0 6 * * *` y `0 7 * * *` UTC, filtrando por hora de Madrid = 8.
- Solo salen del móvil: `{date, streak, pending}` × 7 días y el `endpoint` de la suscripción. Nunca nombres, notas ni hechos.
- Push sin payload (sin cifrado). El texto lo compone la app y lo lee el service worker de IndexedDB (`titan-push`, versión 1, store `kv`, clave `notices`).
- Id de usuario: 16 bytes aleatorios en base64url (22 caracteres), en `localStorage` `titan.push.id`. No entra en la copia de seguridad.
- El repositorio es público: ni correo ni claves privadas en él. `VAPID_SUBJECT = https://qrecall.github.io/titan-habits/`. La clave privada solo como secreto de Cloudflare.
- Sin dependencias nuevas en `package.json`.
- Textos en español, mismo tono que el resto de "Mis datos".
- Commits: solo cuando el usuario lo diga (los pasos de commit se agrupan al final).

---

## Mapa de ficheros

| Fichero | Responsabilidad |
|---|---|
| `src/state/forecast.ts` (nuevo) | Previsión de 7 días, clave de comparación y texto del aviso por día |
| `src/state/pushId.ts` (nuevo) | base64url y generación del id |
| `src/state/widget.ts` (nuevo) | Texto del script de Scriptable |
| `src/push.ts` (nuevo) | APIs del navegador: suscripción, IndexedDB, subida, prueba |
| `public/sw.js` | Eventos `push` y `notificationclick`, versión v3 |
| `src/App.tsx` | Sincroniza la previsión en cada cambio de estado |
| `src/screens/MyData.tsx` | Panel "Aviso de las 8:00 y widget"; texto del recordatorio de calendario |
| `worker/src/logic.ts` (nuevo) | Validaciones, hora y fecha de Madrid, fila de hoy |
| `worker/src/vapid.ts` (nuevo) | JWT VAPID ES256 y envío del push |
| `worker/src/index.ts` (nuevo) | Rutas HTTP y cron |
| `worker/wrangler.toml` (nuevo) | Configuración del Worker |
| `worker/scripts/make-vapid.mjs` (nuevo) | Genera el par de claves VAPID |
| `vitest.config.ts` | Incluye las pruebas de `worker/` |

---

### Task 1: Previsión de 7 días y texto del aviso

**Files:**
- Create: `src/state/forecast.ts`
- Test: `src/state/forecast.test.ts`

**Interfaces:**
- Consumes: `computeStreakAcross(state, iso)`, `pendingToday(state, iso)` de `./stats`; `contractForWeek(contracts, key)` de `./contracts`; `parseISODate`, `toISODate`, `weekKey` de `./date`.
- Produces: `type ForecastRow = { date: string; streak: number; pending: number | null }`, `type DailyNotice = { date: string; body: string; badge: number }`, `FORECAST_DAYS = 7`, `addDaysISO(iso, n): string`, `buildForecast(state, fromISO, days?): ForecastRow[]`, `forecastKey(rows): string`, `noticeFor(row): DailyNotice`.

- [ ] **Step 1: Test que falla**

```ts
import { describe, expect, it } from 'vitest';
import type { AppState, DayEntry, WeeklyContract } from '../types';
import { addDaysISO, buildForecast, forecastKey, noticeFor } from './forecast';
import { parseISODate, weekKey } from './date';

const MON = '2026-09-21';
const WK = weekKey(parseISODate(MON));

function contract(signedAt = MON): WeeklyContract {
  return {
    weekKey: WK,
    startDate: MON,
    signedAt,
    commitments: [
      { id: 'a', name: 'A', normal: 'n', minimum: 'm', reason: 'r' },
      { id: 'b', name: 'B', normal: 'n', minimum: 'm', reason: 'r' },
    ],
    createdAt: '2026-09-21T06:00:00.000Z',
  };
}

function day(date: string, a: 'normal' | 'minimum' | 'missed' | null, b: 'normal' | 'minimum' | 'missed' | null): DayEntry {
  return { date, weekKey: WK, marks: [{ commitmentId: 'a', status: a }, { commitmentId: 'b', status: b }] };
}

function state(days: DayEntry[]): AppState {
  return { profile: null, contracts: [contract()], days, reviews: [] };
}

describe('addDaysISO', () => {
  it('suma días cruzando mes', () => {
    expect(addDaysISO('2026-09-29', 3)).toBe('2026-10-02');
  });
});

describe('buildForecast', () => {
  it('hoy completo: mañana conserva la racha, pasado mañana cae a 0', () => {
    const rows = buildForecast(state([day(MON, 'normal', 'minimum')]), MON);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toEqual({ date: MON, streak: 1, pending: 0 });
    expect(rows[1]).toEqual({ date: '2026-09-22', streak: 1, pending: 2 });
    expect(rows[2]).toEqual({ date: '2026-09-23', streak: 0, pending: 2 });
  });

  it('hoy a medias: pendientes de hoy son los sin marcar y mañana la racha es 0', () => {
    const rows = buildForecast(state([day(MON, 'normal', null)]), MON);
    expect(rows[0]).toEqual({ date: MON, streak: 0, pending: 1 });
    expect(rows[1].streak).toBe(0);
  });

  it('semana sin contrato: pending null', () => {
    const rows = buildForecast(state([]), '2026-09-26');
    expect(rows[0].pending).toBe(2); // sábado
    expect(rows[1].pending).toBe(2); // domingo
    expect(rows[2]).toEqual({ date: '2026-09-28', streak: 0, pending: null });
  });
});

describe('forecastKey', () => {
  it('igual para filas iguales, distinta si cambia algo', () => {
    const a = buildForecast(state([]), MON);
    const b = buildForecast(state([]), MON);
    const c = buildForecast(state([day(MON, 'normal', null)]), MON);
    expect(forecastKey(a)).toBe(forecastKey(b));
    expect(forecastKey(a)).not.toBe(forecastKey(c));
  });
});

describe('noticeFor', () => {
  it('racha y pendientes, plural', () => {
    expect(noticeFor({ date: MON, streak: 12, pending: 3 })).toEqual({ date: MON, body: '🔥 12 días · 3 compromisos hoy', badge: 3 });
  });
  it('singular', () => {
    expect(noticeFor({ date: MON, streak: 1, pending: 1 }).body).toBe('🔥 1 día · 1 compromiso hoy');
  });
  it('todo hecho', () => {
    expect(noticeFor({ date: MON, streak: 4, pending: 0 })).toEqual({ date: MON, body: '🔥 4 días · todo hecho', badge: 0 });
  });
  it('sin contrato', () => {
    expect(noticeFor({ date: MON, streak: 0, pending: null })).toEqual({ date: MON, body: 'Toca firmar el contrato de la semana', badge: 0 });
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla** — `npx vitest run src/state/forecast.test.ts` → FAIL (no existe `./forecast`).

- [ ] **Step 3: Implementación**

```ts
// Previsión de los próximos días para el aviso de la mañana y el widget.
import type { AppState } from '../types';
import { contractForWeek } from './contracts';
import { parseISODate, toISODate, weekKey } from './date';
import { computeStreakAcross, pendingToday } from './stats';

export type ForecastRow = {
  date: string;
  /** Racha que se verá la mañana de `date` si no se marca nada más. */
  streak: number;
  /** Compromisos sin marcar ese día; null si esa semana no tiene contrato. */
  pending: number | null;
};

/** Aviso ya compuesto para un día: lo lee el service worker al llegar el push. */
export type DailyNotice = { date: string; body: string; badge: number };

export const FORECAST_DAYS = 7;

export function addDaysISO(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function buildForecast(state: AppState, fromISO: string, days = FORECAST_DAYS): ForecastRow[] {
  const rows: ForecastRow[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysISO(fromISO, i);
    const contract = contractForWeek(state.contracts, weekKey(parseISODate(date)));
    rows.push({
      date,
      streak: computeStreakAcross(state, date),
      pending: contract ? pendingToday(state, date) : null,
    });
  }
  return rows;
}

/** Clave estable para no volver a subir una previsión que no ha cambiado. */
export function forecastKey(rows: ForecastRow[]): string {
  return JSON.stringify(rows);
}

export function noticeFor(row: ForecastRow): DailyNotice {
  if (row.pending === null) {
    return { date: row.date, body: 'Toca firmar el contrato de la semana', badge: 0 };
  }
  const racha = `🔥 ${row.streak} ${row.streak === 1 ? 'día' : 'días'}`;
  const resto =
    row.pending === 0
      ? 'todo hecho'
      : `${row.pending} ${row.pending === 1 ? 'compromiso' : 'compromisos'} hoy`;
  return { date: row.date, body: `${racha} · ${resto}`, badge: row.pending };
}
```

- [ ] **Step 4: Ejecutar** — `npx vitest run src/state/forecast.test.ts` → PASS.

---

### Task 2: Lógica pura del Worker

**Files:**
- Create: `worker/src/logic.ts`
- Test: `worker/src/logic.test.ts`
- Modify: `vitest.config.ts` (include)

**Interfaces:**
- Produces: `type Row = { date: string; streak: number; pending: number | null }`, `isValidId(v): v is string`, `isValidEndpoint(v): v is string`, `parseRows(v): Row[] | null`, `madridParts(now: Date): { date: string; hour: number }`, `rowFor(rows: Row[] | undefined, date: string): Row | null`.

- [ ] **Step 1: Incluir `worker/` en Vitest**

```ts
    include: ['src/**/*.test.ts', 'worker/src/**/*.test.ts'],
```

- [ ] **Step 2: Test que falla**

```ts
import { describe, expect, it } from 'vitest';
import { isValidEndpoint, isValidId, madridParts, parseRows, rowFor } from './logic';

describe('madridParts', () => {
  it('invierno (UTC+1): 07:00 UTC son las 8', () => {
    expect(madridParts(new Date('2026-01-15T07:00:00Z'))).toEqual({ date: '2026-01-15', hour: 8 });
  });
  it('verano (UTC+2): 06:00 UTC son las 8 y 07:00 UTC las 9', () => {
    expect(madridParts(new Date('2026-07-15T06:00:00Z')).hour).toBe(8);
    expect(madridParts(new Date('2026-07-15T07:00:00Z')).hour).toBe(9);
  });
  it('días de cambio de hora', () => {
    expect(madridParts(new Date('2026-03-29T06:00:00Z')).hour).toBe(8);
    expect(madridParts(new Date('2026-10-25T07:00:00Z')).hour).toBe(8);
  });
  it('fecha local, no UTC', () => {
    expect(madridParts(new Date('2026-01-15T23:30:00Z'))).toEqual({ date: '2026-01-16', hour: 0 });
  });
});

describe('isValidId', () => {
  it('22 caracteres base64url', () => {
    expect(isValidId('AbCdEfGhIjKlMnOpQrSt_-')).toBe(true);
    expect(isValidId('corto')).toBe(false);
    expect(isValidId('AbCdEfGhIjKlMnOpQrSt/+')).toBe(false);
    expect(isValidId(42)).toBe(false);
  });
});

describe('isValidEndpoint', () => {
  it('solo servicios push conocidos por https', () => {
    expect(isValidEndpoint('https://web.push.apple.com/QGx0')).toBe(true);
    expect(isValidEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isValidEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isValidEndpoint('https://evil.example.com/web.push.apple.com/')).toBe(false);
    expect(isValidEndpoint('http://web.push.apple.com/x')).toBe(false);
    expect(isValidEndpoint(null)).toBe(false);
  });
});

describe('parseRows', () => {
  const ok = [{ date: '2026-09-21', streak: 3, pending: 2 }, { date: '2026-09-22', streak: 0, pending: null }];
  it('acepta filas válidas', () => {
    expect(parseRows(ok)).toEqual(ok);
  });
  it('rechaza lo demás', () => {
    expect(parseRows([])).toBeNull();
    expect(parseRows('x')).toBeNull();
    expect(parseRows([{ date: '21/09/2026', streak: 1, pending: 1 }])).toBeNull();
    expect(parseRows([{ date: '2026-09-21', streak: -1, pending: 1 }])).toBeNull();
    expect(parseRows([{ date: '2026-09-21', streak: 1.5, pending: 1 }])).toBeNull();
    expect(parseRows(Array.from({ length: 15 }, () => ok[0]))).toBeNull();
  });
  it('descarta campos de más', () => {
    expect(parseRows([{ ...ok[0], name: 'secreto' }])).toEqual([ok[0]]);
  });
});

describe('rowFor', () => {
  it('encuentra la fila del día o null', () => {
    const rows = [{ date: '2026-09-21', streak: 3, pending: 2 }];
    expect(rowFor(rows, '2026-09-21')).toEqual(rows[0]);
    expect(rowFor(rows, '2026-09-22')).toBeNull();
    expect(rowFor(undefined, '2026-09-21')).toBeNull();
  });
});
```

- [ ] **Step 3: Ejecutar y ver que falla** — `npx vitest run worker/src/logic.test.ts` → FAIL.

- [ ] **Step 4: Implementación**

```ts
// Lógica pura del Worker de TITAN: validación, hora de Madrid y fila del día.

export type Row = { date: string; streak: number; pending: number | null };

const ID_RE = /^[A-Za-z0-9_-]{22}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PUSH_HOST_RE =
  /^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)\//;

export function isValidId(v: unknown): v is string {
  return typeof v === 'string' && ID_RE.test(v);
}

export function isValidEndpoint(v: unknown): v is string {
  return typeof v === 'string' && v.length < 1024 && PUSH_HOST_RE.test(v);
}

function isCount(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) < 10000;
}

export function parseRows(v: unknown): Row[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 14) return null;
  const out: Row[] = [];
  for (const r of v) {
    if (!r || typeof r !== 'object') return null;
    const { date, streak, pending } = r as Record<string, unknown>;
    if (typeof date !== 'string' || !DATE_RE.test(date) || !isCount(streak)) return null;
    if (pending !== null && !isCount(pending)) return null;
    out.push({ date, streak, pending: pending as number | null });
  }
  return out;
}

const MADRID = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

export function madridParts(now: Date): { date: string; hour: number } {
  const parts = MADRID.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

export function rowFor(rows: Row[] | undefined, date: string): Row | null {
  return rows?.find((r) => r.date === date) ?? null;
}
```

- [ ] **Step 5: Ejecutar** — `npx vitest run worker/src/logic.test.ts` → PASS.

---

### Task 3: Firma VAPID y Worker completo

**Files:**
- Create: `worker/src/vapid.ts`, `worker/src/index.ts`, `worker/wrangler.toml`, `worker/scripts/make-vapid.mjs`
- Test: `worker/src/vapid.test.ts`

**Interfaces:**
- Consumes: todo lo de `./logic`.
- Produces (HTTP): `POST /register {id, subscription:{endpoint}}` → `{ok:true}`; `PUT /table {id, rows}` → `{ok:true}`; `POST /test {id}` → `{ok, status}` o 409 `{error:'no-subscription'}`; `GET /today?id=` → `{date, found, streak, pending}`. Errores 400 `{error:'id'|'endpoint'|'rows'}`.
- Produces (TS): `b64url(bytes)`, `publicKeyFromJwk(jwk): string`, `vapidHeaders(endpoint, keys, now?)`, `sendPush(endpoint, keys): Promise<number>`, `type VapidKeys = { privateJwk: JsonWebKey; subject: string }`.

- [ ] **Step 1: Test que falla** (`worker/src/vapid.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { b64url, publicKeyFromJwk, vapidHeaders } from './vapid';

function fromB64url(s: string): Uint8Array {
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}

describe('vapidHeaders', () => {
  it('firma un JWT ES256 verificable con la clave pública del encabezado', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const now = Date.UTC(2026, 8, 21, 6, 0, 0);
    const h = await vapidHeaders('https://web.push.apple.com/QGx0abc', { privateJwk, subject: 'https://qrecall.github.io/titan-habits/' }, now);

    const m = /^vapid t=([^,]+), k=(.+)$/.exec(h.Authorization);
    expect(m).not.toBeNull();
    const [, jwt, k] = m!;
    expect(k).toBe(publicKeyFromJwk(privateJwk));
    expect(h.TTL).toBe('14400');

    const [head, claims, sig] = jwt.split('.');
    expect(JSON.parse(new TextDecoder().decode(fromB64url(head)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(JSON.parse(new TextDecoder().decode(fromB64url(claims)))).toEqual({
      aud: 'https://web.push.apple.com',
      exp: now / 1000 + 3600,
      sub: 'https://qrecall.github.io/titan-habits/',
    });

    const pub = await crypto.subtle.importKey('raw', fromB64url(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, fromB64url(sig), new TextEncoder().encode(`${head}.${claims}`));
    expect(ok).toBe(true);
  });
});

describe('b64url', () => {
  it('sin relleno ni + /', () => {
    expect(b64url(new Uint8Array([251, 255, 191]))).toBe('-_-_');
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla** — `npx vitest run worker/src/vapid.test.ts` → FAIL.

- [ ] **Step 3: `worker/src/vapid.ts`**

```ts
// Firma VAPID (RFC 8292) con WebCrypto y envío de un push sin contenido.

export type VapidKeys = { privateJwk: JsonWebKey; subject: string };

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}

/** Clave pública sin comprimir (0x04 ‖ x ‖ y) en base64url, a partir del JWK privado. */
export function publicKeyFromJwk(jwk: JsonWebKey): string {
  const out = new Uint8Array(65);
  out[0] = 4;
  out.set(fromB64url(jwk.x ?? ''), 1);
  out.set(fromB64url(jwk.y ?? ''), 33);
  return b64url(out);
}

const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

export async function vapidHeaders(endpoint: string, keys: VapidKeys, now = Date.now()): Promise<Record<string, string>> {
  const head = enc({ typ: 'JWT', alg: 'ES256' });
  const claims = enc({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 3600, sub: keys.subject });
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${claims}`));
  return {
    Authorization: `vapid t=${head}.${claims}.${b64url(sig)}, k=${publicKeyFromJwk(keys.privateJwk)}`,
    TTL: '14400',
    Urgency: 'normal',
  };
}

/** Envía un push vacío. Devuelve el código HTTP del servicio push. */
export async function sendPush(endpoint: string, keys: VapidKeys): Promise<number> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { ...(await vapidHeaders(endpoint, keys)), 'Content-Length': '0' },
  });
  return res.status;
}
```

- [ ] **Step 4: Ejecutar** — `npx vitest run worker/src/vapid.test.ts` → PASS.

- [ ] **Step 5: `worker/src/index.ts`**

```ts
// Worker de TITAN: guarda la suscripción push y la previsión de 7 días,
// manda el aviso de las 8:00 (Madrid) y sirve la fila de hoy al widget.
import { isValidEndpoint, isValidId, madridParts, parseRows, rowFor, type Row } from './logic';
import { sendPush, type VapidKeys } from './vapid';

interface KV {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
  list(opts: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}
interface Ctx { waitUntil(p: Promise<unknown>): void }
type Env = { TITAN: KV; ALLOWED_ORIGIN: string; VAPID_SUBJECT: string; VAPID_PRIVATE_JWK: string };
type UserRecord = { subscription?: { endpoint: string }; rows?: Row[]; updatedAt?: string };

function cors(env: Env, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
    ...extra,
  };
}

function json(env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors(env, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }),
  });
}

async function load(env: Env, id: string): Promise<UserRecord> {
  return ((await env.TITAN.get(`u:${id}`, 'json')) as UserRecord | null) ?? {};
}

async function save(env: Env, id: string, rec: UserRecord): Promise<void> {
  rec.updatedAt = new Date().toISOString();
  await env.TITAN.put(`u:${id}`, JSON.stringify(rec));
}

function vapid(env: Env): VapidKeys {
  return { privateJwk: JSON.parse(env.VAPID_PRIVATE_JWK) as JsonWebKey, subject: env.VAPID_SUBJECT };
}

/** Manda el push; si el servicio dice que la suscripción ya no existe, la borra. */
async function pushTo(env: Env, id: string, rec: UserRecord): Promise<number> {
  if (!rec.subscription) return 0;
  const status = await sendPush(rec.subscription.endpoint, vapid(env));
  if (status === 404 || status === 410) {
    delete rec.subscription;
    await save(env, id, rec);
  }
  return status;
}

async function pushAll(env: Env): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await env.TITAN.list({ prefix: 'u:', cursor });
    for (const k of page.keys) {
      const rec = (await env.TITAN.get(k.name, 'json')) as UserRecord | null;
      if (rec?.subscription) await pushTo(env, k.name.slice(2), rec).catch(() => 0);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

async function handle(req: Request, env: Env): Promise<Response> {
  const { pathname, searchParams } = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });

  if (req.method === 'GET' && pathname === '/today') {
    const id = searchParams.get('id');
    if (!isValidId(id)) return json(env, { error: 'id' }, 400);
    const rec = (await env.TITAN.get(`u:${id}`, 'json')) as UserRecord | null;
    const { date } = madridParts(new Date());
    const row = rowFor(rec?.rows, date);
    return json(env, { date, found: row !== null, streak: row?.streak ?? null, pending: row ? row.pending : null });
  }

  if (req.method !== 'POST' && req.method !== 'PUT') return json(env, { error: 'not-found' }, 404);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = body?.id;
  if (!isValidId(id)) return json(env, { error: 'id' }, 400);

  if (req.method === 'POST' && pathname === '/register') {
    const endpoint = (body?.subscription as { endpoint?: unknown } | undefined)?.endpoint;
    if (!isValidEndpoint(endpoint)) return json(env, { error: 'endpoint' }, 400);
    const rec = await load(env, id);
    rec.subscription = { endpoint };
    await save(env, id, rec);
    return json(env, { ok: true });
  }

  if (req.method === 'PUT' && pathname === '/table') {
    const rows = parseRows(body?.rows);
    if (!rows) return json(env, { error: 'rows' }, 400);
    const rec = await load(env, id);
    rec.rows = rows;
    await save(env, id, rec);
    return json(env, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/test') {
    const rec = await load(env, id);
    if (!rec.subscription) return json(env, { error: 'no-subscription' }, 409);
    const status = await pushTo(env, id, rec);
    return json(env, { ok: status >= 200 && status < 300, status });
  }

  return json(env, { error: 'not-found' }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await handle(req, env);
    } catch {
      return json(env, { error: 'server' }, 500);
    }
  },
  async scheduled(_event: unknown, env: Env, ctx: Ctx): Promise<void> {
    // Dos crons (06:00 y 07:00 UTC) cubren horario de verano e invierno.
    if (madridParts(new Date()).hour !== 8) return;
    ctx.waitUntil(pushAll(env));
  },
};
```

- [ ] **Step 6: `worker/wrangler.toml`** (el `id` del KV se rellena en la Task 4)

```toml
name = "titan-push"
main = "src/index.ts"
compatibility_date = "2026-09-01"
workers_dev = true

[vars]
ALLOWED_ORIGIN = "https://qrecall.github.io"
VAPID_SUBJECT = "https://qrecall.github.io/titan-habits/"

[[kv_namespaces]]
binding = "TITAN"
id = "RELLENAR_EN_TASK_4"

[triggers]
crons = ["0 6 * * *", "0 7 * * *"]
```

- [ ] **Step 7: `worker/scripts/make-vapid.mjs`**

```js
// Genera el par de claves VAPID. Escribe el JWK privado en el fichero indicado
// (para pasarlo a `wrangler secret put`) e imprime SOLO la clave pública.
import { writeFileSync } from 'node:fs';

const out = process.argv[2];
if (!out) throw new Error('Uso: node make-vapid.mjs <fichero-jwk-privado>');
const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', privateKey);
writeFileSync(out, JSON.stringify(jwk));
const b = (s) => Buffer.from(s, 'base64url');
console.log(Buffer.concat([Buffer.from([4]), b(jwk.x), b(jwk.y)]).toString('base64url'));
```

- [ ] **Step 8: Comprobar que el Worker compila** — `cd worker && npx wrangler@4 deploy --dry-run --outdir ../tmp/worker-build` → sin errores. Borrar `tmp/worker-build`.

---

### Task 4: Desplegar el Worker

Requiere al usuario: abrir el enlace de `wrangler login` y que exista el subdominio `workers.dev`.

- [ ] **Step 1:** `cd worker && npx wrangler@4 login` (en segundo plano; el usuario autoriza en el navegador). Verificar con `npx wrangler@4 whoami`.
- [ ] **Step 2:** Subdominio: `GET /accounts/{id}/workers/subdomain` (MCP de Cloudflare). Si no existe, pedir al usuario que abra Workers & Pages una vez.
- [ ] **Step 3:** `npx wrangler@4 kv namespace create TITAN` → copiar el `id` en `wrangler.toml`.
- [ ] **Step 4:** Claves: `node scripts/make-vapid.mjs "$SCRATCH/vapid.jwk"` → guardar la clave pública impresa. `npx wrangler@4 secret put VAPID_PRIVATE_JWK < "$SCRATCH/vapid.jwk"` y borrar el fichero. (Si `secret put` exige que el Worker exista, hacer primero el Step 5 y repetir.)
- [ ] **Step 5:** `npx wrangler@4 deploy` → anotar la URL `https://titan-push.<sub>.workers.dev`.
- [ ] **Step 6: Humo**
  - `curl -s "$URL/today?id=x"` → `{"error":"id"}` 400.
  - `curl -s "$URL/today?id=AAAAAAAAAAAAAAAAAAAAAA"` → `{"date":"…","found":false,"streak":null,"pending":null}`.
  - `curl -s -X PUT "$URL/table" -H 'Content-Type: application/json' -d '{"id":"AAAAAAAAAAAAAAAAAAAAAA","rows":[{"date":"<hoy Madrid>","streak":5,"pending":2}]}'` → `{"ok":true}`; `GET /today` de ese id → `found:true, streak:5, pending:2`.
  - `curl -si -X OPTIONS "$URL/table" -H 'Origin: https://qrecall.github.io'` → 204 con `Access-Control-Allow-Origin: https://qrecall.github.io`.

---

### Task 5: Id y script del widget (puros)

**Files:**
- Create: `src/state/pushId.ts`, `src/state/widget.ts`
- Test: `src/state/pushId.test.ts`, `src/state/widget.test.ts`

**Interfaces:**
- Produces: `base64url(bytes: Uint8Array): string`, `fromBase64url(s: string): Uint8Array`, `newPushId(): string` (22 caracteres), `widgetScript(workerUrl: string, id: string, appUrl: string): string`.

- [ ] **Step 1: Tests que fallan**

`src/state/pushId.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { base64url, fromBase64url, newPushId } from './pushId';

describe('pushId', () => {
  it('ida y vuelta base64url', () => {
    const b = new Uint8Array([0, 251, 255, 191, 7]);
    expect(Array.from(fromBase64url(base64url(b)))).toEqual(Array.from(b));
  });
  it('newPushId: 22 caracteres base64url y distintos', () => {
    const a = newPushId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newPushId()).not.toBe(a);
  });
});
```

`src/state/widget.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { widgetScript } from './widget';

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (code: string) => unknown;

describe('widgetScript', () => {
  const s = widgetScript('https://titan-push.x.workers.dev', 'AbCdEfGhIjKlMnOpQrSt_-', 'https://qrecall.github.io/titan-habits/');
  it('lleva la URL de datos con el id y la de la app', () => {
    expect(s).toContain('"https://titan-push.x.workers.dev/today?id=AbCdEfGhIjKlMnOpQrSt_-"');
    expect(s).toContain('"https://qrecall.github.io/titan-habits/"');
  });
  it('es JavaScript válido (con await de primer nivel)', () => {
    expect(() => new AsyncFunction(s)).not.toThrow();
  });
});
```

- [ ] **Step 2: Ejecutar y ver que fallan** — `npx vitest run src/state/pushId.test.ts src/state/widget.test.ts` → FAIL.

- [ ] **Step 3: `src/state/pushId.ts`**

```ts
// Identificador aleatorio del aviso y del widget (16 bytes → 22 caracteres base64url).

export function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64url(s: string): Uint8Array {
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}

export function newPushId(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(16)));
}
```

- [ ] **Step 4: `src/state/widget.ts`**

```ts
// Script de Scriptable para el widget de racha. Lee GET /today del Worker.

export function widgetScript(workerUrl: string, id: string, appUrl: string): string {
  const dataUrl = JSON.stringify(`${workerUrl}/today?id=${id}`);
  return `// TITAN · widget de racha para Scriptable
// Pega este script en Scriptable y añade un widget pequeño que lo use.
const DATA_URL = ${dataUrl};
const APP_URL = ${JSON.stringify(appUrl)};

let data = null;
try {
  const req = new Request(DATA_URL);
  req.timeoutInterval = 10;
  data = await req.loadJSON();
} catch (e) {}

const found = !!(data && data.found);
const streak = found ? data.streak : null;
const pending = found ? data.pending : null;

const w = new ListWidget();
w.backgroundColor = new Color("#0B0B0D");
w.url = APP_URL;
w.setPadding(14, 14, 14, 14);

const flame = w.addText("🔥");
flame.font = Font.systemFont(26);
flame.textOpacity = streak > 0 ? 1 : 0.35;

w.addSpacer(2);
const num = w.addText(streak === null ? "—" : String(streak));
num.font = Font.boldSystemFont(46);
num.minimumScaleFactor = 0.5;
num.textColor = streak > 0 ? new Color("#EFC66A") : new Color("#86847B");

const unit = w.addText(streak === 1 ? "día de racha" : "días de racha");
unit.font = Font.mediumSystemFont(12);
unit.textColor = new Color("#A9A69C");

w.addSpacer();
let line;
if (!data) line = "sin conexión";
else if (!found) line = "abre TITAN";
else if (pending === null) line = "firma el contrato";
else if (pending === 0) line = "todo hecho hoy";
else line = pending + (pending === 1 ? " pendiente hoy" : " pendientes hoy");
const foot = w.addText(line);
foot.font = Font.semiboldSystemFont(13);
foot.textColor = pending === 0 ? new Color("#7FA76A") : new Color("#F5F1E8");

w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w);
else await w.presentSmall();
Script.complete();
`;
}
```

- [ ] **Step 5: Ejecutar** — `npx vitest run src/state/pushId.test.ts src/state/widget.test.ts` → PASS.

---

### Task 6: Integración con el navegador (`src/push.ts`) y service worker

**Files:**
- Create: `src/push.ts`
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: `ForecastRow`, `forecastKey`, `noticeFor` (Task 1); `newPushId`, `fromBase64url` (Task 5); URL del Worker y clave pública (Task 4).
- Produces: `WORKER_URL`, `APP_URL`, `type PushStatus = 'unsupported' | 'off' | 'on' | 'denied'`, `pushId(): string | null`, `pushStatus(): Promise<PushStatus>`, `enablePush(rows): Promise<PushStatus>`, `syncForecast(rows): Promise<void>`, `sendTestPush(): Promise<{ ok: boolean; status: number }>`.

- [ ] **Step 1: `src/push.ts`** (sustituir las dos constantes por los valores de la Task 4)

```ts
/* Aviso de las 8:00 (Web Push) y datos del widget.
 * Solo salen del móvil la suscripción y, por día, la racha y los pendientes. */
import { forecastKey, noticeFor, type ForecastRow } from './state/forecast';
import { fromBase64url, newPushId } from './state/pushId';

export const WORKER_URL = 'https://titan-push.titan-habits.workers.dev';
const VAPID_PUBLIC_KEY = 'CLAVE_PUBLICA_DE_LA_TASK_4';
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
      applicationServerKey: fromBase64url(VAPID_PUBLIC_KEY),
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
```

- [ ] **Step 2: `public/sw.js`** — cambiar `VERSION` a `'titan-sw-v3'`, añadir al comentario inicial " · Aviso de las 8:00: al llegar un push (vacío) muestra el aviso del día guardado por la app en IndexedDB y pone el número del icono." y añadir al final:

```js
// ── Aviso de las 8:00 ─────────────────────────────────────────────
// El push llega vacío: el texto lo dejó preparado la app en IndexedDB.
function readNotices() {
  return new Promise((resolve) => {
    const open = indexedDB.open('titan-push', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      const db = open.result;
      const req = db.transaction('kv', 'readonly').objectStore('kv').get('notices');
      req.onsuccess = () => {
        db.close();
        resolve(req.result || null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
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
      if (n && self.navigator.setAppBadge) {
        try {
          if (n.badge > 0) await self.navigator.setAppBadge(n.badge);
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
```

- [ ] **Step 3:** `npm run build` → sin errores de TypeScript.

---

### Task 7: App.tsx y panel en "Mis datos"

**Files:**
- Modify: `src/App.tsx:10-23`, `src/screens/MyData.tsx` (imports, render tras `<InstallPanel />`, texto de `ReminderPanel`, componente `PushPanel` nuevo, CSS de lista si hace falta)

**Interfaces:**
- Consumes: `buildForecast` (Task 1), `widgetScript` (Task 5), `APP_URL`, `WORKER_URL`, `enablePush`, `pushId`, `pushStatus`, `sendTestPush`, `syncForecast`, `PushStatus` (Task 6), `today()` de `./state/date`.

- [ ] **Step 1: `src/App.tsx`**

```ts
import { buildForecast } from './state/forecast';
import { today } from './state/date';
import { syncForecast, } from './push';
…
  // Número en el icono y previsión para el aviso de las 8:00 y el widget.
  useEffect(() => {
    updateAppBadge(pendingToday(state));
    void syncForecast(buildForecast(state, today()));
  }, [state]);
```

- [ ] **Step 2: `PushPanel` en `src/screens/MyData.tsx`** (renderizar `<PushPanel />` justo después de `<InstallPanel />`)

```tsx
function PushPanel() {
  const { state } = useStore();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void pushStatus().then(setStatus);
  }, []);

  async function activate() {
    setBusy(true);
    setMsg(null);
    try {
      const next = await enablePush(buildForecast(state, today()));
      setStatus(next);
      setMsg(
        next === 'on'
          ? 'Aviso activado. Prueba el botón de aviso de prueba para comprobarlo.'
          : next === 'denied'
            ? 'Permiso denegado. Actívalo en Ajustes del iPhone, en la app TITAN.'
            : 'No se activó: hace falta aceptar el permiso de notificaciones.'
      );
    } catch (e) {
      setMsg(`No se pudo activar: ${(e as Error).message}. Comprueba la conexión y vuelve a intentarlo.`);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await sendTestPush();
      if (r.ok) setMsg('Aviso enviado. Debería llegarte en unos segundos.');
      else if (r.status === 409 || r.status === 404 || r.status === 410) {
        setStatus('off');
        setMsg('La suscripción ya no vale. Vuelve a activar el aviso.');
      } else setMsg(`El servicio de avisos respondió ${r.status}.`);
    } catch (e) {
      setMsg(`No se pudo enviar: ${(e as Error).message}.`);
    } finally {
      setBusy(false);
    }
  }

  async function copyWidget() {
    const id = pushId();
    if (!id) return;
    try {
      await navigator.clipboard.writeText(widgetScript(WORKER_URL, id, APP_URL));
      setMsg('Script copiado. Pégalo en un script nuevo de Scriptable.');
    } catch {
      setMsg('No se pudo copiar el script.');
    }
  }

  return (
    <div className="t-data__panel">
      <p className="eyebrow">Aviso de las 8:00 y widget</p>
      {status === 'unsupported' ? (
        <p className="t-data__hint">
          Para recibir el aviso, TITAN tiene que estar instalada en la pantalla de inicio y abierta
          desde su icono.
        </p>
      ) : status === 'denied' ? (
        <p className="t-data__hint">
          El permiso de notificaciones está denegado. Actívalo en Ajustes del iPhone, en la app
          TITAN, y vuelve aquí.
        </p>
      ) : status === 'on' ? (
        <>
          <p className="t-data__hint">
            Cada día a las 8:00 te llega un aviso con tu racha y los compromisos del día, y el
            número del icono se pone al día. Solo sale del móvil la racha y el número de
            pendientes de cada día.
          </p>
          <div className="t-data__actions">
            <Button full variant="ghost" onClick={() => void test()} disabled={busy}>
              Enviar aviso de prueba
            </Button>
            <Button full variant="ghost" onClick={() => void copyWidget()} disabled={busy}>
              Copiar script del widget
            </Button>
          </div>
          <ol className="t-data__steps">
            <li>Instala Scriptable desde la App Store.</li>
            <li>En Scriptable pulsa +, pega el script y llámalo «TITAN».</li>
            <li>
              En la pantalla de inicio mantén pulsado, pulsa +, elige Scriptable y el widget
              pequeño. Tócalo y en «Script» elige TITAN.
            </li>
          </ol>
        </>
      ) : status === 'off' ? (
        <>
          <p className="t-data__hint">
            Cada día a las 8:00 un aviso con tu racha y los compromisos del día, y el número del
            icono al día aunque no abras la app. Para eso sale del móvil solo la racha y el número
            de pendientes de cada día, nunca los nombres ni las notas.
          </p>
          <Button full variant="ghost" onClick={() => void activate()} disabled={busy}>
            Activar aviso de las 8:00
          </Button>
        </>
      ) : null}
      {msg && (
        <p className="t-data__hint" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
```

Imports a añadir en `MyData.tsx`:
```ts
import { buildForecast } from '../state/forecast';
import { today } from '../state/date';
import { widgetScript } from '../state/widget';
import { APP_URL, WORKER_URL, enablePush, pushId, pushStatus, sendTestPush, type PushStatus } from '../push';
```

- [ ] **Step 3: Texto del recordatorio de calendario** (`ReminderPanel`): sustituir
  "TITAN no puede avisarte con la app cerrada: no tiene servidor. Tu calendario sí puede. Elige una hora y descarga un recordatorio que se repite cada día; al abrirlo, el móvil te propondrá añadirlo."
  por
  "Si quieres otro recordatorio además del aviso de las 8:00, tu calendario puede dártelo. Elige una hora y descarga un recordatorio que se repite cada día; al abrirlo, el móvil te propondrá añadirlo."

- [ ] **Step 4:** `npm test && npm run build` → todo en verde.

---

### Task 8: Publicar y probar en el iPhone

- [ ] **Step 1:** Pedir permiso al usuario para commit y push. Con permiso: `git add` de los ficheros del mapa + spec + plan; commit "Aviso de las 8:00 con Web Push y widget de racha" con la línea Co-Authored-By; `git push origin main` → esperar a que termine el workflow de Pages (`gh run watch` si está `gh`; si no, comprobar la web).
- [ ] **Step 2:** Guiar al usuario: abrir TITAN desde el icono (dos veces, para que cargue el SW v3) → Mis datos → Activar aviso → Enviar aviso de prueba → debe llegar "TITAN · 🔥 N días · …" y cambiar el número del icono.
- [ ] **Step 3:** `curl "$WORKER_URL/today?id=<id del usuario si lo comparte>"` o comprobar en KV (MCP) que existe `u:<id>` con `rows` y `subscription`.
- [ ] **Step 4:** Widget: copiar script, pegar en Scriptable, añadir widget; comprobar que muestra la racha.
- [ ] **Step 5:** Al día siguiente a las 8:00: confirmar aviso. Si iOS no muestra avisos de push vacíos, pasar a push con payload cifrado (RFC 8291) como plan B.
- [ ] **Step 6:** Actualizar la memoria `titan-pending-issues` con el estado.
