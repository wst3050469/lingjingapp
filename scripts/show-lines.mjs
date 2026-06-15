import { readFileSync } from 'fs';
const c = readFileSync('D:/lingjing-ide/desktop/electron/scripts/build-main.mjs', 'utf8');
const l = c.split('\n');
for (let i = 392; i < 397; i++) console.log(i + ': ' + l[i]);
