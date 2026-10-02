import { describe, expect, it } from 'vitest';
import { LAST_BACKUP_KEY, markBackupDone, readLastBackup, shouldRemindBackup } from './backupReminder';
import type { StorageLike } from './storage';

function fakeStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe('shouldRemindBackup', () => {
  it('sin perfil (firstUse null) nunca avisa, aunque no haya copia', () => {
    expect(shouldRemindBackup(null, null, '2026-09-22')).toBe(false);
    expect(shouldRemindBackup('2026-01-01', null, '2026-09-22')).toBe(false);
  });

  it('primera semana: antes de firstUse + 7 días no avisa', () => {
    expect(shouldRemindBackup(null, '2026-09-01', '2026-09-07')).toBe(false); // 6 días
  });

  it('primera semana: a los 7 días exactos, si nunca hay copia, avisa', () => {
    expect(shouldRemindBackup(null, '2026-09-01', '2026-09-08')).toBe(true); // 7 días
  });

  it('nunca se ha guardado copia y ya pasó la primera semana → avisa', () => {
    expect(shouldRemindBackup(null, '2026-08-01', '2026-08-10')).toBe(true);
  });

  it('30 días exactos desde la última copia: aún no avisa', () => {
    expect(shouldRemindBackup('2026-08-01', '2026-01-01', '2026-08-31')).toBe(false);
  });

  it('31 días desde la última copia: avisa', () => {
    expect(shouldRemindBackup('2026-08-01', '2026-01-01', '2026-09-01')).toBe(true);
  });

  it('copia reciente y primera semana ya pasada → no avisa', () => {
    expect(shouldRemindBackup('2026-09-15', '2026-01-01', '2026-09-20')).toBe(false);
  });
});

describe('readLastBackup', () => {
  it('devuelve null si no hay nada guardado', () => {
    expect(readLastBackup(fakeStorage())).toBeNull();
  });

  it('devuelve la fecha guardada', () => {
    const storage = fakeStorage({ [LAST_BACKUP_KEY]: '2026-09-01' });
    expect(readLastBackup(storage)).toBe('2026-09-01');
  });

  it('devuelve null si el almacenamiento falla', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('boom');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(readLastBackup(storage)).toBeNull();
  });

  it('devuelve null si no hay almacenamiento disponible', () => {
    expect(readLastBackup(null)).toBeNull();
  });
});

describe('markBackupDone', () => {
  it('guarda la fecha de hoy', () => {
    const storage = fakeStorage();
    markBackupDone('2026-09-22', storage);
    expect(readLastBackup(storage)).toBe('2026-09-22');
  });

  it('no lanza si el almacenamiento falla', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('boom');
      },
      removeItem: () => {},
    };
    expect(() => markBackupDone('2026-09-22', storage)).not.toThrow();
  });

  it('no lanza si no hay almacenamiento disponible', () => {
    expect(() => markBackupDone('2026-09-22', null)).not.toThrow();
  });
});
