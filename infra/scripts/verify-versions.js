const fs = require('fs');

const paths = [
  '/var/www/downloads/versions.json',
  '/var/www/html/versions.json',
  '/opt/lingjing/update-server/data/versions.json',
  '/var/www/lingjing/versions.json',
  '/opt/lingjing-update/data/versions.json',
  '/opt/lingjing-update-server/data/versions.json',
  '/var/www/update-server/data/versions.json',
  '/opt/lingjing-cloud-server/versions.json'
];

let first = null;
let allSame = true;
for (const p of paths) {
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const ver = d.latest;
    const info = { path: p, latest: ver, entries: d.versions.length, v0: d.versions[0]?.version };
    if (!first) first = info;
    else if (first.latest !== info.latest || first.v0 !== info.v0) {
      allSame = false;
      console.log('DIFF:', p, 'latest:', ver, 'expected:', first.latest);
    }
    console.log('OK:', p, 'latest=' + ver, 'entries=' + d.versions.length);
  } catch (e) {
    console.log('ERR:', p, e.message);
  }
}
console.log('\nAll consistent:', allSame);
