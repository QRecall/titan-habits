import type { Commitment, WeeklyContract } from '../types';
import { parseISODate, startOfISOWeek, toISODate, weekKey } from './date';

/** Copia ordenada por fecha de inicio (la última es la más reciente). */
export function sortContracts(contracts: WeeklyContract[]): WeeklyContract[] {
  return [...contracts].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
}

export function contractForWeek(contracts: WeeklyContract[], key: string): WeeklyContract | null {
  return contracts.find((c) => c.weekKey === key) ?? null;
}

/** Contrato más reciente cuya semana es anterior a `key`. */
export function latestContractBefore(contracts: WeeklyContract[], key: string): WeeklyContract | null {
  const target = contracts.find((c) => c.weekKey === key);
  const limit = target ? target.startDate : startOfWeekKey(key);
  const earlier = sortContracts(contracts).filter((c) => c.startDate < limit);
  return earlier.length > 0 ? earlier[earlier.length - 1] : null;
}

/** Contratos anteriores a la semana `key` (excluida, junto con las posteriores), del más reciente al más antiguo. */
export function contractsBefore(contracts: WeeklyContract[], key: string): WeeklyContract[] {
  const target = contracts.find((c) => c.weekKey === key);
  const limit = target ? target.startDate : startOfWeekKey(key);
  return sortContracts(contracts)
    .filter((c) => c.startDate < limit)
    .reverse();
}

// "2026-W37" → lunes ISO de esa semana, como YYYY-MM-DD.
function startOfWeekKey(key: string): string {
  const [y, w] = key.split('-W').map(Number);
  // El 4 de enero siempre cae en la semana 1.
  const jan4 = new Date(y, 0, 4);
  const monday = startOfISOWeek(jan4);
  monday.setDate(monday.getDate() + (w - 1) * 7);
  return toISODate(monday);
}

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

// Día siguiente a `iso`, en formato YYYY-MM-DD.
function addOneDay(iso: string): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}

// No se importa `uid` de './store' para evitar un import circular en tiempo
// de ejecución (store.tsx ya importa de este módulo): se genera el id igual
// que allí, con un sufijo de la fecha para dejar claro que es una re-alta.
function freshId(id: string, todayISO: string): string {
  return `${id}-${todayISO}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Fusiona una edición del contrato de la semana con el guardado.
 * Si ya hay días evaluados (hoy > firma), lo nuevo cuenta desde hoy y lo
 * quitado se conserva con `removedOn = hoy`, para que el pasado no cambie.
 * Excepción: si el compromiso que se quita ya está marcado `missed` (fallado)
 * hoy —`missedToday`—, el fallo de hoy no se puede borrar: se conserva con
 * `removedOn = mañana` (y su `since`, si lo tenía), de forma que hoy sigue
 * contando como fallado y deja de contar a partir de mañana. Esto aplica
 * también si el contrato se firmó hoy mismo (`signedAt === todayISO`), ya
 * que hoy es evaluable; un contrato futuro no puede tener nada marcado hoy.
 */
export function mergeCommitmentEdit(
  previous: WeeklyContract,
  next: Commitment[],
  todayISO: string,
  missedToday: ReadonlySet<string> = new Set()
): Commitment[] {
  const locked = todayISO > previous.signedAt;
  const prevById = new Map(previous.commitments.map((c) => [c.id, c]));
  const nextIds = new Set(next.map((c) => c.id));
  const out: Commitment[] = [];

  for (const c of next) {
    const prev = prevById.get(c.id);
    const fields = { id: c.id, name: c.name, normal: c.normal, minimum: c.minimum, reason: c.reason };
    if (prev && prev.removedOn) {
      // Re-alta de un compromiso ya quitado: el registro quitado no se toca
      // (el pasado no cambia) y esto se añade como un compromiso nuevo.
      out.push(prev);
      const freshFields = { ...fields, id: freshId(c.id, todayISO) };
      out.push(locked ? { ...freshFields, since: todayISO } : freshFields);
    } else if (prev && !prev.removedOn) {
      out.push(prev.since ? { ...fields, since: prev.since } : fields);
    } else {
      out.push(locked ? { ...fields, since: todayISO } : fields);
    }
  }

  for (const p of previous.commitments) {
    if (nextIds.has(p.id)) continue;
    if (p.removedOn) {
      out.push(p);
      continue;
    }
    const evaluableToday = locked || previous.signedAt === todayISO;
    if (evaluableToday && missedToday.has(p.id)) {
      // Ya está fallado hoy: el fallo no se borra, deja de contar mañana.
      out.push({ ...p, removedOn: addOneDay(todayISO) });
      continue;
    }
    if (!locked || (p.since && p.since >= todayISO)) continue;
    out.push({ ...p, removedOn: todayISO });
  }
  return out;
}

/** Lunes de la semana siguiente a la fecha dada. */
export function nextWeekStart(d: Date): string {
  const monday = startOfISOWeek(d);
  monday.setDate(monday.getDate() + 7);
  return toISODate(monday);
}

/**
 * Contrato para la semana que empieza en `weekStart` (lunes).
 *  · Si esa semana ya ha empezado, la evaluación arranca hoy (signedAt = hoy).
 *  · Si es una semana futura, arranca el lunes.
 */
export function newContractForWeekStarting(
  commitments: Commitment[],
  weekStart: string,
  now: Date = new Date()
): WeeklyContract {
  const todayISO = toISODate(now);
  return {
    weekKey: weekKey(parseISODate(weekStart)),
    startDate: weekStart,
    signedAt: todayISO > weekStart ? todayISO : weekStart,
    commitments,
    createdAt: now.toISOString(),
  };
}
