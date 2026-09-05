import { describe, expect, it } from 'vitest';
import type { AppState, DayEntry, WeeklyContract } from '../types';
import { computeStreak, computeWeekStats, evaluableDates } from './stats';
import { toISODate } from './date';

function makeContract(signedAt: string, startDate = '2026-08-31'): WeeklyContract {
  return {
    weekKey: '2026-W36',
    startDate,
    signedAt,
    commitments: [
      { id: 'a', name: 'A', normal: 'n', minimum: 'm', reason: 'r' },
      { id: 'b', name: 'B', normal: 'n', minimum: 'm', reason: 'r' },
      { id: 'c', name: 'C', normal: 'n', minimum: 'm', reason: 'r' },
    ],
    createdAt: '2026-09-04T00:00:00.000Z',
  };
}

function makeState(days: DayEntry[]): AppState {
  return { profile: null, contracts: [], days, reviews: [] };
}

describe('date helpers · fechas locales', () => {
  it('toISODate usa componentes locales, no UTC', () => {
    const d = new Date(2026, 8, 4, 23, 59, 59); // 4 sept 2026 23:59 local
    expect(toISODate(d)).toBe('2026-09-04');
  });
});

describe('evaluableDates', () => {
  it('sólo incluye días entre signedAt y hoy dentro de la semana', () => {
    const c = makeContract('2026-09-02'); // firmado miércoles
    expect(evaluableDates(c, '2026-09-04')).toEqual([
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
    ]);
  });

  it('no incluye días futuros', () => {
    const c = makeContract('2026-08-31');
    expect(evaluableDates(c, '2026-09-01')).toEqual([
      '2026-08-31',
      '2026-09-01',
    ]);
  });
});

describe('computeWeekStats · escenario reportado', () => {
  it('1 normal + 1 mínimo + 1 fallado hoy → 67 % y 0/1 días cumplidos', () => {
    const c = makeContract('2026-09-04');
    const s = makeState([
      {
        date: '2026-09-04',
        weekKey: '2026-W36',
        marks: [
          { commitmentId: 'a', status: 'normal' },
          { commitmentId: 'b', status: 'minimum' },
          { commitmentId: 'c', status: 'missed' },
        ],
      },
    ]);
    const stats = computeWeekStats(s, c, '2026-09-04');
    expect(stats.evaluableDays).toEqual(['2026-09-04']);
    expect(stats.normalCount).toBe(1);
    expect(stats.minimumCount).toBe(1);
    expect(stats.missedCount).toBe(1);
    expect(stats.unmarkedCount).toBe(0);
    expect(stats.percent).toBeCloseTo(2 / 3, 5);
    expect(stats.daysHonored).toBe(0);
  });

  it('mínimo cuenta plenamente para el porcentaje', () => {
    const c = makeContract('2026-09-04');
    const s = makeState([
      {
        date: '2026-09-04',
        weekKey: '2026-W36',
        marks: [
          { commitmentId: 'a', status: 'minimum' },
          { commitmentId: 'b', status: 'minimum' },
          { commitmentId: 'c', status: 'minimum' },
        ],
      },
    ]);
    const stats = computeWeekStats(s, c, '2026-09-04');
    expect(stats.percent).toBe(1);
    expect(stats.daysHonored).toBe(1);
  });

  it('ignora registros anteriores a signedAt', () => {
    const c = makeContract('2026-09-04');
    const s = makeState([
      {
        date: '2026-09-01',
        weekKey: '2026-W36',
        marks: [
          { commitmentId: 'a', status: 'normal' },
          { commitmentId: 'b', status: 'normal' },
          { commitmentId: 'c', status: 'normal' },
        ],
      },
      {
        date: '2026-09-04',
        weekKey: '2026-W36',
        marks: [{ commitmentId: 'a', status: 'missed' }],
      },
    ]);
    const stats = computeWeekStats(s, c, '2026-09-04');
    expect(stats.evaluableDays).toEqual(['2026-09-04']);
    expect(stats.normalCount).toBe(0);
    expect(stats.missedCount).toBe(1);
    expect(stats.unmarkedCount).toBe(2);
  });

  it('resumen por compromiso solo cuenta días evaluables (sin 6 “sin marcar” extra)', () => {
    const c = makeContract('2026-09-04');
    const s = makeState([
      {
        date: '2026-09-04',
        weekKey: '2026-W36',
        marks: [
          { commitmentId: 'a', status: 'normal' },
          { commitmentId: 'b', status: 'minimum' },
          { commitmentId: 'c', status: 'missed' },
        ],
      },
    ]);
    const stats = computeWeekStats(s, c, '2026-09-04');
    for (const per of stats.perCommitment) {
      expect(per.normal + per.minimum + per.missed + per.unmarked).toBe(1);
    }
  });
});

describe('computeStreak', () => {
  it('un fallado hoy da racha 0', () => {
    const c = makeContract('2026-09-04');
    const s = makeState([
      {
        date: '2026-09-04',
        weekKey: '2026-W36',
        marks: [
          { commitmentId: 'a', status: 'normal' },
          { commitmentId: 'b', status: 'minimum' },
          { commitmentId: 'c', status: 'missed' },
        ],
      },
    ]);
    expect(computeStreak(s, c, '2026-09-04')).toBe(0);
  });

  it('tres días seguidos completos → 3', () => {
    const c = makeContract('2026-09-01');
    const full = ['a', 'b', 'c'].map((id) => ({ commitmentId: id, status: 'normal' as const }));
    const s = makeState([
      { date: '2026-09-01', weekKey: '2026-W36', marks: full },
      { date: '2026-09-02', weekKey: '2026-W36', marks: full },
      { date: '2026-09-03', weekKey: '2026-W36', marks: full },
    ]);
    expect(computeStreak(s, c, '2026-09-03')).toBe(3);
  });

  it('hoy sin marcar no rompe la racha previa', () => {
    const c = makeContract('2026-09-01');
    const full = ['a', 'b', 'c'].map((id) => ({ commitmentId: id, status: 'minimum' as const }));
    const s = makeState([
      { date: '2026-09-01', weekKey: '2026-W36', marks: full },
      { date: '2026-09-02', weekKey: '2026-W36', marks: full },
      // 2026-09-03 sin registro
    ]);
    expect(computeStreak(s, c, '2026-09-03')).toBe(2);
  });

  it('un día anterior sin completar rompe la racha', () => {
    const c = makeContract('2026-09-01');
    const full = ['a', 'b', 'c'].map((id) => ({ commitmentId: id, status: 'normal' as const }));
    const s = makeState([
      { date: '2026-09-01', weekKey: '2026-W36', marks: full },
      // 2026-09-02 en blanco
      { date: '2026-09-03', weekKey: '2026-W36', marks: full },
    ]);
    expect(computeStreak(s, c, '2026-09-03')).toBe(1);
  });

  it('no cuenta días anteriores a signedAt', () => {
    const c = makeContract('2026-09-03');
    const full = ['a', 'b', 'c'].map((id) => ({ commitmentId: id, status: 'normal' as const }));
    const s = makeState([
      { date: '2026-09-01', weekKey: '2026-W36', marks: full },
      { date: '2026-09-02', weekKey: '2026-W36', marks: full },
      { date: '2026-09-03', weekKey: '2026-W36', marks: full },
    ]);
    expect(computeStreak(s, c, '2026-09-03')).toBe(1);
  });
});
