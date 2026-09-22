import { describe, expect, it } from 'vitest';
import { shouldRemindBackup } from './backupReminder';

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
