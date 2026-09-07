import type { AppState } from '../types';
import { parseISODate, today, weekKey } from './date';
import { contractForWeek } from './contracts';

export type TodayStatus = {
  total: number;
  normal: number;
  minimum: number;
  missed: number;
  pending: number;
};

/**
 * Estado de ánimo de la mascota:
 *  · espera      → nada marcado todavía (o sin contrato)
 *  · enmarcha    → algo hecho, nada fallado, aún sin terminar
 *  · firme       → todo en versión normal
 *  · vivo        → todo hecho, con algún mínimo
 *  · reconducir  → algún "hoy no"
 */
export type Mood = 'espera' | 'enmarcha' | 'firme' | 'vivo' | 'reconducir';

export function todayStatus(state: AppState, todayISO: string = today()): TodayStatus {
  const contract = contractForWeek(state.contracts, weekKey(parseISODate(todayISO)));
  if (!contract) return { total: 0, normal: 0, minimum: 0, missed: 0, pending: 0 };
  const day = state.days.find((d) => d.date === todayISO);
  let normal = 0;
  let minimum = 0;
  let missed = 0;
  for (const c of contract.commitments) {
    const s = day?.marks.find((m) => m.commitmentId === c.id)?.status ?? null;
    if (s === 'normal') normal++;
    else if (s === 'minimum') minimum++;
    else if (s === 'missed') missed++;
  }
  const total = contract.commitments.length;
  return { total, normal, minimum, missed, pending: total - normal - minimum - missed };
}

/**
 * Calor de la llama: proporción de lo hecho hoy (0..1), normal y mínimo
 * por igual. El color se interpola de forma continua, como un fuego que
 * se calienta: amarillo → naranja → rojo → azul.
 */
export function heatRatio(s: TodayStatus): number {
  if (s.total === 0) return 0;
  return Math.max(0, Math.min(1, (s.normal + s.minimum) / s.total));
}

export type Heat = 'amarillo' | 'naranja' | 'rojo' | 'azul';

/** Nombre del color para etiquetas accesibles. */
export function heatFor(ratio: number): Heat {
  if (ratio <= 0) return 'amarillo';
  if (ratio >= 1) return 'azul';
  return ratio < 0.5 ? 'naranja' : 'rojo';
}

/** Tamaño de la llama: 0 brasa · 1 pequeña · 2 media · 3 grande · 4 enorme. */
export type FlameLevel = 0 | 1 | 2 | 3 | 4;

export function flameLevel(streak: number): FlameLevel {
  if (streak <= 0) return 0;
  if (streak < 3) return 1;
  if (streak < 7) return 2;
  if (streak < 14) return 3;
  return 4;
}

export function moodFor(s: TodayStatus): Mood {
  if (s.total === 0) return 'espera';
  if (s.missed > 0) return 'reconducir';
  const done = s.normal + s.minimum;
  if (done === 0) return 'espera';
  if (done < s.total) return 'enmarcha';
  return s.minimum > 0 ? 'vivo' : 'firme';
}
