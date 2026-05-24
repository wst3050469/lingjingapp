const fs = require('fs');
const files = [
  './package.json',
  './packages/electron/package.json',
  './packages/renderer/package.json'
];
for (const f of files) {
  try {
    const d = JSON.parse(fs.readFileSync(f, 'utf-8'));
    d.version = '1.55.1';
    fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');
    console.log(f + ' -> 1.55.1');
  } catch(e) {
    console.log(f + ' SKIP: ' + e.message);
  }
}
