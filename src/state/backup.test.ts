import { describe, expect, it } from 'vitest';
import type { AppState } from '../types';
import {
  BACKUP_FORMAT,
  backupFilename,
  createBackup,
  parseBackup,
  serializeBackup,
  summarizeBackup,
} from './backup';

const state: AppState = {
  profile: { name: 'Nacho', identity: 'alguien constante', onboardedAt: '2026-08-31T07:00:00.000Z' },
  contracts: [
    {
      weekKey: '2026-W36',
      startDate: '2026-08-31',
      signedAt: '2026-08-31',
      createdAt: '2026-08-31T07:00:00.000Z',
      commitments: [
        { id: 'a', name: 'Escribir', normal: '30 min', minimum: '3 frases', reason: 'r' },
        { id: 'b', name: 'Moverme', normal: '45 min', minimum: '10 flexiones', reason: '' },
      ],
    },
  ],
  days: [
    {
      date: '2026-08-31',
      weekKey: '2026-W36',
      marks: [
        { commitmentId: 'a', status: 'normal', note: 'Al amanecer' },
        { commitmentId: 'b', status: 'minimum' },
      ],
    },
    { date: '2026-09-01', weekKey: '2026-W36', marks: [{ commitmentId: 'a', status: null, note: 'x' }] },
  ],
  reviews: [
    { weekKey: '2026-W35', worked: 'w', hindered: 'h', changeNext: 'c', createdAt: '2026-08-30T20:00:00.000Z' },
  ],
};

const NOW = new Date(2026, 8, 6, 12, 30); // 6 sept 2026, hora local

describe('createBackup / serializeBackup', () => {
  it('envuelve el estado con app, versión de formato y fecha de exportación', () => {
    const b = createBackup(state, NOW);
    expect(b.app).toBe('titan');
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(b.exportedAt).toBe(NOW.toISOString());
    expect(b.data).toEqual(state);
  });

  it('serializa a JSON legible y vuelve a parsearse idéntico', () => {
    const text = serializeBackup(createBackup(state, NOW));
    expect(text).toContain('\n  "app": "titan"');
    const result = parseBackup(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup.data).toEqual(state);
  });

  it('nombre de archivo con fecha local', () => {
    expect(backupFilename(NOW)).toBe('titan-copia-2026-09-06.json');
  });
});

describe('parseBackup · rechaza copias inválidas sin lanzar', () => {
  function fails(text: string, fragment: string) {
    const r = parseBackup(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(fragment);
  }

  it('JSON roto', () => fails('{"app": "titan",', 'JSON'));
  it('no es un objeto', () => fails('[]', 'objeto'));
  it('otra app', () => fails('{"app":"gym","format":1,"exportedAt":"x","data":{}}', 'TITAN'));
  it('versión de formato desconocida', () =>
    fails('{"app":"titan","format":2,"exportedAt":"x","data":{}}', 'formato 2'));
  it('sin data', () => fails('{"app":"titan","format":1,"exportedAt":"x"}', 'data'));

  it('perfil con tipos incorrectos', () => {
    const b = createBackup(state, NOW) as unknown as { data: { profile: unknown } };
    b.data.profile = { name: 42, identity: 'x', onboardedAt: 'y' };
    fails(JSON.stringify(b), 'profile.name');
  });

  it('contrato con signedAt mal formado', () => {
    const b = createBackup(state, NOW);
    const broken = JSON.parse(JSON.stringify(b));
    broken.data.contracts[0].signedAt = '31/08/2026';
    fails(JSON.stringify(broken), 'contracts[0].signedAt');
  });

  it('marca con estado desconocido', () => {
    const b = createBackup(state, NOW);
    const broken = JSON.parse(JSON.stringify(b));
    broken.data.days[0].marks[1].status = 'done';
    fails(JSON.stringify(broken), 'days[0].marks[1].status');
  });

  it('contracts no es una lista', () => {
    const b = createBackup(state, NOW);
    const broken = JSON.parse(JSON.stringify(b));
    broken.data.contracts = {};
    fails(JSON.stringify(broken), 'contracts');
  });

  it('el estado local sin envoltorio no se acepta', () => {
    fails(JSON.stringify(state), 'app');
  });
});

describe('parseBackup · normaliza', () => {
  it('descarta campos desconocidos y conserva los conocidos', () => {
    const b = createBackup(state, NOW);
    const extra = JSON.parse(JSON.stringify(b));
    extra.data.extra = true;
    extra.data.profile.avatar = 'x';
    extra.data.contracts[0].commitments[0].emoji = '✍️';
    const r = parseBackup(JSON.stringify(extra));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.data).toEqual(state);
  });

  it('acepta perfil nulo y listas vacías', () => {
    const empty: AppState = { profile: null, contracts: [], days: [], reviews: [] };
    const r = parseBackup(serializeBackup(createBackup(empty, NOW)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.data).toEqual(empty);
  });
});

describe('summarizeBackup', () => {
  it('resume lo que contiene la copia', () => {
    const s = summarizeBackup(createBackup(state, NOW));
    expect(s).toEqual({
      exportedAt: NOW.toISOString(),
      profileName: 'Nacho',
      contracts: 1,
      weeks: ['2026-W36'],
      days: 2,
      marks: 2,
      notes: 2,
      reviews: 1,
    });
  });

  it('perfil nulo → nombre nulo', () => {
    const s = summarizeBackup(createBackup({ profile: null, contracts: [], days: [], reviews: [] }, NOW));
    expect(s.profileName).toBeNull();
    expect(s.marks).toBe(0);
  });
});
