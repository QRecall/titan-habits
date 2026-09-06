import { describe, expect, it } from 'vitest';
import type { Commitment } from '../types';
import { draftsToCommitments, toDrafts } from './contractDraft';

const A: Commitment = { id: 'a', name: 'Escribir', normal: '30 min', minimum: '3 frases', reason: 'r' };
const B: Commitment = { id: 'b', name: 'Moverme', normal: '45 min', minimum: '10 flexiones', reason: '' };

describe('toDrafts', () => {
  it('sin compromisos devuelve un borrador vacío sin id', () => {
    const drafts = toDrafts([]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].id).toBeUndefined();
    expect(drafts[0].name).toBe('');
  });

  it('conserva los ids de los compromisos existentes', () => {
    expect(toDrafts([A, B]).map((d) => d.id)).toEqual(['a', 'b']);
  });
});

describe('draftsToCommitments', () => {
  it('guardar sin cambios devuelve los mismos compromisos con los mismos ids', () => {
    expect(draftsToCommitments(toDrafts([A, B]))).toEqual([A, B]);
  });

  it('editar textos conserva el id', () => {
    const drafts = toDrafts([A]);
    drafts[0].normal = '  45 min  ';
    const out = draftsToCommitments(drafts);
    expect(out[0].id).toBe('a');
    expect(out[0].normal).toBe('45 min');
  });

  it('asigna un id nuevo sólo a los borradores sin id', () => {
    const drafts = [...toDrafts([A]), { name: 'Leer', normal: '20 páginas', minimum: '1 página', reason: '' }];
    const out = draftsToCommitments(drafts);
    expect(out[0].id).toBe('a');
    expect(out[1].id).toBeTruthy();
    expect(out[1].id).not.toBe('a');
  });

  it('descarta borradores incompletos y limita a tres', () => {
    const incomplete = { name: 'X', normal: '', minimum: 'm', reason: '' };
    const many = [A, B, { ...A, id: 'c' }, { ...A, id: 'd' }];
    expect(draftsToCommitments([incomplete])).toEqual([]);
    expect(draftsToCommitments(toDrafts(many)).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});
