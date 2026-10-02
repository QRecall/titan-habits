import { describe, expect, it } from 'vitest';
import { isValidEndpoint, isValidId, madridParts, parseRows, rowFor } from './logic';

describe('madridParts', () => {
  it('invierno (UTC+1): 07:00 UTC son las 8', () => {
    expect(madridParts(new Date('2026-01-15T07:00:00Z'))).toEqual({ date: '2026-01-15', hour: 8 });
  });
  it('verano (UTC+2): 06:00 UTC son las 8 y 07:00 UTC las 9', () => {
    expect(madridParts(new Date('2026-07-15T06:00:00Z')).hour).toBe(8);
    expect(madridParts(new Date('2026-07-15T07:00:00Z')).hour).toBe(9);
  });
  it('días de cambio de hora', () => {
    expect(madridParts(new Date('2026-03-29T06:00:00Z')).hour).toBe(8);
    expect(madridParts(new Date('2026-10-25T07:00:00Z')).hour).toBe(8);
  });
  it('fecha local, no UTC', () => {
    expect(madridParts(new Date('2026-01-15T23:30:00Z'))).toEqual({ date: '2026-01-16', hour: 0 });
  });
});

describe('isValidId', () => {
  it('22 caracteres base64url', () => {
    expect(isValidId('AbCdEfGhIjKlMnOpQrSt_-')).toBe(true);
    expect(isValidId('corto')).toBe(false);
    expect(isValidId('AbCdEfGhIjKlMnOpQrSt/+')).toBe(false);
    expect(isValidId(42)).toBe(false);
  });
});

describe('isValidEndpoint', () => {
  it('solo servicios push conocidos por https', () => {
    expect(isValidEndpoint('https://web.push.apple.com/QGx0')).toBe(true);
    expect(isValidEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isValidEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isValidEndpoint('https://evil.example.com/web.push.apple.com/')).toBe(false);
    expect(isValidEndpoint('http://web.push.apple.com/x')).toBe(false);
    expect(isValidEndpoint(null)).toBe(false);
  });
});

describe('parseRows', () => {
  const ok = [{ date: '2026-09-21', streak: 3, pending: 2 }, { date: '2026-09-22', streak: 0, pending: null }];
  it('acepta filas válidas', () => {
    expect(parseRows(ok)).toEqual(ok);
  });
  it('rechaza lo demás', () => {
    expect(parseRows([])).toBeNull();
    expect(parseRows('x')).toBeNull();
    expect(parseRows([{ date: '21/09/2026', streak: 1, pending: 1 }])).toBeNull();
    expect(parseRows([{ date: '2026-09-21', streak: -1, pending: 1 }])).toBeNull();
    expect(parseRows([{ date: '2026-09-21', streak: 1.5, pending: 1 }])).toBeNull();
    expect(parseRows(Array.from({ length: 15 }, () => ok[0]))).toBeNull();
  });
  it('descarta campos de más', () => {
    expect(parseRows([{ ...ok[0], name: 'secreto' }])).toEqual([ok[0]]);
  });
});

describe('rowFor', () => {
  it('encuentra la fila del día o null', () => {
    const rows = [{ date: '2026-09-21', streak: 3, pending: 2 }];
    expect(rowFor(rows, '2026-09-21')).toEqual(rows[0]);
    expect(rowFor(rows, '2026-09-22')).toBeNull();
    expect(rowFor(undefined, '2026-09-21')).toBeNull();
  });
});
