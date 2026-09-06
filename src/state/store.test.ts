import { describe, expect, it } from 'vitest';
import type { AppState, DayEntry, WeeklyContract } from '../types';
import { reducer } from './store';
import { computeStreak, computeWeekStats } from './stats';

const A = { id: 'a', name: 'Escribir', normal: '30 min', minimum: '3 frases', reason: 'r' };
const B = { id: 'b', name: 'Moverme', normal: '45 min', minimum: '10 flexiones', reason: 'r' };

const original: WeeklyContract = {
  weekKey: '2026-W36',
  startDate: '2026-08-31',
  signedAt: '2026-08-31',
  createdAt: '2026-08-31T07:00:00.000Z',
  commitments: [A, B],
};

const days: DayEntry[] = [
  {
    date: '2026-08-31',
    weekKey: '2026-W36',
    marks: [
      { commitmentId: 'a', status: 'normal', note: 'Escribí al amanecer' },
      { commitmentId: 'b', status: 'normal' },
    ],
  },
  {
    date: '2026-09-01',
    weekKey: '2026-W36',
    marks: [
      { commitmentId: 'a', status: 'normal' },
      { commitmentId: 'b', status: 'minimum', note: 'Día duro, paseo corto' },
    ],
  },
  {
    date: '2026-09-02',
    weekKey: '2026-W36',
    marks: [
      { commitmentId: 'a', status: 'minimum' },
      { commitmentId: 'b', status: 'normal' },
    ],
  },
];

function baseState(): AppState {
  return {
    profile: { name: 'Nacho', identity: 'alguien constante', onboardedAt: '2026-08-31T07:00:00.000Z' },
    contracts: [original],
    days,
    reviews: [],
  };
}

const TODAY = '2026-09-03';

describe('SAVE_CONTRACT · editar el contrato de la misma semana', () => {
  it('días después conserva fechas, marcas, notas y progreso', () => {
    const state = baseState();
    const statsBefore = computeWeekStats(state, original, TODAY);
    const streakBefore = computeStreak(state, original, TODAY);
    expect(statsBefore.daysHonored).toBe(3);
    expect(streakBefore).toBe(3);

    // El formulario construye siempre el contrato con signedAt/createdAt de hoy.
    const edited: WeeklyContract = {
      ...original,
      signedAt: TODAY,
      createdAt: '2026-09-03T18:00:00.000Z',
      commitments: [{ ...A, normal: '45 min sin distracciones' }, B],
    };

    const next = reducer(state, { type: 'SAVE_CONTRACT', contract: edited });

    expect(next.contracts).toHaveLength(1);
    const saved = next.contracts[0];
    expect(saved.weekKey).toBe('2026-W36');
    expect(saved.startDate).toBe('2026-08-31');
    expect(saved.signedAt).toBe('2026-08-31');
    expect(saved.createdAt).toBe('2026-08-31T07:00:00.000Z');
    expect(saved.commitments.map((c) => c.id)).toEqual(['a', 'b']);
    expect(saved.commitments[0].normal).toBe('45 min sin distracciones');

    // Registros diarios intactos, incluidas las notas.
    expect(next.days).toEqual(days);
    expect(next.days[0].marks[0].note).toBe('Escribí al amanecer');
    expect(next.days[1].marks[1].note).toBe('Día duro, paseo corto');

    // El progreso es exactamente el mismo que antes de editar.
    expect(computeWeekStats(next, saved, TODAY)).toEqual(statsBefore);
    expect(computeStreak(next, saved, TODAY)).toBe(streakBefore);
  });

  it('guardar sin cambios conserva el estado relevante', () => {
    const state = baseState();
    const unchanged: WeeklyContract = {
      ...original,
      signedAt: TODAY,
      createdAt: '2026-09-03T18:00:00.000Z',
      commitments: [{ ...A }, { ...B }],
    };

    const next = reducer(state, { type: 'SAVE_CONTRACT', contract: unchanged });

    expect(next.contracts).toEqual([original]);
    expect(next.days).toEqual(days);
    expect(next.reviews).toEqual([]);
    expect(next.profile).toEqual(state.profile);
  });

  it('mínimo y normal siguen contando como cumplimiento completo tras editar', () => {
    const state = baseState();
    const edited: WeeklyContract = { ...original, signedAt: TODAY, createdAt: 'x' };
    const next = reducer(state, { type: 'SAVE_CONTRACT', contract: edited });
    const stats = computeWeekStats(next, next.contracts[0], TODAY);
    // 3 días × 2 compromisos, todos normal o mínimo, hoy sin marcar (4º día).
    expect(stats.evaluableDays).toHaveLength(4);
    expect(stats.normalCount + stats.minimumCount).toBe(6);
    expect(stats.daysHonored).toBe(3);
  });
});

describe('SAVE_CONTRACT · crear contrato de otra semana', () => {
  it('conserva el contrato y los registros anteriores', () => {
    const state = baseState();
    const nextWeek: WeeklyContract = {
      weekKey: '2026-W37',
      startDate: '2026-09-07',
      signedAt: '2026-09-07',
      createdAt: '2026-09-07T07:00:00.000Z',
      commitments: [{ ...A, id: 'a2' }],
    };

    const next = reducer(state, { type: 'SAVE_CONTRACT', contract: nextWeek });

    expect(next.contracts).toHaveLength(2);
    expect(next.contracts[0]).toEqual(original);
    expect(next.contracts[1]).toEqual(nextWeek);
    expect(next.days).toEqual(days);
    // El contrato activo (último) es el de la semana nueva, con sus propias fechas.
    expect(next.contracts[next.contracts.length - 1].signedAt).toBe('2026-09-07');
  });
});

describe('RESTORE · sustituye todo el estado por la copia', () => {
  it('reemplaza perfil, contratos, registros y revisiones', () => {
    const state = baseState();
    const restored: AppState = {
      profile: { name: 'Otro', identity: 'otra identidad', onboardedAt: '2026-07-01T07:00:00.000Z' },
      contracts: [{ ...original, weekKey: '2026-W30', startDate: '2026-07-20', signedAt: '2026-07-20' }],
      days: [{ date: '2026-07-20', weekKey: '2026-W30', marks: [{ commitmentId: 'a', status: 'minimum' }] }],
      reviews: [{ weekKey: '2026-W30', worked: 'w', hindered: 'h', changeNext: 'c', createdAt: 'x' }],
    };
    const next = reducer(state, { type: 'RESTORE', state: restored });
    expect(next).toEqual(restored);
    expect(next.contracts).toHaveLength(1);
    expect(next.days).toHaveLength(1);
  });
});
