import { describe, expect, it } from 'vitest';
import type { Commitment, WeeklyContract } from '../types';
import {
  activeCommitments,
  contractForWeek,
  currentCommitments,
  isActiveOn,
  latestContractBefore,
  mergeCommitmentEdit,
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

const base = { name: 'X', normal: 'n', minimum: 'm', reason: 'r' };
const c = (id: string, extra: Partial<Commitment> = {}): Commitment => ({ id, ...base, ...extra });
function contractWith(commitments: Commitment[], signedAt = '2026-09-21'): WeeklyContract {
  return { weekKey: '2026-W39', startDate: '2026-09-21', signedAt, commitments, createdAt: '2026-09-21T06:00:00.000Z' };
}

describe('isActiveOn / activeCommitments / currentCommitments', () => {
  it('sin fechas cuenta siempre', () => {
    expect(isActiveOn(c('a'), '2026-09-21')).toBe(true);
  });
  it('since cuenta desde ese día inclusive; removedOn deja de contar ese día', () => {
    const x = c('a', { since: '2026-09-23', removedOn: '2026-09-25' });
    expect(isActiveOn(x, '2026-09-22')).toBe(false);
    expect(isActiveOn(x, '2026-09-23')).toBe(true);
    expect(isActiveOn(x, '2026-09-24')).toBe(true);
    expect(isActiveOn(x, '2026-09-25')).toBe(false);
  });
  it('activeCommitments filtra por día y currentCommitments quita los quitados', () => {
    const k = contractWith([c('a'), c('b', { since: '2026-09-23' }), c('z', { removedOn: '2026-09-22' })]);
    expect(activeCommitments(k, '2026-09-21').map((x) => x.id)).toEqual(['a', 'z']);
    expect(activeCommitments(k, '2026-09-23').map((x) => x.id)).toEqual(['a', 'b']);
    expect(currentCommitments(k).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('mergeCommitmentEdit', () => {
  const prev = contractWith([c('a'), c('b')]); // firmado el lunes 21
  it('nuevo a mitad de semana: since = hoy', () => {
    const out = mergeCommitmentEdit(prev, [c('a'), c('b'), c('n')], '2026-09-23');
    expect(out.find((x) => x.id === 'n')?.since).toBe('2026-09-23');
    expect(out.find((x) => x.id === 'a')?.since).toBeUndefined();
  });
  it('quitado a mitad de semana: se conserva con removedOn = hoy, al final', () => {
    const out = mergeCommitmentEdit(prev, [c('a')], '2026-09-24');
    expect(out.map((x) => x.id)).toEqual(['a', 'b']);
    expect(out[1].removedOn).toBe('2026-09-24');
  });
  it('añadido y quitado el mismo día desaparece', () => {
    const withNew = contractWith([c('a'), c('b'), c('n', { since: '2026-09-23' })]);
    const out = mergeCommitmentEdit(withNew, [c('a'), c('b')], '2026-09-23');
    expect(out.map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('contrato firmado hoy o futuro: sin fechas y los quitados se eliminan', () => {
    const today = contractWith([c('a'), c('b')], '2026-09-23');
    const out = mergeCommitmentEdit(today, [c('a'), c('n')], '2026-09-23');
    expect(out).toEqual([c('a'), c('n')]);
  });
  it('conserva since y los ya quitados', () => {
    const k = contractWith([c('a', { since: '2026-09-22' }), c('z', { removedOn: '2026-09-22' })]);
    const out = mergeCommitmentEdit(k, [{ ...c('a'), name: 'A2' }], '2026-09-24');
    expect(out).toEqual([{ ...c('a', { since: '2026-09-22' }), name: 'A2' }, c('z', { removedOn: '2026-09-22' })]);
  });
});
