# TITAN · Cambios a mitad de semana y bloque del icono · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir o quitar compromisos a mitad de semana solo cuenta desde el día del cambio; el pasado no cambia. Y simplificar el bloque del número del icono en "Mis datos".

**Architecture:** Dos fechas opcionales por compromiso (`since`, `removedOn`) y una única regla (`isActiveOn`) en `src/state/contracts.ts`. El reducer fusiona la edición con `mergeCommitmentEdit`. Todos los cálculos y pantallas pasan a usar los compromisos activos de cada día.

**Tech Stack:** React 18 + Vite + Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-22-cambios-a-mitad-de-semana-design.md`

## Global Constraints

- Regla: añadido el día D cuenta desde D inclusive; quitado el día D cuenta hasta D−1. El pasado nunca cambia al editar.
- Sin `since`/`removedOn` el comportamiento es exactamente el de antes (datos existentes intactos).
- Fechas en formato local `YYYY-MM-DD` (las de `src/state/date.ts`).
- Sin dependencias nuevas. Textos en español, mismo tono.
- Commits en la rama `mid-week`; nada a `main` ni push sin permiso del usuario.

---

## Mapa de ficheros

| Fichero | Cambio |
|---|---|
| `src/types.ts` | `since?`, `removedOn?` en `Commitment` |
| `src/state/contracts.ts` | `isActiveOn`, `activeCommitments`, `currentCommitments`, `mergeCommitmentEdit` |
| `src/state/store.tsx` | `SAVE_CONTRACT` usa `mergeCommitmentEdit` |
| `src/state/backup.ts` | Acepta y valida `since`/`removedOn` |
| `src/state/stats.ts`, `coach.ts`, `mood.ts`, `month.ts` | Compromisos activos por día |
| `src/screens/Arranque.tsx`, `Progress.tsx`, `Review.tsx`, `Contract.tsx` | Listas según la regla |
| `src/screens/MyData.tsx` | `BadgeControl` simplificado |

---

### Task 1: Modelo, regla, fusión al editar y copia de seguridad

**Files:**
- Modify: `src/types.ts`, `src/state/contracts.ts`, `src/state/store.tsx` (`SAVE_CONTRACT`), `src/state/backup.ts` (`parseCommitment`)
- Test: `src/state/contracts.test.ts` (añadir), `src/state/store.test.ts` (añadir), `src/state/backup.test.ts` (añadir)

**Interfaces:**
- Produces: `isActiveOn(c: Commitment, date: string): boolean`, `activeCommitments(contract: WeeklyContract, date: string): Commitment[]`, `currentCommitments(contract: WeeklyContract): Commitment[]`, `mergeCommitmentEdit(previous: WeeklyContract, next: Commitment[], todayISO: string): Commitment[]`.

- [ ] **Step 1: Tipo** — en `src/types.ts`:

```ts
export type Commitment = {
  id: string;
  name: string;
  normal: string;
  minimum: string;
  reason: string;
  /** Día (YYYY-MM-DD) en que se añadió, si fue después de firmar el contrato. Cuenta desde ese día. */
  since?: string;
  /** Día (YYYY-MM-DD) en que se quitó. Deja de contar desde ese día; los anteriores no cambian. */
  removedOn?: string;
};
```

- [ ] **Step 2: Tests que fallan** (añadir a `src/state/contracts.test.ts`, siguiendo su estilo):

```ts
import { activeCommitments, currentCommitments, isActiveOn, mergeCommitmentEdit } from './contracts';

const base = { name: 'X', normal: 'n', minimum: 'm', reason: 'r' };
const c = (id: string, extra: Partial<Commitment> = {}): Commitment => ({ id, ...base, ...extra });
function contractWith(commitments: Commitment[], signedAt = '2026-09-21'): WeeklyContract {
  return { weekKey: '2026-W39', startDate: '2026-09-21', signedAt, commitments, createdAt: '2026-09-21T06:00:00.000Z' };
}

describe('isActiveOn / activeCommitments / currentCommitments', () => {
  it('sin fechas cuenta siempre', () => {
    expect(isActiveOn(c('a'), '2026-09-21')).toBe(true);
  });
  it('since cuenta desde ese día inclusive; removedOn deja de contar ese día', () => {
    const x = c('a', { since: '2026-09-23', removedOn: '2026-09-25' });
    expect(isActiveOn(x, '2026-09-22')).toBe(false);
    expect(isActiveOn(x, '2026-09-23')).toBe(true);
    expect(isActiveOn(x, '2026-09-24')).toBe(true);
    expect(isActiveOn(x, '2026-09-25')).toBe(false);
  });
  it('activeCommitments filtra por día y currentCommitments quita los quitados', () => {
    const k = contractWith([c('a'), c('b', { since: '2026-09-23' }), c('z', { removedOn: '2026-09-22' })]);
    expect(activeCommitments(k, '2026-09-21').map((x) => x.id)).toEqual(['a', 'z']);
    expect(activeCommitments(k, '2026-09-23').map((x) => x.id)).toEqual(['a', 'b']);
    expect(currentCommitments(k).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('mergeCommitmentEdit', () => {
  const prev = contractWith([c('a'), c('b')]); // firmado el lunes 21
  it('nuevo a mitad de semana: since = hoy', () => {
    const out = mergeCommitmentEdit(prev, [c('a'), c('b'), c('n')], '2026-09-23');
    expect(out.find((x) => x.id === 'n')?.since).toBe('2026-09-23');
    expect(out.find((x) => x.id === 'a')?.since).toBeUndefined();
  });
  it('quitado a mitad de semana: se conserva con removedOn = hoy, al final', () => {
    const out = mergeCommitmentEdit(prev, [c('a')], '2026-09-24');
    expect(out.map((x) => x.id)).toEqual(['a', 'b']);
    expect(out[1].removedOn).toBe('2026-09-24');
  });
  it('añadido y quitado el mismo día desaparece', () => {
    const withNew = contractWith([c('a'), c('b'), c('n', { since: '2026-09-23' })]);
    const out = mergeCommitmentEdit(withNew, [c('a'), c('b')], '2026-09-23');
    expect(out.map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('contrato firmado hoy o futuro: sin fechas y los quitados se eliminan', () => {
    const today = contractWith([c('a'), c('b')], '2026-09-23');
    const out = mergeCommitmentEdit(today, [c('a'), c('n')], '2026-09-23');
    expect(out).toEqual([c('a'), c('n')]);
  });
  it('conserva since y los ya quitados', () => {
    const k = contractWith([c('a', { since: '2026-09-22' }), c('z', { removedOn: '2026-09-22' })]);
    const out = mergeCommitmentEdit(k, [{ ...c('a'), name: 'A2' }], '2026-09-24');
    expect(out).toEqual([{ ...c('a', { since: '2026-09-22' }), name: 'A2' }, c('z', { removedOn: '2026-09-22' })]);
  });
});
```

(Importar `Commitment`, `WeeklyContract` de `../types` y `describe/expect/it` si el fichero aún no lo hace.)

- [ ] **Step 3: Ejecutar** — `npx vitest run src/state/contracts.test.ts` → FAIL.

- [ ] **Step 4: Implementación** (añadir a `src/state/contracts.ts`):

```ts
/** ¿Cuenta este compromiso el día `date`? Añadido: desde `since`. Quitado: hasta el día anterior a `removedOn`. */
export function isActiveOn(c: Commitment, date: string): boolean {
  return (!c.since || date >= c.since) && (!c.removedOn || date < c.removedOn);
}

/** Compromisos que cuentan el día `date`. */
export function activeCommitments(contract: WeeklyContract, date: string): Commitment[] {
  return contract.commitments.filter((c) => isActiveOn(c, date));
}

/** Compromisos no quitados: los que se editan, se prellenan y se muestran hoy. */
export function currentCommitments(contract: WeeklyContract): Commitment[] {
  return contract.commitments.filter((c) => !c.removedOn);
}

/**
 * Fusiona una edición del contrato de la semana con el guardado.
 * Si ya hay días evaluados (hoy > firma), lo nuevo cuenta desde hoy y lo
 * quitado se conserva con `removedOn = hoy`, para que el pasado no cambie.
 */
export function mergeCommitmentEdit(previous: WeeklyContract, next: Commitment[], todayISO: string): Commitment[] {
  const locked = todayISO > previous.signedAt;
  const prevById = new Map(previous.commitments.map((c) => [c.id, c]));
  const nextIds = new Set(next.map((c) => c.id));
  const out: Commitment[] = [];

  for (const c of next) {
    const prev = prevById.get(c.id);
    const { since: _s, removedOn: _r, ...fields } = c;
    if (prev && !prev.removedOn) out.push(prev.since ? { ...fields, since: prev.since } : fields);
    else out.push(locked ? { ...fields, since: todayISO } : fields);
  }

  for (const p of previous.commitments) {
    if (nextIds.has(p.id)) continue;
    if (p.removedOn) {
      out.push(p);
      continue;
    }
    if (!locked || (p.since && p.since >= todayISO)) continue;
    out.push({ ...p, removedOn: todayISO });
  }
  return out;
}
```

(Si `noUnusedLocals` protesta por `_s`/`_r`, construir `fields` explícitamente con `id, name, normal, minimum, reason`.)

- [ ] **Step 5: Reducer** — en `src/state/store.tsx`, `case 'SAVE_CONTRACT'`, cuando hay `previous`:

```ts
        ? {
            ...action.contract,
            startDate: previous.startDate,
            signedAt: previous.signedAt,
            createdAt: previous.createdAt,
            commitments: mergeCommitmentEdit(previous, action.contract.commitments, today()),
          }
```

Añadir un test a `src/state/store.test.ts` (siguiendo su estilo, con el reducer o el store que ya prueba) que: guarda un contrato firmado en una fecha pasada con `a,b`; lo vuelve a guardar con `a,n` hoy; comprueba que `n.since === hoy` y que `b` sigue con `removedOn === hoy`. Si el test necesita controlar "hoy", usar `vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 23, 12))` y restaurar.

- [ ] **Step 6: Copia de seguridad** — en `src/state/backup.ts`, `parseCommitment` acepta `since` y `removedOn` opcionales, validados como fecha `YYYY-MM-DD` con el mismo criterio que `isoDate` (reutilizar o añadir un `optionalIsoDate`), y solo los incluye si vienen. Tests en `src/state/backup.test.ts`: ida y vuelta de un contrato con `since` y `removedOn`; `since: '23/09/2026'` → la copia se rechaza con un mensaje que nombre la ruta del campo.

- [ ] **Step 7:** `npm test` y `npx tsc -b` en verde. Commit.

---

### Task 2: Cálculos con los compromisos activos de cada día

**Files:**
- Modify: `src/state/stats.ts`, `src/state/coach.ts`, `src/state/mood.ts`, `src/state/month.ts`
- Test: `src/state/stats.test.ts`, `src/state/month.test.ts`, `src/state/mood.test.ts`, `src/state/coach.test.ts` (añadir casos)

**Interfaces:**
- Consumes: `activeCommitments`, `currentCommitments`, `isActiveOn` (Task 1).
- Produces: mismas firmas públicas que hoy.

- [ ] **Step 1: Tests que fallan** — añadir en `src/state/stats.test.ts` (contrato de la semana W39 firmado el lunes `2026-09-21` con `a,b`; usar `weekKey(parseISODate(...))` para el `weekKey` de días y contrato):
  1. Todo cumplido lunes y martes con `a,b`; se añade `n` con `since: '2026-09-23'`; miércoles `a,b,n` cumplidos → `computeStreakAcross(state, '2026-09-23') === 3` y `computeWeekStats(state, contract, '2026-09-23')` da `daysHonored === 3`, `percent === 1`.
  2. Igual, pero el miércoles solo `a,b` marcados (sin `n`) → a las `'2026-09-24'` la racha es 2 (miércoles incompleto la corta), y lunes y martes siguen cumplidos (`daysHonored === 2`).
  3. `b` con `removedOn: '2026-09-24'`; lunes a miércoles `a,b` cumplidos; jueves solo `a` cumplido → `computeStreakAcross(state, '2026-09-24') === 4`, `daysHonored === 4`, y el `perCommitment` de `b` cuenta 3 normales y 0 sin marcar.
  4. `pendingToday(state, '2026-09-24')` con `b` quitado ese día y `a` sin marcar → 1.
  5. Porcentaje con denominador por día: lunes `a,b` (2 activos), martes se añade `n` (`since: '2026-09-22'`) y se marcan `a,b,n` → `percent === 1` en `'2026-09-22'`; si el martes falta `n`, `percent === 4/5`.
  
  En `month.test.ts`: un día con `b` quitado → `active` no lo cuenta. En `mood.test.ts` y `coach.test.ts`: un compromiso quitado hoy no cuenta en `todayStatus().total` ni en el mensaje "todo en normal".

- [ ] **Step 2: Ejecutar** — `npx vitest run src/state/stats.test.ts src/state/month.test.ts src/state/mood.test.ts src/state/coach.test.ts` → los nuevos FAIL.

- [ ] **Step 3: Implementación**
  - `computeWeekStats`: por cada día evaluable, `const active = activeCommitments(contract, iso)`; el día cuenta como cumplido si `active.length > 0` y todos están en normal o mínimo; cada estado suma a `per[c.id]` y a los totales solo para `c` activo ese día; `denom` = suma de `active.length` por día; `totalCommitments = currentCommitments(contract).length`; `perCommitment` recorre `contract.commitments` (incluidos los quitados).
  - `computeStreak` y `computeStreakAcross`: sustituir el bucle sobre `contract.commitments` por `activeCommitments(contract, cursor)`; si esa lista está vacía, cortar (`break`), igual que hoy corta un contrato sin compromisos. Mantener el resto de reglas.
  - `pendingToday`: `activeCommitments(contract, todayISO).filter(...)`.
  - `coach.ts` (`statusOfToday`), `mood.ts` (`todayStatus`), `month.ts` (`active`, `done` y `pendingToday` interno): usar `activeCommitments(contract, fecha)`.

- [ ] **Step 4:** tests nuevos en verde; `npm test` y `npx tsc -b` en verde. Commit.

---

### Task 3: Pantallas y bloque del icono

**Files:**
- Modify: `src/screens/Arranque.tsx:91`, `src/screens/Progress.tsx:94-115`, `src/screens/Review.tsx:95-101,119-130`, `src/screens/Contract.tsx:31-33`, `src/screens/MyData.tsx` (`BadgeControl`)

**Interfaces:**
- Consumes: `activeCommitments`, `currentCommitments`, `isActiveOn` (Task 1).

- [ ] **Step 1: Arranque** — la lista usa `activeCommitments(activeContract, todayISO)` (la fecha de hoy que ya use la pantalla, o `today()`).
- [ ] **Step 2: Contrato** — `toDrafts(currentCommitments(existing ?? prefill) …)` en lugar de `.commitments`, manteniendo el `?? []` para cuando no hay contrato. `draftsToCommitments` ya descarta `since`/`removedOn`, así que el prellenado de la semana siguiente sale limpio.
- [ ] **Step 3: Progreso** — la cuadrícula sigue recorriendo `activeContract.commitments` (incluye quitados, para que la semana se vea entera); una celda es evaluable solo si además `isActiveOn(c, iso)`; si no, clase `is-outside` y texto accesible "fuera del contrato", como ya se hace antes de la firma. Un compromiso quitado muestra « · quitado» junto a su nombre en la etiqueta de fila.
- [ ] **Step 4: Revisión** — el resumen recorre todos los compromisos del contrato; los quitados muestran « · quitado» tras el nombre.
- [ ] **Step 5: Bloque del icono** — en `BadgeControl` (`src/screens/MyData.tsx`): quitar `result`/`setResult`, la función `test`, los dos botones de prueba y el párrafo "Respuesta del sistema…". En estado `ready` dejar un único párrafo:
  "Número en el icono activo: muestra cuántos compromisos te quedan hoy. Se pone al día al abrir la app y cada mañana con el aviso de las 8:00. Ahora mismo: {pending} {pendiente|pendientes}." (con la coletilla actual cuando `pending === 0`: ", así que no se muestra ningún número"). `enable()` sigue actualizando el número tras conceder el permiso. Quitar imports que queden sin uso.
- [ ] **Step 6:** `npm test` y `npm run build` en verde. Commit.

---

### Task 4: Publicar

- [ ] Con permiso del usuario: fusionar `mid-week` en `main`, `npm test`, `git push origin main`, esperar a que GitHub Pages sirva la versión nueva y pedir al usuario que abra TITAN dos veces y compruebe Progreso y "Mis datos".
