import { describe, expect, it } from 'vitest';
import type { AppState, WeeklyContract } from '../types';
import { moodFor, todayStatus } from './mood';

const A = { id: 'a', name: 'A', normal: 'n', minimum: 'm', reason: '' };
const B = { id: 'b', name: 'B', normal: 'n', minimum: 'm', reason: '' };
const w36: WeeklyContract = { weekKey: '2026-W36', startDate: '2026-08-31', signedAt: '2026-08-31', createdAt: 'x', commitments: [A, B] };

function state(marks: { commitmentId: string; status: 'normal' | 'minimum' | 'missed' | null }[]): AppState {
  return { profile: null, contracts: [w36], days: [{ date: '2026-09-02', weekKey: '2026-W36', marks }], reviews: [] };
}

describe('todayStatus', () => {
  it('resume las marcas de hoy sobre el contrato de la semana', () => {
    expect(todayStatus(state([{ commitmentId: 'a', status: 'normal' }]), '2026-09-02')).toEqual({
      total: 2, normal: 1, minimum: 0, missed: 0, pending: 1,
    });
  });
  it('sin contrato → todo a cero', () => {
    expect(todayStatus(state([]), '2026-09-09').total).toBe(0);
  });
});

describe('moodFor', () => {
  const s = (normal: number, minimum: number, missed: number, total = 2) => ({
    total, normal, minimum, missed, pending: total - normal - minimum - missed,
  });
  it('sin contrato → espera', () => expect(moodFor(s(0, 0, 0, 0))).toBe('espera'));
  it('nada marcado → espera', () => expect(moodFor(s(0, 0, 0))).toBe('espera'));
  it('algo hecho, nada fallado, sin terminar → enmarcha', () => expect(moodFor(s(1, 0, 0))).toBe('enmarcha'));
  it('todo normal → firme', () => expect(moodFor(s(2, 0, 0))).toBe('firme'));
  it('todo hecho con algún mínimo → vivo', () => expect(moodFor(s(1, 1, 0))).toBe('vivo'));
  it('algún fallo → reconducir', () => expect(moodFor(s(1, 0, 1))).toBe('reconducir'));
});
