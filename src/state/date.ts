// Utilidades de fecha basadas en ISO 8601 (semana empieza en lunes).

export function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return toISODate(new Date());
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Devuelve el lunes (00:00) de la semana ISO que contiene la fecha dada.
export function startOfISOWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0 = domingo
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  return date;
}

// Devuelve el año y número de semana ISO 8601 correspondientes.
export function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

export function weekKey(d: Date): string {
  const { year, week } = isoWeek(d);
  return `${year}-W${pad(week)}`;
}

export function currentWeekKey(): string {
  return weekKey(new Date());
}

export function daysInWeek(startDate: string): string[] {
  const start = parseISODate(startDate);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    out.push(toISODate(d));
  }
  return out;
}

const DAY_LABELS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DAY_LABELS_FULL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export function shortDayLabel(iso: string): string {
  return DAY_LABELS[parseISODate(iso).getDay()];
}
export function fullDayLabel(iso: string): string {
  return DAY_LABELS_FULL[parseISODate(iso).getDay()];
}
export function longDate(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

// "lun 2 sep — dom 8 sep"
export function weekRangeLabel(startDate: string): string {
  const days = daysInWeek(startDate);
  const a = parseISODate(days[0]);
  const b = parseISODate(days[6]);
  const fa = `${a.getDate()} ${MONTHS[a.getMonth()].slice(0,3)}`;
  const fb = `${b.getDate()} ${MONTHS[b.getMonth()].slice(0,3)}`;
  return `${fa} — ${fb}`;
}

export function saludoHora(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Aún es de noche';
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}
