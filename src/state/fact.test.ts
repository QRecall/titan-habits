import { describe, expect, it } from 'vitest';
import type { AppState } from '../types';
import { FACT_MAX } from '../types';
import { reducer } from './store';
import { createBackup, parseBackup, serializeBackup, summarizeBackup } from './backup';
import { computeStreakAcross, computeWeekStats } from './stats';
import { readStoredState, writeStoredState, type StorageLike } from './storage';

const base: AppState = {
  profile: { name: 'Nacho', identity: 'alguien constante', onboardedAt: '2026-09-14T07:00:00.000Z' },
  contracts: [
    {
      weekKey: '2026-W39',
      startDate: '2026-09-21',
      signedAt: '2026-09-21',
      createdAt: '2026-09-21T07:00:00.000Z',
      commitments: [{ id: 'a', name: 'Escribir', normal: '30 min', minimum: '3 frases', reason: 'r' }],
    },
  ],
  days: [
    {
      date: '2026-09-21',
      weekKey: '2026-W39',
      marks: [{ commitmentId: 'a', status: 'normal', note: 'al amanecer' }],
    },
  ],
  reviews: [],
};

const setFact = (s: AppState, fact: string, date = '2026-09-21') =>
  reducer(s, { type: 'SET_FACT', date, weekKey: '2026-W39', fact });

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe('SET_FACT · longitud', () => {
  it('0 caracteres: no crea el campo ni el día', () => {
    const s = setFact(base, '', '2026-09-22');
    expect(s).toBe(base);
    expect(setFact(base, '   ').days[0]).not.toHaveProperty('fact');
  });

  it('120 caracteres: se guardan completos', () => {
    const text = 'x'.repeat(FACT_MAX);
    expect(setFact(base, text).days[0].fact).toBe(text);
  });

  it('121 caracteres: se recorta a 120', () => {
    const s = setFact(base, 'y'.repeat(FACT_MAX + 1));
    expect(s.days[0].fact).toHaveLength(FACT_MAX);
  });

  it('los saltos de línea se convierten en espacios (una sola línea)', () => {
    expect(setFact(base, 'uno\ndos').days[0].fact).toBe('uno dos');
  });

  it('vaciarlo elimina el campo', () => {
    const s = setFact(setFact(base, 'algo'), '');
    expect(s.days[0]).not.toHaveProperty('fact');
  });
});

describe('SET_FACT · no toca lo demás', () => {
  it('conserva marcas y notas del día', () => {
    const s = setFact(base, 'Aprobé Pediatría');
    expect(s.days[0].marks).toEqual(base.days[0].marks);
  });

  it('en un día sin marcas crea el día sin marcas y no altera racha ni progreso', () => {
    const s = setFact(base, 'Día tranquilo', '2026-09-22');
    expect(s.days[1]).toEqual({ date: '2026-09-22', weekKey: '2026-W39', marks: [], fact: 'Día tranquilo' });
    expect(computeStreakAcross(s, '2026-09-22')).toBe(computeStreakAcross(base, '2026-09-22'));
    expect(computeWeekStats(s, s.contracts[0], '2026-09-22')).toEqual(
      computeWeekStats(base, base.contracts[0], '2026-09-22')
    );
  });
});

describe('hecho del día · persistencia', () => {
  it('sobrevive a guardar y volver a leer (recarga)', () => {
    const storage = memoryStorage();
    const s = setFact(base, 'Aprobé Pediatría');
    writeStoredState(s, storage);
    expect(readStoredState(storage).state).toEqual(s);
  });

  it('sobrevive a exportar e importar la copia sin perder nada', () => {
    const s = setFact(setFact(base, 'x'.repeat(FACT_MAX)), 'Día tranquilo', '2026-09-22');
    const parsed = parseBackup(serializeBackup(createBackup(s)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.data).toEqual(s);
    expect(summarizeBackup(parsed.backup).facts).toBe(2);
  });

  it('una copia antigua sin hechos se importa igual', () => {
    const parsed = parseBackup(serializeBackup(createBackup(base)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.data).toEqual(base);
    expect(summarizeBackup(parsed.backup).facts).toBe(0);
  });

  it('rechaza un hecho que no es texto', () => {
    const bad = createBackup(base) as unknown as { data: { days: Record<string, unknown>[] } };
    bad.data.days[0].fact = 42;
    const parsed = parseBackup(JSON.stringify(bad));
    expect(parsed.ok).toBe(false);
  });
});
