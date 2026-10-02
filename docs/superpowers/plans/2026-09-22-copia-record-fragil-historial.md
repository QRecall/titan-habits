# TITAN · Copia, récord, frágil e historial · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Cuatro mejoras pequeñas: recordatorio de copia, racha récord, compromiso más frágil y semanas anteriores en la Revisión.

**Architecture:** Lógica pura en `src/state/` con pruebas (Task 1); pantallas después (Task 2).

**Tech Stack:** React 18 + Vite + Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-22-copia-record-fragil-historial-design.md` (valores y textos exactos: úsalos literalmente).

## Global Constraints
- Sin dependencias nuevas; sin cambios de formato en `AppState` ni en la copia.
- Fechas locales `YYYY-MM-DD` con los helpers de `src/state/date.ts` y compromisos activos con `activeCommitments`/`isActiveOn` de `src/state/contracts.ts`.
- Textos en español, mismo tono; reutilizar clases CSS existentes de cada pantalla.
- Rama `mejoras`; nada a `main` sin permiso.

---

### Task 1: Lógica pura con pruebas

**Files:** Create `src/state/backupReminder.ts`, `src/state/fragile.ts` (+ `.test.ts`); Modify `src/state/stats.ts` (`bestStreak`), `src/state/contracts.ts` (`contractsBefore`) (+ tests en sus `.test.ts`).

**Produces:** `shouldRemindBackup(lastBackup: string | null, firstUse: string | null, todayISO: string): boolean`; `bestStreak(state: AppState, todayISO?: string): number`; `fragileCommitment(state: AppState, contract: WeeklyContract, todayISO?: string): { commitment: Commitment; fails: number; days: number } | null`; `contractsBefore(contracts: WeeklyContract[], key: string): WeeklyContract[]`.

- [ ] TDD por función: escribir primero las pruebas de la sección «Pruebas» del spec (con fechas concretas de septiembre de 2026 y `weekKey(parseISODate(...))`), verlas fallar, implementar según el spec, verlas pasar.
- [ ] `bestStreak` debe dar el mismo resultado que `computeStreakAcross` cuando la racha actual es la mejor (añadir esa prueba).
- [ ] `npm test` y `npx tsc -b` en verde. Commit.

### Task 2: Pantallas

**Files:** Modify `src/screens/MyData.tsx` (guardar `titan.lastBackupAt` al descargar), `src/screens/Arranque.tsx` (línea de recordatorio; necesita `onNavigate('datos')`), `src/screens/Progress.tsx` (KPI «Récord»), `src/screens/Review.tsx` (frase del frágil en `ReviewForm`; select «Semanas anteriores»).

**Consumes:** las cuatro funciones de Task 1; `weekRangeLabel`, `today`, `toISODate`.

- [ ] Implementar según el spec (textos literales). La lectura/escritura de `titan.lastBackupAt` va en un par de helpers pequeños (`readLastBackup()`/`markBackupDone(todayISO)`) en `src/state/backupReminder.ts`, con try/catch, y con prueba usando un `StorageLike` falso si el helper lo acepta como parámetro.
- [ ] En Review, el estado seleccionado pasa a ser un `weekKey`; las pestañas y el select lo fijan; el `key` de `ReviewForm` sigue siendo el `weekKey`.
- [ ] `npm test` y `npm run build` en verde. Commit.

### Task 3: Publicar (con permiso del usuario)
