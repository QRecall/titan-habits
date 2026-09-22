# TITAN · Cambios de compromisos a mitad de semana y bloque del icono

Fecha: 2026-09-22 · Estado: aprobado en conversación (incluido el cambio de formato de datos).

## Problema

Editar el contrato de la semana en curso sustituye la lista de compromisos para toda la semana:

- Un compromiso **añadido** el miércoles se exige también lunes y martes: esos días quedan
  incompletos, bajan los días cumplidos y **se rompe la racha**.
- Un compromiso **quitado** desaparece también de los días pasados: un día fallado por él pasa a
  contar como cumplido.

Afecta a racha, progreso semanal, gráfica mensual, entrenador, llama, revisión, aviso de las 8:00
y widget.

## Regla (elegida por el usuario): cuenta desde el cambio

- Añadido el día D → cuenta desde D inclusive.
- Quitado el día D → cuenta hasta D−1; desde D no.
- El pasado nunca cambia al editar.
- Excepción: si el día D el compromiso ya está marcado `missed` (fallado) y se quita ese mismo día
  D, el fallo de D no se puede borrar quitándolo: cuenta hasta D inclusive y deja de contar desde
  D+1 (`removedOn = D+1`), en vez de `removedOn = D`.

## Modelo

`Commitment` gana dos campos opcionales (fechas locales `YYYY-MM-DD`):

- `since?`: día en que se añadió, solo si se añadió después de la firma del contrato.
- `removedOn?`: día en que se quitó. El compromiso **se queda en el contrato**.

Sin los campos, un compromiso cuenta todos los días evaluables (compatibilidad total con los datos
existentes). La copia de seguridad acepta y conserva los dos campos (opcionales, validados como
fecha ISO).

## Lógica (`src/state/contracts.ts`)

- `isActiveOn(c, date)`: `(!since || date >= since) && (!removedOn || date < removedOn)`.
- `activeCommitments(contract, date)`: los que cuentan ese día.
- `currentCommitments(contract)`: los no quitados (para editar, prellenar y listar hoy).
- `mergeCommitmentEdit(previous, next, todayISO, missedToday?)`: al guardar un contrato ya existente
  de la misma semana. `missedToday` (por defecto vacío) trae los ids marcados `missed` hoy.
  `locked = todayISO > previous.signedAt` (hay pasado evaluado):
  - Conservados: mantienen su `since`.
  - Nuevos: `since = todayISO` si `locked`; sin fecha si no.
  - Quitados (activos antes, ausentes ahora):
    - Si está en `missedToday` y hoy es evaluable (`locked`, o `previous.signedAt === todayISO`
      porque el contrato se firmó hoy): se conserva con `removedOn = todayISO + 1 día`, y su
      `since` tal cual (aunque sea de hoy) — el fallo de hoy no se borra.
    - Si no: si `!locked` se eliminan; si se añadieron hoy (`since >= todayISO`) se eliminan; si
      no, se guardan con `removedOn = todayISO`.
  - Los ya quitados antes se conservan tal cual.
  - Orden: primero los de `next` en su orden, después los quitados.

El reducer `SAVE_CONTRACT` usa `mergeCommitmentEdit` cuando existe contrato previo para esa semana.

## Consumidores

Pasan de `contract.commitments` a `activeCommitments(contract, fecha)`:

- `stats.ts`: `computeWeekStats` (por día; denominador = suma de activos por día;
  `perCommitment` sobre todos los compromisos del contrato, contando solo sus días activos;
  `totalCommitments` = `currentCommitments().length`), `computeStreak`, `computeStreakAcross`
  (un día sin compromisos activos corta la racha como hoy corta un contrato vacío),
  `pendingToday`.
- `coach.ts`, `mood.ts` (`todayStatus`), `month.ts` (activos y hechos por día, y el pendiente de
  hoy).
- Pantallas: Arranque lista `activeCommitments(hoy)`; Contrato prellena y edita
  `currentCommitments` (sin fechas: `draftsToCommitments` ya las descarta); Progreso muestra en la
  cuadrícula todos los compromisos de la semana y marca como fuera de contrato los días en que uno
  no contaba; Revisión lista todos, con « · quitado» en los quitados.

Aviso de las 8:00 y widget se corrigen solos (usan racha y pendientes).

## Bloque del número del icono (Mis datos)

`BadgeControl` pierde los botones de prueba («Probar: poner un 3…», «Volver a los pendientes de
hoy») y el mensaje de diagnóstico. En estado activo queda una frase: el número muestra los
compromisos que faltan hoy y se pone al día al abrir la app y cada mañana con el aviso de las 8:00.
Los estados «sin soporte», «denegado» y «pedir permiso» se mantienen.

## Pruebas

- `mergeCommitmentEdit`: nuevo con `since`, quitado con `removedOn`, añadir y quitar el mismo día
  lo elimina, contrato firmado hoy o futuro sin fechas, ya quitados se conservan, `since` se
  conserva.
- `isActiveOn` / `activeCommitments` / `currentCommitments`.
- Estadísticas: añadir el miércoles no rompe la racha ni cambia lunes y martes; quitar el jueves no
  cambia lunes a miércoles; porcentaje con denominador por día; `pendingToday` ignora quitados.
- `month`, `mood`, `coach` con un compromiso quitado.
- Copia de seguridad: ida y vuelta con `since`/`removedOn`; fecha inválida rechazada.
- Todo lo existente sigue en verde.
