import type { AppState } from '../types';
import { parseISODate, pad, toISODate, weekKey } from './date';
import { activeCommitments, contractForWeek } from './contracts';

export type MonthDay = {
  date: string;
  /** Día del mes (1..31). */
  day: number;
  /** Compromisos activos ese día según el contrato de su semana (0 = sin contrato o antes de firmar). */
  active: number;
  /** Compromisos en normal o mínimo. null en días futuros o sin compromisos activos. */
  done: number | null;
  isToday: boolean;
  isFuture: boolean;
  /** Hecho relevante del día, si se escribió. */
  fact?: string;
};

export type MonthSummary = {
  days: MonthDay[];
  /** Máximo de compromisos activos en algún día del mes (escala del eje Y). */
  maxActive: number;
  /** Días que entran en la media (pasados con compromisos, y hoy sólo si no queda nada por marcar). */
  countedDays: number;
  /** Media de compromisos cumplidos por día; null si no hay días que contar. */
  averageDone: number | null;
  /** Media de cumplimiento 0..1 (cumplidos / activos); null si no hay días que contar. */
  averageRatio: number | null;
  /** Mejor día: mayor proporción cumplida; a igualdad, más cumplidos; a igualdad, el más reciente. */
  best: MonthDay | null;
};

/** "2026-09" para una fecha dada. */
export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Desplaza un "AAAA-MM" `delta` meses. */
export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function datesInMonth(monthKey: string): string[] {
  const [y, m] = monthKey.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let i = 1; i <= last; i++) out.push(toISODate(new Date(y, m - 1, i)));
  return out;
}

/**
 * Serie mensual de compromisos cumplidos por día. Sólo lee el estado:
 * cada día se evalúa con el contrato de su semana, desde su firma.
 */
export function computeMonth(state: AppState, monthKey: string, todayISO: string): MonthSummary {
  const days: MonthDay[] = datesInMonth(monthKey).map((date) => {
    const contract = contractForWeek(state.contracts, weekKey(parseISODate(date)));
    const active = contract && date >= contract.signedAt ? activeCommitments(contract, date).length : 0;
    const isFuture = date > todayISO;
    const entry = state.days.find((d) => d.date === date);
    let done: number | null = null;
    if (!isFuture && active > 0 && contract) {
      done = activeCommitments(contract, date).filter((c) => {
        const s = entry?.marks.find((m) => m.commitmentId === c.id)?.status;
        return s === 'normal' || s === 'minimum';
      }).length;
    }
    const out: MonthDay = { date, day: parseISODate(date).getDate(), active, done, isToday: date === todayISO, isFuture };
    if (entry?.fact) out.fact = entry.fact;
    return out;
  });

  const maxActive = days.reduce((m, d) => Math.max(m, d.active), 0);

  // Hoy sólo cuenta en la media cuando ya no le queda nada por marcar,
  // para que la media no baje cada mañana.
  const pendingToday = (d: MonthDay): boolean => {
    if (!d.isToday) return false;
    const contract = contractForWeek(state.contracts, weekKey(parseISODate(d.date)));
    if (!contract) return false;
    const entry = state.days.find((e) => e.date === d.date);
    return activeCommitments(contract, d.date).some(
      (c) => (entry?.marks.find((m) => m.commitmentId === c.id)?.status ?? null) === null
    );
  };
  const counted = days.filter((d) => d.done !== null && !pendingToday(d));

  let best: MonthDay | null = null;
  for (const d of days) {
    if (d.done === null || d.done === 0) continue;
    if (
      !best ||
      d.done / d.active > best.done! / best.active ||
      (d.done / d.active === best.done! / best.active && d.done >= best.done!)
    ) {
      best = d;
    }
  }

  const sumDone = counted.reduce((s, d) => s + d.done!, 0);
  const sumRatio = counted.reduce((s, d) => s + d.done! / d.active, 0);

  return {
    days,
    maxActive,
    countedDays: counted.length,
    averageDone: counted.length ? sumDone / counted.length : null,
    averageRatio: counted.length ? sumRatio / counted.length : null,
    best,
  };
}
