import type { AppState, Commitment, WeeklyContract } from '../types';
import { activeCommitments } from './contracts';
import { today } from './date';
import { evaluableDates, statusOn } from './stats';

export type FragileResult = { commitment: Commitment; fails: number; days: number };

/**
 * Compromiso más frágil de la semana del contrato: el que más veces falla
 * (missed o sin marcar) en proporción a sus días activos.
 *  · Hoy sin marcar no cuenta ni como día ni como fallo.
 *  · Null si la semana tiene menos de 3 días evaluables, o si ningún
 *    compromiso llega a fails/days >= 1/3.
 *  · Empate en proporción → gana el de más fallos; empate total → el
 *    primero en el orden del contrato.
 */
export function fragileCommitment(
  state: AppState,
  contract: WeeklyContract,
  todayISO: string = today()
): FragileResult | null {
  const evalDays = evaluableDates(contract, todayISO);
  if (evalDays.length < 3) return null;

  const tally = new Map<string, { fails: number; days: number }>();

  for (const day of evalDays) {
    for (const c of activeCommitments(contract, day)) {
      const status = statusOn(state, day, c.id);
      if (day === todayISO && status === null) continue; // hoy sin marcar no cuenta

      const entry = tally.get(c.id) ?? { fails: 0, days: 0 };
      entry.days++;
      if (status === 'missed' || status === null) entry.fails++;
      tally.set(c.id, entry);
    }
  }

  let best: FragileResult | null = null;
  for (const c of contract.commitments) {
    const entry = tally.get(c.id);
    if (!entry || entry.days === 0) continue;
    const ratio = entry.fails / entry.days;
    if (ratio < 1 / 3) continue;

    if (!best) {
      best = { commitment: c, fails: entry.fails, days: entry.days };
      continue;
    }
    const bestRatio = best.fails / best.days;
    if (ratio > bestRatio || (ratio === bestRatio && entry.fails > best.fails)) {
      best = { commitment: c, fails: entry.fails, days: entry.days };
    }
  }

  return best;
}
