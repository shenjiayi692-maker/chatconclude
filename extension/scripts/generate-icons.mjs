import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function insideRoundedSquare(x, y, size) {
  const radius = size * 0.22;
  const left = radius;
  const right = size - radius;
  const top = radius;
  const bottom = size - radius;
  if ((x >= left && x < right) || (y >= top && y < bottom)) return true;
  const centerX = x < left ? left : right;
  const centerY = y < top ? top : bottom;
  return (x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2;
}

function nearLine(x, y, x1, y1, x2, y2, width) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const position = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  const lineX = x1 + position * dx;
  const lineY = y1 + position * dy;
  return (x - lineX) ** 2 + (y - lineY) ** 2 <= width ** 2;
}

function createPng(size) {
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    for (let x = 0; x < size; x += 1) {
      const offset = row + 1 + x * 4;
      const normalizedX = x / size;
      const normalizedY = y / size;
      let color = [0, 0, 0, 0];
      if (insideRoundedSquare(x, y, size)) color = [24, 24, 27, 255];
      if (
        normalizedX >= 0.25 &&
        normalizedX <= (normalizedY < 0.45 ? 0.74 : normalizedY < 0.62 ? 0.6 : 0.5) &&
        ((normalizedY >= 0.28 && normalizedY <= 0.36) ||
          (normalizedY >= 0.46 && normalizedY <= 0.54) ||
          (normalizedY >= 0.64 && normalizedY <= 0.72))
      ) {
        color = [250, 250, 250, 255];
      }
      const circleX = normalizedX - 0.71;
      const circleY = normalizedY - 0.68;
      if (circleX * circleX + circleY * circleY <= 0.17 * 0.17) {
        color = [52, 211, 153, 255];
      }
      if (
        nearLine(normalizedX, normalizedY, 0.64, 0.68, 0.69, 0.73, 0.025) ||
        nearLine(normalizedX, normalizedY, 0.69, 0.73, 0.79, 0.61, 0.025)
      ) {
        color = [5, 46, 36, 255];
      }
      scanlines.set(color, offset);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(resolve(root, "icons"), { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(resolve(root, `icons/icon-${size}.png`), createPng(size));
}
