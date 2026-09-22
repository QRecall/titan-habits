import { describe, expect, it } from 'vitest';
import type { Commitment, WeeklyContract } from '../types';
import {
  activeCommitments,
  contractForWeek,
  contractsBefore,
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

describe('contractsBefore', () => {
  it('devuelve los contratos anteriores a la semana dada, del más reciente al más antiguo', () => {
    expect(contractsBefore([w35, w36, w37], '2026-W37').map((c) => c.weekKey)).toEqual([
      '2026-W36',
      '2026-W35',
    ]);
  });

  it('excluye la propia semana dada y las posteriores', () => {
    expect(contractsBefore([w35, w36, w37], '2026-W36').map((c) => c.weekKey)).toEqual(['2026-W35']);
    expect(contractsBefore([w36, w37], '2026-W35').map((c) => c.weekKey)).toEqual([]);
  });

  it('funciona con una semana futura sin contrato propio', () => {
    expect(contractsBefore([w35, w36, w37], '2026-W38').map((c) => c.weekKey)).toEqual([
      '2026-W37',
      '2026-W36',
      '2026-W35',
    ]);
  });

  it('sin contratos devuelve una lista vacía', () => {
    expect(contractsBefore([], '2026-W36')).toEqual([]);
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
  it('re-alta de un compromiso ya quitado: el registro quitado no cambia y se añade uno nuevo', () => {
    const k = contractWith([c('a'), c('z', { removedOn: '2026-09-22' })]);
    const out = mergeCommitmentEdit(k, [c('a'), c('z')], '2026-09-24');
    // El registro quitado sigue intacto, con su removedOn.
    const removed = out.find((x) => x.id === 'z' && x.removedOn);
    expect(removed).toEqual(c('z', { removedOn: '2026-09-22' }));
    // La re-alta es un compromiso nuevo: id distinto, since = hoy.
    const readded = out.find((x) => x.name === 'X' && x.id !== 'a' && x.id !== 'z');
    expect(readded).toBeDefined();
    expect(readded?.since).toBe('2026-09-24');
    expect(readded?.removedOn).toBeUndefined();
    expect(readded?.id).not.toBe('z');
    // Total: 'a' + el 'z' quitado original + la re-alta nueva.
    expect(out).toHaveLength(3);
  });

  describe('quitar un compromiso ya fallado hoy', () => {
    it('bloqueado: b fallado hoy y quitado hoy → se conserva con removedOn = mañana', () => {
      const out = mergeCommitmentEdit(prev, [c('a')], '2026-09-24', new Set(['b']));
      const b = out.find((x) => x.id === 'b');
      expect(b?.removedOn).toBe('2026-09-25');
      expect(b && isActiveOn(b, '2026-09-24')).toBe(true);
    });
    it('b añadido hoy y fallado hoy, quitado hoy → se conserva con since = hoy y removedOn = mañana', () => {
      const k = contractWith([c('a'), c('b', { since: '2026-09-24' })]);
      const out = mergeCommitmentEdit(k, [c('a')], '2026-09-24', new Set(['b']));
      const b = out.find((x) => x.id === 'b');
      expect(b?.since).toBe('2026-09-24');
      expect(b?.removedOn).toBe('2026-09-25');
    });
    it('contrato firmado hoy: b fallado hoy y quitado hoy → se conserva con removedOn = mañana', () => {
      const k = contractWith([c('a'), c('b')], '2026-09-24');
      const out = mergeCommitmentEdit(k, [c('a')], '2026-09-24', new Set(['b']));
      const b = out.find((x) => x.id === 'b');
      expect(b?.removedOn).toBe('2026-09-25');
    });
    it('sin marcar como fallado: comportamiento sin cambios (removedOn = hoy)', () => {
      const out = mergeCommitmentEdit(prev, [c('a')], '2026-09-24');
      const b = out.find((x) => x.id === 'b');
      expect(b?.removedOn).toBe('2026-09-24');
    });
  });
});
