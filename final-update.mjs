const fs = require('fs');
const cp = require('child_process');
const p = '/var/www/html/versions.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));

// Update the v1.73.47 entry with correct SHA512
const v = d.versions.find(x => x.version === '1.73.47');
if (v) {
  v.sha512 = {
    'win-x64': '446aebead67253da1975621c2d1c6834441f5e6f49e0654736c345b60868fb2eab0e35ed0c2e2937580bd0cfc8ab71f1de9343fe1745a091287f7e479f0b2b53',
    'win-x64-portable': 'eee91768af4cd47a867563f450476ba0a6b07f89d666818fe5eeecd8f35669a2cb1e00bdb9e4cae1464fb6010a65662d699038496f31efb701463e67bdd430ca'
  };
}

fs.writeFileSync(p, JSON.stringify(d, null, 2));
console.log('versions.json updated with correct SHA512');

// Sync to all paths
const data = fs.readFileSync(p, 'utf8');
const paths = [
  '/var/www/lingjing/versions.json',
  '/var/www/downloads/versions.json',
  '/opt/lingjing/update-server/data/versions.json',
  '/opt/lingjing-update/data/versions.json',
  '/var/www/update-server/data/versions.json',
  '/root/lingjing-update/data/versions.json'
];
for (const pp of paths) {
  try { fs.writeFileSync(pp, data, 'utf8'); console.log('Synced:', pp); }
  catch(e) { console.log('Failed:', pp, e.message); }
}

cp.execSync('pm2 restart cloud-server', {stdio:'inherit'});
console.log('Done');
