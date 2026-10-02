import { describe, expect, it } from 'vitest';
import type { AppState, Commitment, DayEntry } from '../types';
import { fragileCommitment } from './fragile';
import { parseISODate, weekKey } from './date';

const START = '2026-09-21'; // lunes
const WK = weekKey(parseISODate(START));

const A: Commitment = { id: 'a', name: 'A', normal: 'n', minimum: 'm', reason: 'r' };
const B: Commitment = { id: 'b', name: 'B', normal: 'n', minimum: 'm', reason: 'r' };

function contract(commitments: Commitment[], signedAt = START) {
  return { weekKey: WK, startDate: START, signedAt, commitments, createdAt: `${START}T00:00:00.000Z` };
}

type Status = 'normal' | 'minimum' | 'missed' | null;

function day(date: string, marks: { commitmentId: string; status: Status }[]): DayEntry {
  return { date, weekKey: WK, marks };
}

function state(days: DayEntry[]): AppState {
  return { profile: null, contracts: [], days, reviews: [] };
}

describe('fragileCommitment', () => {
  it('menos de 3 días evaluables en la semana → null', () => {
    const c = contract([A, B]);
    const s = state([
      day('2026-09-21', [{ commitmentId: 'a', status: 'missed' }, { commitmentId: 'b', status: 'normal' }]),
      day('2026-09-22', [{ commitmentId: 'a', status: 'missed' }, { commitmentId: 'b', status: 'normal' }]),
    ]);
    expect(fragileCommitment(s, c, '2026-09-22')).toBeNull();
  });

  it('umbral 1/3: 1 fallo de 3 días ya cuenta como frágil', () => {
    const c = contract([A, B]);
    const s = state([
      day('2026-09-21', [{ commitmentId: 'a', status: 'missed' }, { commitmentId: 'b', status: 'normal' }]),
      day('2026-09-22', [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'normal' }]),
      day('2026-09-23', [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'normal' }]),
    ]);
    expect(fragileCommitment(s, c, '2026-09-23')).toEqual({ commitment: A, fails: 1, days: 3 });
  });

  it('por debajo del umbral (1/4) ningún compromiso es frágil → null', () => {
    const c = contract([A, B]);
    const s = state([
      day('2026-09-21', [{ commitmentId: 'a', status: 'missed' }, { commitmentId: 'b', status: 'normal' }]),
      day('2026-09-22', [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'normal' }]),
      day('2026-09-23', [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'normal' }]),
      day('2026-09-24', [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'normal' }]),
    ]);
    expect(fragileCommitment(s, c, '2026-09-24')).toBeNull();
  });

  it('hoy sin marcar no cuenta ni como día ni como fallo', () => {
    const c = contract([A]);
    const s = state([
      day('2026-09-21', [{ commitmentId: 'a', status: 'missed' }]),
      day('2026-09-22', [{ commitmentId: 'a', status: 'normal' }]),
      // 2026-09-23 es hoy y no tiene marca: no cuenta ni como día ni como fallo.
    ]);
    expect(fragileCommitment(s, c, '2026-09-23')).toEqual({ commitment: A, fails: 1, days: 2 });
  });

  it('compromiso añadido a mitad de semana solo cuenta sus propios días activos', () => {
    const added: Commitment = { ...B, since: '2026-09-24' };
    const c = contract([A, added]);
    const s = state([
      day('2026-09-21', [{ commitmentId: 'a', status: 'normal' }]),
      day('2026-09-22', [{ commitmentId: 'a', status: 'normal' }]),
      day('2026-09-23', [{ commitmentId: 'a', status: 'normal' }]),
      day('2026-09-24', [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'missed' }]),
    ]);
    // b: 1 fallo de su único día activo = 1 >= 1/3 → frágil, y sólo cuenta ese día.
    expect(fragileCommitment(s, c, '2026-09-24')).toEqual({ commitment: added, fails: 1, days: 1 });
  });

  it('empate en proporción: gana el de más fallos', () => {
    const bSince: Commitment = { ...B, since: '2026-09-24' };
    const c = contract([A, bSince]);
    const s = state([
      day('2026-09-21', [{ commitmentId: 'a', status: 'missed' }]),
      day('2026-09-22', [{ commitmentId: 'a', status: 'missed' }]),
      day('2026-09-23', [{ commitmentId: 'a', status: 'normal' }]),
      day('2026-09-24', [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'missed' }]),
      day('2026-09-25', [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'normal' }]),
      day('2026-09-26', [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'normal' }]),
    ]);
    // a: 2 fallos de 6 días = 1/3. b: 1 fallo de sus 3 días activos = 1/3. Empate → gana 'a' (más fallos: 2 > 1).
    expect(fragileCommitment(s, c, '2026-09-26')).toEqual({ commitment: A, fails: 2, days: 6 });
  });

  it('compromiso quitado (removedOn) no se elige aunque haya fallado mucho antes de quitarse', () => {
    const removed: Commitment = { ...B, removedOn: '2026-09-24' };
    const c = contract([A, removed]);
    const s = state([
      day('2026-09-21', [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'missed' }]),
      day('2026-09-22', [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'missed' }]),
      day('2026-09-23', [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'normal' }]),
      day('2026-09-24', [{ commitmentId: 'a', status: 'normal' }]),
      day('2026-09-25', [{ commitmentId: 'a', status: 'normal' }]),
    ]);
    // b: 2 fallos de sus 3 días activos = 2/3, superaría el umbral, pero está quitado → no se elige.
    // a: 0 fallos de 5 días → no es frágil. Resultado: null.
    expect(fragileCommitment(s, c, '2026-09-25')).toBeNull();
  });

  it('empate total (misma proporción y mismos fallos): gana el primero en el orden del contrato', () => {
    const c = contract([A, B]);
    const s = state([
      day('2026-09-21', [{ commitmentId: 'a', status: 'missed' }, { commitmentId: 'b', status: 'missed' }]),
      day('2026-09-22', [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'normal' }]),
      day('2026-09-23', [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'normal' }]),
    ]);
    expect(fragileCommitment(s, c, '2026-09-23')).toEqual({ commitment: A, fails: 1, days: 3 });
  });
});
