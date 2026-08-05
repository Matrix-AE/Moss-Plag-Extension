"use strict";

// Deterministic PNG icons so store artifacts stay reproducible and no binary is hand-edited.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const SIZES = [16, 32, 48, 128];
const BACKGROUND = [99, 102, 241, 255];
const GLYPH = [255, 255, 255, 255];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// Linked code brackets + check: PairProof's "comparison verified" mark.
function pixelAt(size, x, y) {
  const unit = size / 16;
  const px = (x + 0.5) / unit;
  const py = (y + 0.5) / unit;
  const nearLine = (x1, y1, x2, y2, width = 0.72) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy) <= width;
  };
  const radius = size * 0.12;
  const corner =
    (x < radius && y < radius && (x - radius) ** 2 + (y - radius) ** 2 > radius ** 2) ||
    (x >= size - radius && y < radius && (x - (size - radius)) ** 2 + (y - radius) ** 2 > radius ** 2) ||
    (x < radius && y >= size - radius && (x - radius) ** 2 + (y - (size - radius)) ** 2 > radius ** 2) ||
    (x >= size - radius &&
      y >= size - radius &&
      (x - (size - radius)) ** 2 + (y - (size - radius)) ** 2 > radius ** 2);

  if (corner) {
    return [0, 0, 0, 0];
  }
  if (
    nearLine(6.5, 3.5, 3, 8) ||
    nearLine(3, 8, 6.5, 12.5) ||
    nearLine(9.5, 3.5, 13, 8) ||
    nearLine(13, 8, 9.5, 12.5) ||
    nearLine(6.4, 8.2, 7.8, 9.7, 0.6) ||
    nearLine(7.8, 9.7, 10.8, 6.1, 0.6)
  ) {
    return GLYPH;
  }
  return BACKGROUND;
}

function renderPng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixelAt(size, x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
      offset += 4;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function generateIcons(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const size of SIZES) {
    const file = path.join(outDir, `${size}.png`);
    fs.writeFileSync(file, renderPng(size));
    written.push(file);
  }
  return written;
}

if (require.main === module) {
  const outDir = path.resolve(__dirname, "../apps/extension/src/public/icon");
  const written = generateIcons(outDir);
  console.log(`Generated ${written.length} icons in ${outDir}`);
}

module.exports = { SIZES, generateIcons, renderPng };
