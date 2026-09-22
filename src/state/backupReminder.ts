import { parseISODate, toISODate } from './date';
import { defaultStorage, type StorageLike } from './storage';

export const LAST_BACKUP_KEY = 'titan.lastBackupAt';

function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/**
 * ¿Toca avisar de que hace falta guardar una copia?
 *  · Nunca antes de que pase la primera semana de uso (`firstUse` = fecha de
 *    `profile.onboardedAt`); sin perfil, nunca.
 *  · A partir de ahí: si nunca se ha guardado copia, avisa; si se guardó,
 *    avisa cuando pasaron más de 30 días desde la última.
 */
export function shouldRemindBackup(
  lastBackup: string | null,
  firstUse: string | null,
  todayISO: string
): boolean {
  if (firstUse === null) return false;
  if (todayISO < addDays(firstUse, 7)) return false;
  if (lastBackup === null) return true;
  return todayISO > addDays(lastBackup, 30);
}

/** Lee la fecha (YYYY-MM-DD) de la última copia guardada, o null si no hay o falla el acceso. */
export function readLastBackup(storage: StorageLike | null = defaultStorage()): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

/** Marca que se ha guardado una copia hoy. No lanza si el almacenamiento falla. */
export function markBackupDone(todayISO: string, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(LAST_BACKUP_KEY, todayISO);
  } catch {
    // Sin almacenamiento disponible: no hay nada más que hacer.
  }
}
