import { readFileSync } from 'fs';
const c = readFileSync('D:/lingjing-ide/desktop/electron/scripts/build-main.mjs', 'utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('catch') || l.includes('wrapper') || l.includes('repair') || l.includes('inject')) {
    console.log((i+1) + ': ' + l.trim().substring(0, 150));
  }
});
