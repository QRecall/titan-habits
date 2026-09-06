import type { Commitment } from '../types';
import { uid } from './store';

/** Borrador de compromiso en el formulario. Sin `id` hasta que se guarda. */
export type Draft = Omit<Commitment, 'id'> & { id?: string };

export const MAX_COMMITMENTS = 3;

export function emptyDraft(): Draft {
  return { name: '', normal: '', minimum: '', reason: '' };
}

/** Convierte los compromisos existentes en borradores, conservando sus ids. */
export function toDrafts(list: Commitment[]): Draft[] {
  return list.length === 0 ? [emptyDraft()] : list.map((c) => ({ ...c }));
}

/**
 * Convierte los borradores en compromisos listos para guardar.
 *  · Se descartan los incompletos (sin nombre, versión normal o mínima).
 *  · Los ids existentes se conservan; sólo los borradores nuevos reciben uno.
 *  · Nunca más de MAX_COMMITMENTS.
 */
export function draftsToCommitments(drafts: Draft[]): Commitment[] {
  return drafts
    .filter((d) => d.name.trim() && d.normal.trim() && d.minimum.trim())
    .slice(0, MAX_COMMITMENTS)
    .map((d) => ({
      id: d.id ?? uid(),
      name: d.name.trim(),
      normal: d.normal.trim(),
      minimum: d.minimum.trim(),
      reason: d.reason.trim(),
    }));
}
