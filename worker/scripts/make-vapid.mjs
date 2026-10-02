// Genera el par de claves VAPID. Escribe el JWK privado en el fichero indicado
// (para pasarlo a `wrangler secret put`) e imprime SOLO la clave pública.
import { writeFileSync } from 'node:fs';

const out = process.argv[2];
if (!out) throw new Error('Uso: node make-vapid.mjs <fichero-jwk-privado>');
const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', privateKey);
writeFileSync(out, JSON.stringify(jwk));
const b = (s) => Buffer.from(s, 'base64url');
console.log(Buffer.concat([Buffer.from([4]), b(jwk.x), b(jwk.y)]).toString('base64url'));
