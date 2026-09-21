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
