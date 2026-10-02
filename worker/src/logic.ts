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
