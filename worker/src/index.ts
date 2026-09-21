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
