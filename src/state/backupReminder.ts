import { parseISODate, toISODate } from './date';

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
