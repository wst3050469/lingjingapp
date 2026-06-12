const fs = require('fs');
const path = require('path');

const VERSION = process.argv[2] || '1.73.35';
const VERSION_CODE = parseInt(process.argv[3]) || 67;
const ROOT = path.resolve(__dirname, '..', '..');

const files = [
  'mobile/package.json',
  'mobile/app.json',
  'desktop/electron/package.json',
  'desktop/frontend/package.json',
  'desktop/core/package.json',
];

files.forEach(f => {
  const filePath = path.join(ROOT, f);
  if (!fs.existsSync(filePath)) {
    console.log('SKIP (missing): ' + f);
    return;
  }
  const d = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (d.expo) {
    d.expo.version = VERSION;
    d.expo.versionCode = VERSION_CODE;
  }
  if (d.version !== undefined) {
    d.version = VERSION;
  }
  fs.writeFileSync(filePath, JSON.stringify(d, null, 2) + '\n', 'utf8');
  console.log('OK: ' + f + ' -> ' + (d.expo ? d.expo.version : d.version));
});
