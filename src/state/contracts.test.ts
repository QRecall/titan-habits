import { describe, expect, it } from 'vitest';
import type { WeeklyContract } from '../types';
import {
  contractForWeek,
  latestContractBefore,
  newContractForWeekStarting,
  nextWeekStart,
  sortContracts,
} from './contracts';

const A = { id: 'a', name: 'A', normal: 'n', minimum: 'm', reason: '' };

function contract(weekKey: string, startDate: string): WeeklyContract {
  return { weekKey, startDate, signedAt: startDate, createdAt: 'x', commitments: [A] };
}

const w35 = contract('2026-W35', '2026-08-24');
const w36 = contract('2026-W36', '2026-08-31');
const w37 = contract('2026-W37', '2026-09-07');

describe('sortContracts', () => {
  it('ordena por fecha de inicio sin mutar la lista original', () => {
    const list = [w37, w35, w36];
    const sorted = sortContracts(list);
    expect(sorted.map((c) => c.weekKey)).toEqual(['2026-W35', '2026-W36', '2026-W37']);
    expect(list.map((c) => c.weekKey)).toEqual(['2026-W37', '2026-W35', '2026-W36']);
  });
});

describe('contractForWeek', () => {
  it('devuelve el contrato de esa semana o null', () => {
    expect(contractForWeek([w35, w36, w37], '2026-W36')).toBe(w36);
    expect(contractForWeek([w35, w37], '2026-W36')).toBeNull();
    expect(contractForWeek([], '2026-W36')).toBeNull();
  });
});

describe('latestContractBefore', () => {
  it('devuelve el contrato más reciente anterior a la semana dada', () => {
    expect(latestContractBefore([w37, w35, w36], '2026-W37')).toBe(w36);
    expect(latestContractBefore([w35, w37], '2026-W37')).toBe(w35);
  });

  it('ignora la propia semana y las posteriores', () => {
    expect(latestContractBefore([w36, w37], '2026-W36')).toBeNull();
    expect(latestContractBefore([w37], '2026-W36')).toBeNull();
  });
});

describe('nextWeekStart', () => {
  it('devuelve el lunes de la semana siguiente', () => {
    expect(nextWeekStart(new Date(2026, 8, 7))).toBe('2026-09-14'); // lunes
    expect(nextWeekStart(new Date(2026, 8, 6))).toBe('2026-09-07'); // domingo
    expect(nextWeekStart(new Date(2026, 8, 9))).toBe('2026-09-14'); // miércoles
  });
});

describe('newContractForWeekStarting', () => {
  it('crea el contrato con weekKey, inicio y firma en ese lunes', () => {
    const c = newContractForWeekStarting([A], '2026-09-14', new Date(2026, 8, 6, 20, 0));
    expect(c.weekKey).toBe('2026-W38');
    expect(c.startDate).toBe('2026-09-14');
    expect(c.signedAt).toBe('2026-09-14');
    expect(c.commitments).toEqual([A]);
    expect(c.createdAt).toBe(new Date(2026, 8, 6, 20, 0).toISOString());
  });

  it('para la semana en curso la firma es hoy, no el lunes', () => {
    const c = newContractForWeekStarting([A], '2026-08-31', new Date(2026, 8, 3, 9, 0));
    expect(c.weekKey).toBe('2026-W36');
    expect(c.startDate).toBe('2026-08-31');
    expect(c.signedAt).toBe('2026-09-03');
  });
});
