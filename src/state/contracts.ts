import type { Commitment, WeeklyContract } from '../types';
import { parseISODate, startOfISOWeek, toISODate, weekKey } from './date';

/** Copia ordenada por fecha de inicio (la última es la más reciente). */
export function sortContracts(contracts: WeeklyContract[]): WeeklyContract[] {
  return [...contracts].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
}

export function contractForWeek(contracts: WeeklyContract[], key: string): WeeklyContract | null {
  return contracts.find((c) => c.weekKey === key) ?? null;
}

/** Contrato más reciente cuya semana es anterior a `key`. */
export function latestContractBefore(contracts: WeeklyContract[], key: string): WeeklyContract | null {
  const target = contracts.find((c) => c.weekKey === key);
  const limit = target ? target.startDate : startOfWeekKey(key);
  const earlier = sortContracts(contracts).filter((c) => c.startDate < limit);
  return earlier.length > 0 ? earlier[earlier.length - 1] : null;
}

// "2026-W37" → lunes ISO de esa semana, como YYYY-MM-DD.
function startOfWeekKey(key: string): string {
  const [y, w] = key.split('-W').map(Number);
  // El 4 de enero siempre cae en la semana 1.
  const jan4 = new Date(y, 0, 4);
  const monday = startOfISOWeek(jan4);
  monday.setDate(monday.getDate() + (w - 1) * 7);
  return toISODate(monday);
}

/** Lunes de la semana siguiente a la fecha dada. */
export function nextWeekStart(d: Date): string {
  const monday = startOfISOWeek(d);
  monday.setDate(monday.getDate() + 7);
  return toISODate(monday);
}

/**
 * Contrato para la semana que empieza en `weekStart` (lunes).
 *  · Si esa semana ya ha empezado, la evaluación arranca hoy (signedAt = hoy).
 *  · Si es una semana futura, arranca el lunes.
 */
export function newContractForWeekStarting(
  commitments: Commitment[],
  weekStart: string,
  now: Date = new Date()
): WeeklyContract {
  const todayISO = toISODate(now);
  return {
    weekKey: weekKey(parseISODate(weekStart)),
    startDate: weekStart,
    signedAt: todayISO > weekStart ? todayISO : weekStart,
    commitments,
    createdAt: now.toISOString(),
  };
}
