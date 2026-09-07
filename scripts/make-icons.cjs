/* Genera los iconos PNG de TITAN sin dependencias: la llama dorada sobre carbón.
 * Uso: node scripts/make-icons.cjs   → escribe public/icons/*.png
 * Rasteriza a mano (curvas Bézier aplanadas, relleno par-impar, degradados
 * radiales y supermuestreo 3×3) para no depender de ningún paquete.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------- PNG ---------- */
function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- geometría ---------- */
// Trazado SVG (sólo M, c relativos y z) → polígono.
function flatten(d) {
  // Tokens: letras de comando y números (los negativos pueden ir pegados: "51-8").
  const nums = d.match(/[Mcz]|-?\d*\.?\d+/g);
  const pts = [];
  let i = 0, cur = [0, 0];
  while (i < nums.length) {
    const t = nums[i++];
    if (t === 'M') { cur = [+nums[i++], +nums[i++]]; pts.push(cur); }
    else if (t === 'c') {
      while (i < nums.length && !isNaN(+nums[i])) {
        const p0 = cur;
        const p1 = [p0[0] + +nums[i++], p0[1] + +nums[i++]];
        const p2 = [p0[0] + +nums[i++], p0[1] + +nums[i++]];
        const p3 = [p0[0] + +nums[i++], p0[1] + +nums[i++]];
        for (let s = 1; s <= 24; s++) {
          const u = s / 24, v = 1 - u;
          pts.push([
            v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
            v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
          ]);
        }
        cur = p3;
      }
    } else if (t === 'z') { /* cierre implícito */ }
  }
  return pts;
}
function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function bbox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, w: x1 - x0, h: y1 - y0 };
}
function distToPoly(poly, x, y) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const px = ax + t * dx, py = ay + t * dy;
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}

/* ---------- color ---------- */
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function ramp(stops, t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      return mix(c0, c1, (t - t0) / (t1 - t0 || 1));
    }
  }
  return stops[stops.length - 1][1];
}
// Degradado radial en coordenadas de la caja del objeto (como objectBoundingBox).
function radial(box, cx, cy, r, stops, x, y) {
  const u = (x - box.x0) / box.w, v = (y - box.y0) / box.h;
  return ramp(stops, Math.hypot(u - cx, v - cy) / r);
}
const over = (dst, src, a) => mix(dst, src, a);

/* ---------- la llama (misma geometría que el SVG de la app) ---------- */
const OUTER = 'M60 10c5 15 20 21 29 36 11 17 11 35 1 51-8 15-21 24-30 27-9-3-22-12-30-27-10-16-10-34 1-51 9-15 24-21 29-36z';
const INNER = 'M60 42c3 9 12 13 18 22 8 11 8 23 1 33-5 8-13 13-19 15-6-2-14-7-19-15-7-10-7-22 1-33 6-9 15-13 18-22z';
const outer = flatten(OUTER), inner = flatten(INNER);
const outerBox = bbox(outer), innerBox = bbox(inner);

const OUTER_STOPS = [[0, hex('#FFE38F')], [0.55, hex('#F3C044')], [1, hex('#B86F12')]];
const INNER_STOPS = [[0, hex('#FFFBE6')], [0.6, hex('#FFE9A6')], [1, hex('#F0C25A')]];
const BG_TOP = hex('#1A1B21'), BG_BOTTOM = hex('#0B0B0D');
const GLOW = hex('#EFC66A'), RIM = hex('#9A5E10'), WHITE = [255, 255, 255];

// Espacio del icono: 120×120. La llama va con translate(0,-2) scale(0.86) translate(10,10)
// y, para maskable/apple, un encogido extra alrededor del centro (zona segura).
function sample(u, v, opts) {
  const { rounded, pad } = opts;
  // esquinas redondeadas (rx 27 de 120)
  if (rounded) {
    const r = 27;
    const cx = u < r ? r : u > 120 - r ? 120 - r : u;
    const cy = v < r ? r : v > 120 - r ? 120 - r : v;
    if ((u < r || u > 120 - r) && (v < r || v > 120 - r) && Math.hypot(u - cx, v - cy) > r) return null;
  }
  let col = mix(BG_TOP, BG_BOTTOM, v / 120);

  // deshacer transformaciones para muestrear la llama en su espacio (0..120)
  let x = u, y = v;
  if (pad) { x = (x - 60) / pad + 60; y = (y - 60) / pad + 60; }
  x = x / 0.86 - 10; y = (y + 2) / 0.86 - 10;

  // resplandor: elipse (60,70) rx 46 ry 48
  const g = Math.hypot((x - 60) / 46, (y - 70) / 48);
  if (g < 1) col = over(col, GLOW, 0.55 * (1 - g));

  if (inside(outer, x, y)) {
    col = radial(outerBox, 0.45, 0.62, 0.6, OUTER_STOPS, x, y);
    if (inside(inner, x, y)) col = radial(innerBox, 0.48, 0.7, 0.55, INNER_STOPS, x, y);
    // núcleo: elipse (60,98) rx 13 ry 15, blanco al 70 %
    const k = Math.hypot((x - 60) / 13, (y - 98) / 15);
    if (k < 1) col = over(col, WHITE, 0.7 * (1 - k * k));
    // borde oscuro (1.6 de ancho, 60 %)
    const d = distToPoly(outer, x, y);
    if (d < 0.8) col = over(col, RIM, 0.6 * (1 - d / 0.8));
  }
  return col;
}

function icon(size, opts) {
  const SS = 3; // supermuestreo
  return png(size, (px, py) => {
    let r = 0, g = 0, b = 0, a = 0;
    for (let i = 0; i < SS; i++) {
      for (let j = 0; j < SS; j++) {
        const u = ((px + (i + 0.5) / SS) * 120) / size;
        const v = ((py + (j + 0.5) / SS) * 120) / size;
        const c = sample(u, v, opts);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
      }
    }
    const n = SS * SS;
    if (a === 0) return [0, 0, 0, 0];
    return [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round((255 * a) / n)];
  });
}

const out = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });
const files = {
  'icon-192.png': icon(192, { rounded: true }),
  'icon-512.png': icon(512, { rounded: true }),
  'icon-maskable-512.png': icon(512, { rounded: false, pad: 0.8 }),
  'apple-touch-icon.png': icon(180, { rounded: false, pad: 0.92 }),
};
for (const [name, buf] of Object.entries(files)) {
  fs.writeFileSync(path.join(out, name), buf);
  console.log(name, buf.length + ' B');
}
