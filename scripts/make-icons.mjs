/**
 * Generates the PWA icons and favicon.
 *
 * PNGs are written byte by byte with zlib rather than pulled from an
 * image library: it keeps the repo dependency-free for a build step that
 * runs once, and the artwork is simple enough to rasterise by hand.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/web/public');
mkdirSync(out, { recursive: true });

const AZUL = [29, 63, 99];
const CREAM = [250, 248, 244];
const BARRO = [193, 97, 60];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, paint) {
  // One RGB row per line, each prefixed with filter byte 0 (None).
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = paint(x, y, size);
      const at = y * (stride + 1) + 1 + x * 3;
      raw[at] = r;
      raw[at + 1] = g;
      raw[at + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filtering
  ihdr[12] = 0;  // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * The mark: an azulejo diamond on cobalt, with a terracotta centre.
 * Distance is measured in the rotated (diamond) metric so the edges are
 * straight rather than round.
 */
function paintIcon(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const d = (Math.abs(x - cx) + Math.abs(y - cy)) / (size / 2);

  if (d < 0.2) return BARRO;
  if (d < 0.26) return CREAM;
  if (d < 0.52) return AZUL;
  if (d < 0.60) return CREAM;
  if (d < 0.9) return AZUL;

  // Corner quarter-diamonds, echoing the tile pattern in the interface.
  const corner = Math.min(
    x + y,
    (size - x) + y,
    x + (size - y),
    (size - x) + (size - y),
  ) / (size / 2);
  if (corner < 0.34) return CREAM;
  return AZUL;
}

writeFileSync(resolve(out, 'icon-192.png'), png(192, paintIcon));
writeFileSync(resolve(out, 'icon-512.png'), png(512, paintIcon));

writeFileSync(
  resolve(out, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#1d3f63"/>
  <path d="M32 6 58 32 32 58 6 32Z" fill="none" stroke="#faf8f4" stroke-width="3"/>
  <path d="M32 17 47 32 32 47 17 32Z" fill="#faf8f4"/>
  <circle cx="32" cy="32" r="6" fill="#c1613c"/>
</svg>
`,
);

console.log('icons written to apps/web/public');
