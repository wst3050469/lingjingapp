import { readFileSync, writeFileSync } from 'fs';

const files = [
  'package.json',
  'packages/electron/package.json',
  'packages/core/package.json',
  'packages/renderer/package.json',
  'mobile/package.json',
];
files.forEach(f => {
  const p = JSON.parse(readFileSync(f, 'utf8'));
  p.version = '1.73.171';
  writeFileSync(f, JSON.stringify(p, null, 2) + '\n');
  console.log(f + ' -> 1.73.171');
});

const appJson = JSON.parse(readFileSync('mobile/app.json', 'utf8'));
appJson.expo.version = '1.73.171';
appJson.expo.android.versionCode = 171;
appJson.expo.versionCode = 171;
writeFileSync('mobile/app.json', JSON.stringify(appJson, null, 2) + '\n');
console.log('mobile/app.json -> 1.73.171 (vc:171)');
