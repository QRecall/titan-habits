import type { AppState, CommitmentStatus, WeeklyContract } from '../types';
import { daysInWeek, parseISODate, toISODate, today } from './date';

export type CommitmentSummary = {
  commitmentId: string;
  normal: number;
  minimum: number;
  missed: number;
  unmarked: number;
};

export type WeekStats = {
  /** Días entre signedAt y hoy, inclusive, limitados a la semana del contrato. */
  evaluableDays: string[];
  totalCommitments: number;
  daysHonored: number;
  normalCount: number;
  minimumCount: number;
  missedCount: number;
  unmarkedCount: number;
  /** 0..1 · (normal + minimum) / (evaluableDays × compromisos). */
  percent: number;
  perCommitment: CommitmentSummary[];
};

/** Selecciona los días de la semana del contrato entre signedAt y todayISO. */
export function evaluableDates(
  contract: WeeklyContract,
  todayISO: string = today()
): string[] {
  return daysInWeek(contract.startDate).filter(
    (d) => d >= contract.signedAt && d <= todayISO
  );
}

function statusOn(
  state: AppState,
  date: string,
  commitmentId: string
): CommitmentStatus {
  const day = state.days.find((d) => d.date === date);
  if (!day) return null;
  return day.marks.find((m) => m.commitmentId === commitmentId)?.status ?? null;
}

/**
 * Estadísticas semanales:
 *  · normal = minimum = 1
 *  · missed = unmarked = 0
 *  · un día cuenta como cumplido sólo si TODOS los compromisos ≥ mínimo.
 */
export function computeWeekStats(
  state: AppState,
  contract: WeeklyContract,
  todayISO: string = today()
): WeekStats {
  const days = evaluableDates(contract, todayISO);
  const total = contract.commitments.length;

  const per: Record<string, CommitmentSummary> = {};
  for (const c of contract.commitments) {
    per[c.id] = { commitmentId: c.id, normal: 0, minimum: 0, missed: 0, unmarked: 0 };
  }

  let daysHonored = 0;
  let normalCount = 0;
  let minimumCount = 0;
  let missedCount = 0;
  let unmarkedCount = 0;

  for (const iso of days) {
    let allOk = total > 0;
    for (const c of contract.commitments) {
      const s = statusOn(state, iso, c.id);
      const bucket = per[c.id];
      if (s === 'normal') {
        bucket.normal++;
        normalCount++;
      } else if (s === 'minimum') {
        bucket.minimum++;
        minimumCount++;
      } else if (s === 'missed') {
        bucket.missed++;
        missedCount++;
        allOk = false;
      } else {
        bucket.unmarked++;
        unmarkedCount++;
        allOk = false;
      }
    }
    if (allOk) daysHonored++;
  }

  const denom = days.length * total;
  const percent = denom === 0 ? 0 : (normalCount + minimumCount) / denom;

  return {
    evaluableDays: days,
    totalCommitments: total,
    daysHonored,
    normalCount,
    minimumCount,
    missedCount,
    unmarkedCount,
    percent,
    perCommitment: contract.commitments.map((c) => per[c.id]),
  };
}

/**
 * Racha de días consecutivos completos:
 *  · Un día es completo si TODOS los compromisos están en normal o minimum.
 *  · Un día con `missed` rompe la racha.
 *  · El día en curso, si aún no está completo pero no tiene `missed`,
 *    no rompe la racha (se salta y sigue contando hacia atrás).
 *  · Nunca se cuentan días anteriores a signedAt ni futuros.
 */
export function computeStreak(
  state: AppState,
  contract: WeeklyContract,
  todayISO: string = today()
): number {
  if (contract.commitments.length === 0) return 0;
  if (todayISO < contract.signedAt) return 0;

  let cursor = todayISO;
  let streak = 0;
  let isFirst = true;

  while (cursor >= contract.signedAt) {
    let allDone = true;
    let anyFailed = false;
    for (const c of contract.commitments) {
      const s = statusOn(state, cursor, c.id);
      if (s === 'missed') {
        anyFailed = true;
        allDone = false;
      } else if (s !== 'normal' && s !== 'minimum') {
        allDone = false;
      }
    }

    if (anyFailed) break;
    if (allDone) {
      streak++;
    } else if (!isFirst) {
      // Un día pasado sin completar rompe la racha.
      break;
    }
    // Si es hoy y no está completo pero tampoco tiene missed → saltar.

    cursor = previousISODate(cursor);
    isFirst = false;
  }

  return streak;
}

function previousISODate(iso: string): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}
