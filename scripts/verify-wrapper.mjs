import { readFileSync } from 'fs';
const c = readFileSync('D:/lingjing-ide/desktop/electron/dist/main.js', 'utf8');
const lines = c.split('\n');
let found = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('readdirSync') && lines[i].includes('withFileTypes')) {
    // Print surrounding lines
    for (let j = Math.max(0, i-1); j <= Math.min(lines.length-1, i+5); j++) {
      console.log((j+1) + ': ' + lines[j].substring(0, 120));
    }
    found = true;
    break;
  }
}
if (!found) console.log('Pattern not found');
