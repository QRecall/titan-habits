import { describe, expect, it } from 'vitest';
import type { AppState } from '../types';
import { STORAGE_KEY, readStoredState, writeStoredState, type StorageLike } from './storage';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const NOW = new Date(2026, 8, 6, 12, 30, 45);

const valid: AppState = {
  profile: { name: 'Nacho', identity: 'x', onboardedAt: '2026-08-31T07:00:00.000Z' },
  contracts: [],
  days: [],
  reviews: [],
};

describe('readStoredState', () => {
  it('sin nada guardado devuelve el estado inicial sin error', () => {
    const r = readStoredState(memoryStorage(), NOW);
    expect(r.state).toEqual({ profile: null, contracts: [], days: [], reviews: [] });
    expect(r.error).toBeNull();
    expect(r.preservedKey).toBeNull();
  });

  it('lee un estado válido', () => {
    const r = readStoredState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(valid) }), NOW);
    expect(r.state).toEqual(valid);
    expect(r.error).toBeNull();
  });

  it('rellena campos ausentes con valores por defecto', () => {
    const r = readStoredState(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ profile: valid.profile }) }), NOW);
    expect(r.state).toEqual(valid);
  });

  it('JSON ilegible: no toca la clave original y guarda una copia intacta aparte', () => {
    const raw = '{"profile": {"name": "Nacho"';
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    const r = readStoredState(storage, NOW);

    expect(r.state).toEqual({ profile: null, contracts: [], days: [], reviews: [] });
    expect(r.error).toContain('leer');
    expect(r.preservedKey).toBe('titan.v1.ilegible-2026-09-06T12-30-45');
    expect(storage.map.get(STORAGE_KEY)).toBe(raw);
    expect(storage.map.get(r.preservedKey!)).toBe(raw);
  });

  it('JSON válido pero que no es un objeto se trata como ilegible', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '[1,2,3]' });
    const r = readStoredState(storage, NOW);
    expect(r.error).not.toBeNull();
    expect(r.preservedKey).not.toBeNull();
    expect(storage.map.get(STORAGE_KEY)).toBe('[1,2,3]');
  });

  it('almacenamiento no disponible: estado inicial y error, sin lanzar', () => {
    const r = readStoredState(null, NOW);
    expect(r.state.profile).toBeNull();
    expect(r.error).toContain('disponible');
    expect(r.preservedKey).toBeNull();
  });

  it('getItem que lanza: estado inicial y error, sin lanzar', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    const r = readStoredState(broken, NOW);
    expect(r.error).not.toBeNull();
  });
});

describe('writeStoredState', () => {
  it('escribe el estado bajo la clave y devuelve true', () => {
    const storage = memoryStorage();
    expect(writeStoredState(valid, storage)).toBe(true);
    expect(JSON.parse(storage.map.get(STORAGE_KEY)!)).toEqual(valid);
  });

  it('devuelve false si setItem falla', () => {
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    expect(writeStoredState(valid, full)).toBe(false);
    expect(writeStoredState(valid, null)).toBe(false);
  });
});
