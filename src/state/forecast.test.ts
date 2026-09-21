import { describe, expect, it } from 'vitest';
import type { AppState, DayEntry, WeeklyContract } from '../types';
import { addDaysISO, buildForecast, forecastKey, noticeFor } from './forecast';
import { parseISODate, weekKey } from './date';

const MON = '2026-09-21';
const WK = weekKey(parseISODate(MON));

function contract(signedAt = MON): WeeklyContract {
  return {
    weekKey: WK,
    startDate: MON,
    signedAt,
    commitments: [
      { id: 'a', name: 'A', normal: 'n', minimum: 'm', reason: 'r' },
      { id: 'b', name: 'B', normal: 'n', minimum: 'm', reason: 'r' },
    ],
    createdAt: '2026-09-21T06:00:00.000Z',
  };
}

function day(date: string, a: 'normal' | 'minimum' | 'missed' | null, b: 'normal' | 'minimum' | 'missed' | null): DayEntry {
  return { date, weekKey: WK, marks: [{ commitmentId: 'a', status: a }, { commitmentId: 'b', status: b }] };
}

function state(days: DayEntry[]): AppState {
  return { profile: null, contracts: [contract()], days, reviews: [] };
}

describe('addDaysISO', () => {
  it('suma días cruzando mes', () => {
    expect(addDaysISO('2026-09-29', 3)).toBe('2026-10-02');
  });
});

describe('buildForecast', () => {
  it('hoy completo: mañana conserva la racha, pasado mañana cae a 0', () => {
    const rows = buildForecast(state([day(MON, 'normal', 'minimum')]), MON);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toEqual({ date: MON, streak: 1, pending: 0 });
    expect(rows[1]).toEqual({ date: '2026-09-22', streak: 1, pending: 2 });
    expect(rows[2]).toEqual({ date: '2026-09-23', streak: 0, pending: 2 });
  });

  it('hoy a medias: pendientes de hoy son los sin marcar y mañana la racha es 0', () => {
    const rows = buildForecast(state([day(MON, 'normal', null)]), MON);
    expect(rows[0]).toEqual({ date: MON, streak: 0, pending: 1 });
    expect(rows[1].streak).toBe(0);
  });

  it('semana sin contrato: pending null', () => {
    const rows = buildForecast(state([]), '2026-09-26');
    expect(rows[0].pending).toBe(2); // sábado
    expect(rows[1].pending).toBe(2); // domingo
    expect(rows[2]).toEqual({ date: '2026-09-28', streak: 0, pending: null });
  });
});

describe('forecastKey', () => {
  it('igual para filas iguales, distinta si cambia algo', () => {
    const a = buildForecast(state([]), MON);
    const b = buildForecast(state([]), MON);
    const c = buildForecast(state([day(MON, 'normal', null)]), MON);
    expect(forecastKey(a)).toBe(forecastKey(b));
    expect(forecastKey(a)).not.toBe(forecastKey(c));
  });
});

describe('noticeFor', () => {
  it('racha y pendientes, plural', () => {
    expect(noticeFor({ date: MON, streak: 12, pending: 3 })).toEqual({ date: MON, body: '🔥 12 días · 3 compromisos hoy', badge: 3 });
  });
  it('singular', () => {
    expect(noticeFor({ date: MON, streak: 1, pending: 1 }).body).toBe('🔥 1 día · 1 compromiso hoy');
  });
  it('todo hecho', () => {
    expect(noticeFor({ date: MON, streak: 4, pending: 0 })).toEqual({ date: MON, body: '🔥 4 días · todo hecho', badge: 0 });
  });
  it('sin contrato', () => {
    expect(noticeFor({ date: MON, streak: 0, pending: null })).toEqual({ date: MON, body: 'Toca firmar el contrato de la semana', badge: 0 });
  });
});
