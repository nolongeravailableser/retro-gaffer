/**
 * Generate the PWA icons (public/icon-192.png, public/icon-512.png) with zero
 * image dependencies: a minimal PNG encoder over node:zlib.
 *
 * Design: the night-pitch palette — dark green with mow stripes, a white ball
 * centre-circle, and a CRT-green ring. Run manually: node scripts/generate_icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const DARK = hex('#0a1f12');
const LIGHT = hex('#10301c');
const GREEN = hex('#39ff14');
const WHITE = hex('#f5f7f2');

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const stripe = size / 7;
  const ringR = size * 0.42;
  const ringW = size * 0.035;
  const ballR = size * 0.17;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // pitch + mow stripes
      let [r, g, b] = Math.floor(x / stripe) % 2 === 0 ? DARK : LIGHT;
      const d = Math.hypot(x - cx, y - cy);
      // CRT-green ring
      if (Math.abs(d - ringR) <= ringW) [r, g, b] = GREEN;
      // centre-circle "ball"
      if (d <= ballR) [r, g, b] = WHITE;
      if (d <= ballR && d >= ballR - size * 0.02) [r, g, b] = DARK; // ball outline
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = 255;
    }
  }
  return encodePng(size, size, px);
}

mkdirSync('public', { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icon-${size}.png`, drawIcon(size));
  console.log(`public/icon-${size}.png written`);
}
