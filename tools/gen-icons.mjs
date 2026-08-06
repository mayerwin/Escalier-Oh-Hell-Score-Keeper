/**
 * Generate the app icons.
 *
 * Writes real PNGs with no image library: raw RGBA scanlines, zlib from the
 * standard library, and hand-rolled CRC32 for the chunk framing. Keeping this
 * in the repo means the icons are reproducible from source rather than being
 * opaque binaries somebody has to trust.
 *
 *   node tools/gen-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'assets', 'icons');

/* ------------------------------------------------------------------- png */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** Encode an RGBA pixel buffer (size*size*4) as a PNG. */
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // One filter byte (0 = None) in front of each scanline.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ art */

const BAIZE_TOP = [26, 58, 40];
const BAIZE_BOTTOM = [14, 32, 22];
const BRASS_TOP = [232, 190, 105];
const BRASS_BOTTOM = [162, 112, 28];

const lerp = (a, b, tt) => a + (b - a) * tt;
const mixColor = (a, b, tt) => [lerp(a[0], b[0], tt), lerp(a[1], b[1], tt), lerp(a[2], b[2], tt)];

/**
 * The mark: a four-step staircase rising to the right, brass on baize.
 * `inset` is the fraction of the canvas kept clear around the art — maskable
 * icons need a generous safe zone because launchers crop them to a circle.
 */
function drawIcon(size, { inset = 0.16, rounded = true, transparentCorners = true } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = rounded ? size * 0.22 : 0;

  const steps = 4;
  const span = 1 - inset * 2;
  const stepW = span / steps;
  const baseY = 1 - inset;
  /** Lit band along the top of each tread, as a fraction of one step's rise. */
  const treadLight = 0.16;

  const insideRounded = (x, y) => {
    if (!rounded) return true;
    const cx = Math.min(Math.max(x, radius), size - radius);
    const cy = Math.min(Math.max(y, radius), size - radius);
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const inCard = insideRounded(x + 0.5, y + 0.5);

      if (!inCard && transparentCorners) {
        rgba[i] = 0;
        rgba[i + 1] = 0;
        rgba[i + 2] = 0;
        rgba[i + 3] = 0;
        continue;
      }

      // Baize background, lit slightly from the top.
      let [r, g, b] = mixColor(BAIZE_TOP, BAIZE_BOTTOM, y / size);

      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;

      // The steps butt against each other so the silhouette reads as one
      // flight of stairs rather than four separate bars.
      if (u >= inset && u <= 1 - inset && v <= baseY) {
        const index = Math.min(steps - 1, Math.floor((u - inset) / stepW));
        const rise = span / steps;
        const topY = baseY - (index + 1) * rise;
        if (v >= topY) {
          const t = (v - topY) / Math.max(1e-6, baseY - topY);
          [r, g, b] = mixColor(BRASS_TOP, BRASS_BOTTOM, t);
          // Catch the light on the tread itself to give each step an edge.
          if (v - topY < rise * treadLight) {
            [r, g, b] = mixColor([r, g, b], [255, 244, 214], 0.55);
          }
        }
      }

      rgba[i] = Math.round(r);
      rgba[i + 1] = Math.round(g);
      rgba[i + 2] = Math.round(b);
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

function write(name, size, options) {
  const png = encodePng(size, drawIcon(size, options));
  writeFileSync(resolve(OUT, name), png);
  return png.length;
}

/* ------------------------------------------------------------------ svg */

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="L'Escalier">
  <defs>
    <linearGradient id="baize" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a3a28"/>
      <stop offset="1" stop-color="#0e2016"/>
    </linearGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8be69"/>
      <stop offset="1" stop-color="#a2701c"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#baize)"/>
  <!-- Contiguous steps: the same flight of stairs the PNGs draw. -->
  <path fill="url(#brass)" d="M10.24 42.88h10.88V32h10.88V21.12h10.88V10.24h10.88v43.52H10.24z"/>
  <g fill="#fff4d6" opacity="0.5">
    <rect x="10.24" y="42.88" width="10.88" height="1.7"/>
    <rect x="21.12" y="32" width="10.88" height="1.7"/>
    <rect x="32" y="21.12" width="10.88" height="1.7"/>
    <rect x="42.88" y="10.24" width="10.88" height="1.7"/>
  </g>
</svg>
`;

/* ----------------------------------------------------------------- main */

mkdirSync(OUT, { recursive: true });

const written = [
  ['favicon.svg', (writeFileSync(resolve(OUT, 'favicon.svg'), FAVICON_SVG), Buffer.byteLength(FAVICON_SVG))],
  ['icon-192.png', write('icon-192.png', 192, { inset: 0.16, rounded: true })],
  ['icon-512.png', write('icon-512.png', 512, { inset: 0.16, rounded: true })],
  // Maskable icons get cropped hard, so the art sits well inside the safe zone
  // and the background must reach every edge.
  ['maskable-512.png', write('maskable-512.png', 512, { inset: 0.26, rounded: false, transparentCorners: false })],
  ['apple-touch-icon.png', write('apple-touch-icon.png', 180, { inset: 0.16, rounded: false, transparentCorners: false })],
];

for (const [name, bytes] of written) {
  process.stdout.write(`${name.padEnd(24)} ${String(bytes).padStart(7)} bytes\n`);
}
