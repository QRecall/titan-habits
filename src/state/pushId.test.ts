import { describe, expect, it } from 'vitest';
import { base64url, fromBase64url, newPushId } from './pushId';

describe('pushId', () => {
  it('ida y vuelta base64url', () => {
    const b = new Uint8Array([0, 251, 255, 191, 7]);
    expect(Array.from(fromBase64url(base64url(b)))).toEqual(Array.from(b));
  });
  it('newPushId: 22 caracteres base64url y distintos', () => {
    const a = newPushId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newPushId()).not.toBe(a);
  });
});
