/**
 * Generate StreamCaster PWA icons (192 + 512) as PNG from a hand-drawn
 * rasterizer. Pure Node (zlib) — no ImageMagick / PIL dependency.
 *
 * Run:  node scripts/gen-icons.mjs
 * Output: apps/sender/public/icon-192.png, apps/sender/public/icon-512.png
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "apps", "sender", "public");
mkdirSync(outDir, { recursive: true });

// ---- tiny raster helpers -------------------------------------------------

function makeCanvas(size) {
  return { size, buf: new Uint8Array(size * size * 4).fill(0) };
}

function setPx(c, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
  const i = (y * c.size + x) * 4;
  // alpha composite over existing
  const sa = a / 255;
  const da = c.buf[i + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return;
  const mix = (src, dst) => Math.round((src * sa + dst * da * (1 - sa)) / outA);
  c.buf[i] = mix(r, c.buf[i]);
  c.buf[i + 1] = mix(g, c.buf[i + 1]);
  c.buf[i + 2] = mix(b, c.buf[i + 2]);
  c.buf[i + 3] = Math.round(outA * 255);
}

function fillRoundedRect(c, x0, y0, x1, y1, radius, color) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = Math.min(x - x0, x1 - 1 - x);
      const dy = Math.min(y - y0, y1 - 1 - y);
      let inside = true;
      if (dx < radius && dy < radius) {
        const cx = x0 + radius, cy = y0 + radius;
        if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) inside = false;
      }
      if (dx < radius) {
        const cx = x1 - 1 - radius, cy = y0 + radius;
        if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) inside = false;
      }
      if (dy < radius) {
        const cx = x0 + radius, cy = y1 - 1 - radius;
        if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) inside = false;
      }
      if (dx < radius) {
        const cx = x1 - 1 - radius, cy = y1 - 1 - radius;
        if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) inside = false;
      }
      if (inside) setPx(c, x, y, color);
    }
  }
}

function strokeRoundedRect(c, x0, y0, x1, y1, radius, lw, color) {
  fillRoundedRect(c, x0, y0, x1, y1, radius, color);
  // punch interior back to the dark background (the screen is an outline, not
  // a transparent hole — matches the SVG mark).
  fillRoundedRect(
    c,
    x0 + lw,
    y0 + lw,
    x1 - lw,
    y1 - lw,
    Math.max(0, radius - lw),
    [11, 13, 18, 255]
  );
}

function fillTriangle(c, ax, ay, bx, by, cx, cy, color) {
  const minX = Math.floor(Math.min(ax, bx, cx));
  const maxX = Math.ceil(Math.max(ax, bx, cx));
  const minY = Math.floor(Math.min(ay, by, cy));
  const maxY = Math.ceil(Math.max(ay, by, cy));
  const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w0 = ((bx - ax) * (y + 0.5 - ay) - (x + 0.5 - ax) * (by - ay)) / area;
      const w1 = ((cx - bx) * (y + 0.5 - by) - (x + 0.5 - bx) * (cy - by)) / area;
      const w2 = ((ax - cx) * (y + 0.5 - cy) - (x + 0.5 - cx) * (ay - cy)) / area;
      if (w0 >= -0.001 && w1 >= -0.001 && w2 >= -0.001) setPx(c, x, y, color);
    }
  }
}

// ---- draw the logo -------------------------------------------------------

function drawIcon(size) {
  const c = makeCanvas(size);
  const bg = [11, 13, 18, 255]; // #0b0d12
  const accent = [79, 140, 255, 255]; // #4f8cff
  const light = [232, 235, 242, 255]; // #e8ebf2

  // outer rounded background (full bleed for maskable safety)
  fillRoundedRect(c, 0, 0, size, size, Math.round(size * 0.22), bg);

  // screen rectangle outline (echoes the SVG mark)
  const m = Math.round(size * 0.17);
  const sw = Math.max(2, Math.round(size * 0.05));
  strokeRoundedRect(c, m, m, size - m, size - Math.round(size * 0.30), Math.round(size * 0.06), sw, accent);

  // play triangle centered in the screen area
  const cx = size / 2;
  const cy = (m + (size - Math.round(size * 0.30))) / 2;
  const s = size * 0.16;
  fillTriangle(c, cx - s * 0.7, cy - s, cx - s * 0.7, cy + s, cx + s, cy, light);

  return c.buf;
}

// ---- PNG encoder ---------------------------------------------------------

const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // raw scanlines with filter 0
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const png = encodePng(drawIcon(size), size);
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}
