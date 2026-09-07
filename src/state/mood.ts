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

export function moodFor(s: TodayStatus): Mood {
  if (s.total === 0) return 'espera';
  if (s.missed > 0) return 'reconducir';
  const done = s.normal + s.minimum;
  if (done === 0) return 'espera';
  if (done < s.total) return 'enmarcha';
  return s.minimum > 0 ? 'vivo' : 'firme';
}
