// Firma VAPID (RFC 8292) con WebCrypto y envío de un push sin contenido.

export type VapidKeys = { privateJwk: JsonWebKey; subject: string };

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}

/** Clave pública sin comprimir (0x04 ‖ x ‖ y) en base64url, a partir del JWK privado. */
export function publicKeyFromJwk(jwk: JsonWebKey): string {
  const out = new Uint8Array(65);
  out[0] = 4;
  out.set(fromB64url(jwk.x ?? ''), 1);
  out.set(fromB64url(jwk.y ?? ''), 33);
  return b64url(out);
}

const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

export async function vapidHeaders(endpoint: string, keys: VapidKeys, now = Date.now()): Promise<Record<string, string>> {
  const head = enc({ typ: 'JWT', alg: 'ES256' });
  const claims = enc({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 3600, sub: keys.subject });
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${claims}`));
  return {
    Authorization: `vapid t=${head}.${claims}.${b64url(sig)}, k=${publicKeyFromJwk(keys.privateJwk)}`,
    TTL: '14400',
    Urgency: 'normal',
  };
}

/** Envía un push vacío. Devuelve el código HTTP del servicio push. */
export async function sendPush(endpoint: string, keys: VapidKeys): Promise<number> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { ...(await vapidHeaders(endpoint, keys)), 'Content-Length': '0' },
  });
  return res.status;
}
