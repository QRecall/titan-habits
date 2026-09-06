import type {
  AppState,
  Commitment,
  CommitmentStatus,
  DayEntry,
  DayMark,
  Profile,
  WeeklyContract,
  WeeklyReview,
} from '../types';
import { pad } from './date';

export const BACKUP_APP = 'titan';
export const BACKUP_FORMAT = 1;

export type Backup = {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  exportedAt: string;
  data: AppState;
};

export type BackupSummary = {
  exportedAt: string;
  profileName: string | null;
  contracts: number;
  weeks: string[];
  days: number;
  marks: number;
  notes: number;
  reviews: number;
};

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

export function createBackup(state: AppState, now: Date = new Date()): Backup {
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    data: {
      profile: state.profile,
      contracts: state.contracts,
      days: state.days,
      reviews: state.reviews,
    },
  };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFilename(now: Date = new Date()): string {
  return `titan-copia-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export function summarizeBackup(backup: Backup): BackupSummary {
  const { data } = backup;
  let marks = 0;
  let notes = 0;
  for (const d of data.days) {
    for (const m of d.marks) {
      if (m.status) marks++;
      if (m.note) notes++;
    }
  }
  return {
    exportedAt: backup.exportedAt,
    profileName: data.profile?.name ?? null,
    contracts: data.contracts.length,
    weeks: data.contracts.map((c) => c.weekKey),
    days: data.days.length,
    marks,
    notes,
    reviews: data.reviews.length,
  };
}

/* ---------- validación ---------- */

class Invalid extends Error {}

function fail(path: string, expected: string): never {
  throw new Invalid(`${path} ${expected}`);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(obj: Record<string, unknown>, key: string, path: string): string {
  const v = obj[key];
  if (typeof v !== 'string') fail(`${path}.${key}`, 'debe ser un texto');
  return v;
}

function optionalStr(obj: Record<string, unknown>, key: string, path: string): string | undefined {
  const v = obj[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') fail(`${path}.${key}`, 'debe ser un texto');
  return v;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(obj: Record<string, unknown>, key: string, path: string): string {
  const v = str(obj, key, path);
  if (!ISO_DATE.test(v)) fail(`${path}.${key}`, 'debe ser una fecha AAAA-MM-DD');
  return v;
}

function list(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, 'debe ser una lista');
  return v;
}

function obj(v: unknown, path: string): Record<string, unknown> {
  if (!isObject(v)) fail(path, 'debe ser un objeto');
  return v;
}

function parseProfile(v: unknown, path: string): Profile | null {
  if (v === null || v === undefined) return null;
  const o = obj(v, path);
  return {
    name: str(o, 'name', path),
    identity: str(o, 'identity', path),
    onboardedAt: str(o, 'onboardedAt', path),
  };
}

function parseCommitment(v: unknown, path: string): Commitment {
  const o = obj(v, path);
  return {
    id: str(o, 'id', path),
    name: str(o, 'name', path),
    normal: str(o, 'normal', path),
    minimum: str(o, 'minimum', path),
    reason: str(o, 'reason', path),
  };
}

function parseContract(v: unknown, path: string): WeeklyContract {
  const o = obj(v, path);
  return {
    weekKey: str(o, 'weekKey', path),
    startDate: isoDate(o, 'startDate', path),
    signedAt: isoDate(o, 'signedAt', path),
    createdAt: str(o, 'createdAt', path),
    commitments: list(o.commitments, `${path}.commitments`).map((c, i) =>
      parseCommitment(c, `${path}.commitments[${i}]`)
    ),
  };
}

const STATUSES: CommitmentStatus[] = ['normal', 'minimum', 'missed', null];

function parseMark(v: unknown, path: string): DayMark {
  const o = obj(v, path);
  const status = o.status === undefined ? null : (o.status as CommitmentStatus);
  if (!STATUSES.includes(status)) fail(`${path}.status`, 'debe ser normal, minimum, missed o null');
  const note = optionalStr(o, 'note', path);
  const mark: DayMark = { commitmentId: str(o, 'commitmentId', path), status };
  if (note !== undefined) mark.note = note;
  return mark;
}

function parseDay(v: unknown, path: string): DayEntry {
  const o = obj(v, path);
  return {
    date: isoDate(o, 'date', path),
    weekKey: str(o, 'weekKey', path),
    marks: list(o.marks, `${path}.marks`).map((m, i) => parseMark(m, `${path}.marks[${i}]`)),
  };
}

function parseReview(v: unknown, path: string): WeeklyReview {
  const o = obj(v, path);
  return {
    weekKey: str(o, 'weekKey', path),
    worked: str(o, 'worked', path),
    hindered: str(o, 'hindered', path),
    changeNext: str(o, 'changeNext', path),
    createdAt: str(o, 'createdAt', path),
  };
}

/** Valida un estado (el contenido de `data`) y devuelve una copia limpia. */
export function parseAppState(v: unknown, path = 'data'): AppState {
  const o = obj(v, path);
  return {
    profile: parseProfile(o.profile, `${path}.profile`),
    contracts: list(o.contracts, `${path}.contracts`).map((c, i) =>
      parseContract(c, `${path}.contracts[${i}]`)
    ),
    days: list(o.days, `${path}.days`).map((d, i) => parseDay(d, `${path}.days[${i}]`)),
    reviews: list(o.reviews, `${path}.reviews`).map((r, i) =>
      parseReview(r, `${path}.reviews[${i}]`)
    ),
  };
}

/**
 * Valida el texto de una copia. Nunca lanza: devuelve `{ok:false, error}`
 * con una explicación en lenguaje sencillo y la ruta del campo problemático.
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
  try {
    if (!isObject(raw)) fail('La copia', 'debe ser un objeto JSON');
    if (raw.app !== BACKUP_APP) {
      fail('Este archivo no es una copia de TITAN', `(falta el campo app = "${BACKUP_APP}").`);
    }
    if (raw.format !== BACKUP_FORMAT) {
      fail(
        `La copia usa el formato ${String(raw.format)}`,
        `y esta versión de la app sólo lee el formato ${BACKUP_FORMAT}.`
      );
    }
    const exportedAt = str(raw, 'exportedAt', 'copia');
    if (!('data' in raw)) fail('data', 'falta en la copia');
    const data = parseAppState(raw.data, 'data');
    return { ok: true, backup: { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt, data } };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message };
    return { ok: false, error: 'La copia no se pudo validar.' };
  }
}
