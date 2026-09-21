import { describe, expect, it } from 'vitest';
import type { AppState, CommitmentStatus, DayEntry, WeeklyContract } from '../types';
import { computeMonth, datesInMonth, shiftMonth } from './month';

function contract(weekKey: string, startDate: string, signedAt: string, ids: string[]): WeeklyContract {
  return {
    weekKey,
    startDate,
    signedAt,
    commitments: ids.map((id) => ({ id, name: id, normal: 'n', minimum: 'm', reason: 'r' })),
    createdAt: `${signedAt}T08:00:00.000Z`,
  };
}

function day(date: string, weekKey: string, marks: Record<string, CommitmentStatus>): DayEntry {
  return {
    date,
    weekKey,
    marks: Object.entries(marks).map(([commitmentId, status]) => ({ commitmentId, status })),
  };
}

function state(contracts: WeeklyContract[], days: DayEntry[]): AppState {
  return { profile: null, contracts, days, reviews: [] };
}

describe('utilidades de mes', () => {
  it('cuenta los días de cada mes, bisiestos incluidos', () => {
    expect(datesInMonth('2026-09')).toHaveLength(30);
    expect(datesInMonth('2028-02')).toHaveLength(29);
    expect(datesInMonth('2026-09')[0]).toBe('2026-09-01');
  });

  it('cambia de año al desplazar', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('computeMonth · mes vacío', () => {
  it('sin contratos: ningún punto, sin media ni mejor día', () => {
    const m = computeMonth(state([], []), '2026-08', '2026-09-21');
    expect(m.days).toHaveLength(31);
    expect(m.days.every((d) => d.done === null && d.active === 0)).toBe(true);
    expect(m.maxActive).toBe(0);
    expect(m.averageDone).toBeNull();
    expect(m.best).toBeNull();
  });
});

describe('computeMonth · mes a medias', () => {
  // Contrato desde el lunes 14 (W38) y el lunes 21 (W39) con dos compromisos.
  const s = state(
    [
      contract('2026-W38', '2026-09-14', '2026-09-14', ['a', 'b']),
      contract('2026-W39', '2026-09-21', '2026-09-21', ['a', 'b']),
    ],
    [
      day('2026-09-14', '2026-W38', { a: 'normal', b: 'normal' }),
      day('2026-09-15', '2026-W38', { a: 'minimum', b: 'missed' }),
      day('2026-09-16', '2026-W38', { a: 'missed' }),
      day('2026-09-21', '2026-W39', { a: 'normal' }),
    ]
  );
  const m = computeMonth(s, '2026-09', '2026-09-21');

  it('días sin contrato y días futuros no tienen punto', () => {
    expect(m.days[0].done).toBeNull(); // 1 sep, sin contrato
    expect(m.days[21].isFuture).toBe(true); // 22 sep
    expect(m.days[21].done).toBeNull();
  });

  it('cuenta normal y mínimo como cumplidos; missed y sin marcar no', () => {
    expect(m.days[13].done).toBe(2); // 14
    expect(m.days[14].done).toBe(1); // 15
    expect(m.days[15].done).toBe(0); // 16
    expect(m.days[16].done).toBe(0); // 17, sin marcar
  });

  it('hoy con algo por marcar tiene punto pero no entra en la media', () => {
    const hoy = m.days[20];
    expect(hoy.isToday).toBe(true);
    expect(hoy.done).toBe(1);
    expect(m.countedDays).toBe(7); // 14..20
    expect(m.averageDone).toBeCloseTo(3 / 7);
    expect(m.averageRatio).toBeCloseTo(1.5 / 7);
  });

  it('el mejor día es el de mayor proporción', () => {
    expect(m.best?.date).toBe('2026-09-14');
  });

  it('hoy completo sí entra en la media', () => {
    const full = state(s.contracts, [...s.days.slice(0, 3), day('2026-09-21', '2026-W39', { a: 'normal', b: 'minimum' })]);
    const m2 = computeMonth(full, '2026-09', '2026-09-21');
    expect(m2.countedDays).toBe(8);
    expect(m2.best?.date).toBe('2026-09-21'); // empate 2/2 → el más reciente
  });
});

describe('computeMonth · hábitos añadidos a mitad de mes', () => {
  // W37 firmado el miércoles 9 con un compromiso; W38 con tres.
  const s = state(
    [
      contract('2026-W37', '2026-09-07', '2026-09-09', ['a']),
      contract('2026-W38', '2026-09-14', '2026-09-14', ['a', 'b', 'c']),
    ],
    [
      day('2026-09-09', '2026-W37', { a: 'normal' }),
      day('2026-09-14', '2026-W38', { a: 'normal', b: 'minimum' }),
    ]
  );
  const m = computeMonth(s, '2026-09', '2026-09-30');

  it('los activos siguen al contrato de cada semana y a su firma', () => {
    expect(m.days[7].active).toBe(0); // 8, antes de la firma
    expect(m.days[8].active).toBe(1); // 9
    expect(m.days[13].active).toBe(3); // 14
    expect(m.days[20].active).toBe(0); // 21, sin contrato W39
    expect(m.maxActive).toBe(3);
  });

  it('1/1 gana a 2/3 como mejor día', () => {
    expect(m.best?.date).toBe('2026-09-09');
  });
});
