import fs from 'fs';

// Read JPEG header to get dimensions
const buffer = fs.readFileSync('public/images/siroi-bg.jpg');
let offset = 2;
let width = 0;
let height = 0;

while (offset < buffer.length) {
  if (buffer[offset] !== 0xFF) break;
  const marker = buffer[offset + 1];
  if (marker === 0xC0 || marker === 0xC2) {
    height = buffer.readUInt16BE(offset + 5);
    width = buffer.readUInt16BE(offset + 7);
    break;
  }
  const len = buffer.readUInt16BE(offset + 2);
  offset += 2 + len;
}

console.log(`Image dimensions: ${width}x${height}`);
