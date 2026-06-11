// Generate PNG icons for LingJing Mobile app
// Pure Node.js — creates minimal but valid PNG files with gradient diamond logo
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createPNG(width, height, drawFn) {
  // PNG specification: http://www.libpng.org/pub/png/spec/1.2/PNG-Contents.html
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // Build pixel data
  const pixels = Buffer.alloc(width * height * 4); // RGBA
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x / width, y / height, x, y, width, height);
      const idx = (y * width + x) * 4;
      pixels[idx] = Math.round(r * 255);
      pixels[idx + 1] = Math.round(g * 255);
      pixels[idx + 2] = Math.round(b * 255);
      pixels[idx + 3] = Math.round(a * 255);
    }
  }
  
  // Add filter byte per row
  const rawData = Buffer.alloc(height + height * width * 4);
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0; // None filter
    pixels.copy(rawData, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  
  // Compress (deflate using zlib)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);
  
  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  
  function chunk(type, data) {
    const typeBuffer = Buffer.from(type, 'ascii');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const crcData = Buffer.concat([typeBuffer, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcData), 0);
    return Buffer.concat([length, typeBuffer, data, crcBuf]);
  }
  
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  
  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Color helpers
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v) { return Math.max(0, Math.min(1, v)); }

// Gradient: #0d1117 to #161b22
function bgColor(px, py) {
  const r = lerp(0x0d / 255, 0x16 / 255, (px + py) / 2);
  const g = lerp(0x11 / 255, 0x1b / 255, (px + py) / 2);
  const b = lerp(0x17 / 255, 0x22 / 255, (px + py) / 2);
  return [r, g, b, 1];
}

// Blue-purple gradient (#58a6ff → #7c3aed)
function crystalColor(t) {
  const r = lerp(0x58 / 255, 0x7c / 255, t);
  const g = lerp(0xa6 / 255, 0x3a / 255, t);
  const b = lerp(0xff / 255, 0xed / 255, t);
  return [r, g, b, 1];
}

function drawIcon(px, py, x, y, w, h) {
  const [br, bg, bb] = bgColor(px, py);
  
  // Center
  const cx = 0.5, cy = 0.45;
  const dx = px - cx;
  const dy = py - cy;
  
  // Diamond shape (灵 abstraction)
  const halfW = 0.28;
  const halfH = 0.30;
  const dist = Math.abs(dx) / halfW + Math.abs(dy) / halfH;
  
  // Outer diamond stroke
  const outerW = 0.32, outerH = 0.34;
  const outerDist = Math.abs(dx) / outerW + Math.abs(dy) / outerH;
  
  if (dist <= 1.0) {
    // Inside inner diamond
    const t = (dy / halfH + 1) / 2; // top-to-bottom gradient
    const [cr, cg, cb] = crystalColor(clamp(t));
    // Highlight in center
    const centerDist = Math.sqrt(dx * dx + dy * dy) / 0.15;
    const highlight = centerDist < 1 ? lerp(0.4, 0, centerDist) : 0;
    return [
      clamp(cr + highlight),
      clamp(cg + highlight),
      clamp(cb + highlight),
      1
    ];
  } else if (outerDist >= 0.95 && outerDist <= 1.05) {
    // Outer diamond stroke
    const t = (dy / outerH + 1) / 2;
    return [...crystalColor(clamp(t)), 1];
  }
  
  // Subtle glow ring
  const ringR = 0.30;
  const ringDist = Math.abs(Math.sqrt(dx * dx + dy * dy) - ringR);
  if (ringDist < 0.02) {
    const alpha = 0.15 * (1 - ringDist / 0.02);
    return [0.345, 0.651, 1.0, alpha]; // #58a6ff glow
  }
  
  // Rounded corners (mask)
  const cornerRadius = 0.04;
  const maxD = Math.max(Math.abs(dx * 2), Math.abs(dy * 2));
  if (maxD > 0.92 && Math.min(Math.abs(px), Math.abs(1 - px), Math.abs(py), Math.abs(1 - py)) < cornerRadius) {
    const cornerX = px < 0.5 ? px : 1 - px;
    const cornerY = py < 0.5 ? py : 1 - py;
    const cornerDist = Math.sqrt(Math.max(0, cornerRadius - cornerX) ** 2 + Math.max(0, cornerRadius - cornerY) ** 2);
    if (cornerDist > cornerRadius) return [br, bg, bb, 0]; // transparent corners
  }
  
  return [br, bg, bb, 1];
}

// Generate icons
const sizes = [
  { name: 'icon.png', size: 1024 },
  { name: 'adaptive-icon.png', size: 1024 },
  { name: 'favicon.png', size: 196 },
];

// We'll also generate splash.png
const assetsDir = path.join(__dirname, '..', 'assets');

console.log('Generating icons...');
for (const { name, size } of sizes) {
  const png = createPNG(size, size, drawIcon);
  fs.writeFileSync(path.join(assetsDir, name), png);
  console.log(`  ${name}: ${size}x${size} (${(png.length / 1024).toFixed(1)} KB)`);
}

// Generate splash.png (simple gradient with logo centered)
function drawSplash(px, py, x, y, w, h) {
  const [br, bg, bb] = bgColor(px, py);
  
  // Centered small logo
  const ratio = 0.35;
  const dx = (px - 0.5) / ratio;
  const dy = (py - 0.45) / ratio;
  const halfW = 0.28, halfH = 0.30;
  const dist = Math.abs(dx) / halfW + Math.abs(dy) / halfH;
  
  if (dist <= 1.0) {
    const t = (dy / halfH + 1) / 2;
    const [cr, cg, cb] = crystalColor(clamp(t));
    const centerDist = Math.sqrt(dx * dx + dy * dy) / 0.15;
    const highlight = centerDist < 1 ? lerp(0.3, 0, centerDist) : 0;
    return [clamp(cr + highlight), clamp(cg + highlight), clamp(cb + highlight), 1];
  }
  
  const outerW = 0.32, outerH = 0.34;
  const outerDist = Math.abs(dx) / outerW + Math.abs(dy) / outerH;
  if (outerDist >= 0.95 && outerDist <= 1.05) {
    const t = (dy / outerH + 1) / 2;
    return [...crystalColor(clamp(t)), 1];
  }
  
  const ringR = 0.30;
  const ringDist = Math.abs(Math.sqrt(dx * dx + dy * dy) - ringR);
  if (ringDist < 0.02) {
    return [0.345, 0.651, 1.0, 0.12];
  }
  
  return [br, bg, bb, 1];
}

const splash = createPNG(1284, 2778, drawSplash);
fs.writeFileSync(path.join(assetsDir, 'splash.png'), splash);
console.log(`  splash.png: 1284x2778 (${(splash.length / 1024).toFixed(1)} KB)`);

console.log('Done! Icons generated successfully.');
