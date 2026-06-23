const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const DIR = '/var/www/downloads';

const files = {
  'LingJing-Setup-1.73.167-win-x64.exe': 'win-x64_setup',
  'LingJing-Portable-1.73.167-win-x64.exe': 'win-x64_portable',
  'LingJing-1.73.167-linux-x86_64.AppImage': 'linux-x64_appimage',
  'LingJing-1.73.167-linux-x86_64.deb': 'linux-x64_deb',
  'LingJing-Mobile-1.73.167.apk': 'android',
};

const V = '1.73.167';
const epoch = new Date().toISOString();

// Build versions.json entry
const versionsEntry = { version: V, releaseDate: epoch, releaseNotes: 'v1.73.167: mic recording 60s timeout auto-stop', files: {} };
for (const [fname, key] of Object.entries(files)) {
  const fpath = path.join(DIR, fname);
  if (fs.existsSync(fpath)) {
    versionsEntry.files[key] = {
      url: 'https://ide.zhejiangjinmo.com/downloads/' + fname,
      size: fs.statSync(fpath).size,
    };
  }
}

// Read existing versions.json
const vj = JSON.parse(fs.readFileSync(path.join(DIR, 'versions.json'), 'utf8'));
// Check if this version already exists
const existingIdx = vj.versions.findIndex(function(x) { return x.version === V; });
if (existingIdx >= 0) {
  vj.versions[existingIdx] = versionsEntry;
} else {
  vj.versions.unshift(versionsEntry);
  // Keep top 20
  if (vj.versions.length > 20) vj.versions = vj.versions.slice(0, 20);
}
vj.latest = V;
fs.writeFileSync(path.join(DIR, 'versions.json'), JSON.stringify(vj, null, 2));

// Update latest.yml
const setupFile = 'LingJing-Setup-1.73.167-win-x64.exe';
const setupPath = path.join(DIR, setupFile);
const setupHash = crypto.createHash('sha512').update(fs.readFileSync(setupPath)).digest('base64');
const setupSize = fs.statSync(setupPath).size;
const latestYml = [
  'version: ' + V,
  'files:',
  '  - url: https://ide.zhejiangjinmo.com/downloads/' + setupFile,
  '    sha512: ' + setupHash,
  '    size: ' + setupSize,
  'path: ' + setupFile,
  'sha512: ' + setupHash,
  'releaseDate: ' + epoch,
  '',
].join('\n');
fs.writeFileSync(path.join(DIR, 'latest.yml'), latestYml);

// Update latest-linux.yml
const appimageFile = 'LingJing-1.73.167-linux-x86_64.AppImage';
const appimagePath = path.join(DIR, appimageFile);
const appimageHash = crypto.createHash('sha512').update(fs.readFileSync(appimagePath)).digest('base64');
const appimageSize = fs.statSync(appimagePath).size;
const latestLinuxYml = [
  'version: ' + V,
  'files:',
  '  - url: https://ide.zhejiangjinmo.com/downloads/' + appimageFile,
  '    sha512: ' + appimageHash,
  '    size: ' + appimageSize,
  'path: ' + appimageFile,
  'sha512: ' + appimageHash,
  'releaseDate: ' + epoch,
  '',
].join('\n');
fs.writeFileSync(path.join(DIR, 'latest-linux.yml'), latestLinuxYml);

// Update version.json (Android OTA)
const apkFile = 'LingJing-Mobile-1.73.167.apk';
const apkPath = path.join(DIR, apkFile);
const apkSize = fs.statSync(apkPath).size;
const av = {
  version: V,
  versionCode: 167,
  apkUrl: 'https://ide.zhejiangjinmo.com/downloads/' + apkFile,
  fileSize: apkSize,
  releaseDate: epoch,
  releaseNotes: 'v1.73.167: mic recording 60s timeout auto-stop',
};
fs.writeFileSync(path.join(DIR, 'version.json'), JSON.stringify(av, null, 2));

// Sync to html dir
fs.copyFileSync(path.join(DIR, 'versions.json'), '/var/www/html/versions.json');
fs.copyFileSync(path.join(DIR, 'versions.json'), '/root/cloud-server/versions.json');

console.log('OTA v' + V + ' updated:');
for (const [fname, key] of Object.entries(files)) {
  console.log('  ' + key + ': ' + versionsEntry.files[key].size + ' bytes');
}
