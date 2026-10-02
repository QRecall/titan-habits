/* Genera los iconos PNG de TITAN sin dependencias: la llama tricolor
 * (azul en la base, roja en el centro, amarilla en la punta) sobre carbón,
 * con viñeta, sombra proyectada y brillo.
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

// Degradados verticales (de abajo arriba): fuego tricolor y su interior claro.
const OUTER_STOPS = [[0, hex('#FFE38F')], [0.2, hex('#F3C044')], [0.55, hex('#F1552E')], [1, hex('#2F7BFF')]];
const INNER_STOPS = [[0, hex('#FFFBE6')], [0.5, hex('#FFD9B0')], [1, hex('#BFE3FF')]];
const BG_CENTER = hex('#23242C'), BG_EDGE = hex('#08080A');
const GLOW = hex('#EFC66A'), RIM = hex('#7A4A0E'), WHITE = [255, 255, 255], BLACK = [0, 0, 0];
const BORDER = hex('#F5F1E8');
// Degradado lineal vertical en la caja del objeto (0 = arriba, 1 = abajo).
function vertical(box, stops, y) {
  return ramp(stops, (y - box.y0) / box.h);
}

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
  // fondo con viñeta: más claro arriba-centro, oscuro en los bordes
  const vg = Math.hypot((u - 60) / 96, (v - 42) / 96);
  let col = mix(BG_CENTER, BG_EDGE, Math.min(1, vg));
  // filete interior sutil (1.5 px a 1 px del borde) sólo en iconos con esquinas
  if (rounded) {
    const r = 26;
    const cx = u < 1 + r ? 1 + r : u > 119 - r ? 119 - r : u;
    const cy = v < 1 + r ? 1 + r : v > 119 - r ? 119 - r : v;
    const dEdge = Math.abs(Math.hypot(u - cx, v - cy) - r);
    const straight = Math.min(Math.abs(u - 1), Math.abs(u - 119), Math.abs(v - 1), Math.abs(v - 119));
    const corner = (u < 1 + r || u > 119 - r) && (v < 1 + r || v > 119 - r);
    const dd = corner ? dEdge : straight;
    if (dd < 0.75) col = over(col, BORDER, 0.08 * (1 - dd / 0.75));
  }

  // deshacer transformaciones para muestrear la llama en su espacio (0..120)
  let x = u, y = v;
  if (pad) { x = (x - 60) / pad + 60; y = (y - 60) / pad + 60; }
  x = x / 0.86 - 10; y = (y + 3) / 0.86 - 10;

  // resplandor: elipse (60,72) rx 50 ry 52
  const g = Math.hypot((x - 60) / 50, (y - 72) / 52);
  if (g < 1) col = over(col, GLOW, 0.5 * (1 - g));

  // sombra proyectada: la silueta desplazada 4 hacia abajo, difuminada
  if (!inside(outer, x, y)) {
    const ds = distToPoly(outer, x, y - 4);
    const insideShadow = inside(outer, x, y - 4);
    const a = insideShadow ? 0.55 : Math.max(0, 0.55 * (1 - ds / 9));
    if (a > 0) col = over(col, BLACK, a);
  }

  if (inside(outer, x, y)) {
    col = vertical(outerBox, OUTER_STOPS, y);
    if (inside(inner, x, y)) col = vertical(innerBox, INNER_STOPS, y);
    // núcleo: elipse (60,98) rx 13 ry 15, blanco al 75 %
    const k = Math.hypot((x - 60) / 13, (y - 98) / 15);
    if (k < 1) col = over(col, WHITE, 0.75 * (1 - k * k));
    // brillo especular: trazo suave a la izquierda
    const hx = 40 + ((y - 54) / 33) * 0 - 6 * Math.sin(((y - 54) / 33) * Math.PI); // curva ligera
    if (y > 50 && y < 92) {
      const dh = Math.abs(x - (hx + 2));
      if (dh < 5) col = over(col, hex('#FFF6D6'), 0.55 * (1 - dh / 5) * Math.sin(((y - 50) / 42) * Math.PI));
    }
    // borde oscuro (1.8 de ancho, 50 %)
    const d = distToPoly(outer, x, y);
    if (d < 0.9) col = over(col, RIM, 0.5 * (1 - d / 0.9));
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
