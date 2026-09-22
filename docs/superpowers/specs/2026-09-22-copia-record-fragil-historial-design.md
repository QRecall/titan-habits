# TITAN · Recordatorio de copia, racha récord, compromiso frágil y semanas anteriores

Fecha: 2026-09-22 · Estado: aprobado en conversación.

## 1. Recordatorio de copia
- Al pulsar «Descargar copia» en Mis datos se guarda la fecha local (`YYYY-MM-DD`) en `localStorage`
  bajo `titan.lastBackupAt` (fuera de `AppState`: la copia no cambia de formato). Acceso con try/catch.
- `shouldRemindBackup(lastBackup: string | null, firstUse: string | null, todayISO: string): boolean`
  (`src/state/backupReminder.ts`): false si `firstUse` es null o `todayISO < firstUse + 7 días`;
  true si `lastBackup` es null o `todayISO > lastBackup + 30 días`; si no, false.
  `firstUse` = fecha local de `profile.onboardedAt`.
- Arranque muestra una línea discreta cuando toca: «Hace más de un mes que no guardas una copia de
  TITAN» (o «Aún no has guardado ninguna copia de TITAN» si nunca) · botón «Guardar ahora» → Mis datos.

## 2. Racha récord
- `bestStreak(state, todayISO): number` en `src/state/stats.ts`: recorre día a día desde la firma más
  antigua hasta hoy con las mismas reglas que `computeStreakAcross` (contrato de su semana, solo días
  ≥ firma, compromisos activos del día; un día sin activos, con `missed` o pasado incompleto corta;
  hoy incompleto sin `missed` no corta ni suma). Devuelve el máximo; nunca menor que la racha actual.
- Progreso: KPI «Récord» junto a «Racha actual» (mismo formato «N días»).

## 3. Compromiso más frágil (Revisión)
- `fragileCommitment(state, contract, todayISO): { commitment, fails, days } | null`
  (`src/state/fragile.ts`). Para cada día evaluable de la semana y cada compromiso activo ese día:
  cuenta `days` y `fails` (missed o sin marcar); hoy sin marcar no cuenta ni como día ni como fallo.
  Null si la semana tiene < 3 días evaluables o ningún compromiso llega a `fails/days >= 1/3`.
  Elige el mayor `fails/days`; empate → más `fails`; empate → orden del contrato.
- Revisión, bajo el resumen: «El que más te cuesta: **{nombre}** (no cumplido {fails} de {days} días).
  Si quieres sostenerlo, prueba a bajar su versión mínima la semana que viene.» (singular «día» si 1).

## 4. Semanas anteriores (Revisión)
- `contractsBefore(contracts, key): WeeklyContract[]` en `src/state/contracts.ts`: contratos con
  `startDate` anterior a la semana `key`, del más reciente al más antiguo.
- Revisión mantiene las pestañas «Esta semana» / «Semana pasada». Si hay contratos anteriores a la
  semana pasada, un `<select>` «Semanas anteriores» con `weekRangeLabel(startDate)`; al elegir, se
  muestra esa semana (resumen, frágil y revisión editable). Las pestañas y el select son excluyentes
  (elegir uno deselecciona lo otro).

## Pruebas
- `bestStreak`: racha rota y otra más larga después; cruce de semana; hoy incompleto; compromiso
  quitado/añadido; sin contratos → 0.
- `fragileCommitment`: umbral 1/3; < 3 días → null; empates; hoy sin marcar no cuenta; compromiso
  añadido a mitad de semana solo cuenta sus días.
- `shouldRemindBackup`: nunca, 30 y 31 días, primera semana, sin perfil.
- `contractsBefore`: orden y exclusión de la semana dada y posteriores.
