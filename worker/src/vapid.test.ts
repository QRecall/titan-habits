import { describe, expect, it } from 'vitest';
import { b64url, publicKeyFromJwk, vapidHeaders } from './vapid';

function fromB64url(s: string): Uint8Array {
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}

describe('vapidHeaders', () => {
  it('firma un JWT ES256 verificable con la clave pública del encabezado', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const now = Date.UTC(2026, 8, 21, 6, 0, 0);
    const h = await vapidHeaders('https://web.push.apple.com/QGx0abc', { privateJwk, subject: 'https://qrecall.github.io/titan-habits/' }, now);

    const m = /^vapid t=([^,]+), k=(.+)$/.exec(h.Authorization);
    expect(m).not.toBeNull();
    const [, jwt, k] = m!;
    expect(k).toBe(publicKeyFromJwk(privateJwk));
    expect(h.TTL).toBe('14400');

    const [head, claims, sig] = jwt.split('.');
    expect(JSON.parse(new TextDecoder().decode(fromB64url(head)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(JSON.parse(new TextDecoder().decode(fromB64url(claims)))).toEqual({
      aud: 'https://web.push.apple.com',
      exp: now / 1000 + 3600,
      sub: 'https://qrecall.github.io/titan-habits/',
    });

    const pub = await crypto.subtle.importKey('raw', fromB64url(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, fromB64url(sig), new TextEncoder().encode(`${head}.${claims}`));
    expect(ok).toBe(true);
  });
});

describe('b64url', () => {
  it('sin relleno ni + /', () => {
    expect(b64url(new Uint8Array([251, 255, 191]))).toBe('-_-_');
  });
});
