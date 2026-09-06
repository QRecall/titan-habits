import type { AppState } from '../types';
import { pad, toISODate } from './date';

export const STORAGE_KEY = 'titan.v1';

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type ReadResult = {
  state: AppState;
  /** Mensaje en lenguaje sencillo si no se pudo leer lo guardado. */
  error: string | null;
  /** Clave donde se ha conservado, sin tocar, el contenido ilegible. */
  preservedKey: string | null;
};

export const emptyState: AppState = {
  profile: null,
  contracts: [],
  days: [],
  reviews: [],
};

export function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function stamp(now: Date): string {
  return `${toISODate(now)}T${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

/**
 * Lee el estado guardado. Si el contenido no se puede interpretar, NO se
 * modifica la clave original: se copia a una clave aparte con marca de tiempo
 * y se devuelve el estado vacío junto con el error, para que la interfaz avise.
 */
export function readStoredState(storage: StorageLike | null, now: Date = new Date()): ReadResult {
  if (!storage) {
    return { state: emptyState, error: 'El almacenamiento del navegador no está disponible.', preservedKey: null };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: emptyState, error: 'El almacenamiento del navegador no está disponible.', preservedKey: null };
  }
  if (raw === null || raw === '') {
    return { state: emptyState, error: null, preservedKey: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    const preservedKey = preserveUnreadable(storage, raw, now);
    return {
      state: emptyState,
      error: 'No se pudieron leer los datos guardados. No se han modificado.',
      preservedKey,
    };
  }

  const p = parsed as Partial<AppState>;
  // Migración: contratos antiguos sin signedAt reciben la fecha de hoy.
  const todayISO = toISODate(now);
  const contracts = (Array.isArray(p.contracts) ? p.contracts : []).map((c) =>
    c.signedAt ? c : { ...c, signedAt: todayISO }
  );
  return {
    state: {
      profile: p.profile ?? null,
      contracts,
      days: Array.isArray(p.days) ? p.days : [],
      reviews: Array.isArray(p.reviews) ? p.reviews : [],
    },
    error: null,
    preservedKey: null,
  };
}

function preserveUnreadable(storage: StorageLike, raw: string, now: Date): string | null {
  const key = `${STORAGE_KEY}.ilegible-${stamp(now)}`;
  try {
    storage.setItem(key, raw);
    return key;
  } catch {
    return null;
  }
}

/** Escribe el estado. Devuelve false si el navegador rechaza el guardado. */
export function writeStoredState(state: AppState, storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Contenido crudo de una clave, para descargar datos ilegibles. */
export function readRaw(storage: StorageLike | null, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}
