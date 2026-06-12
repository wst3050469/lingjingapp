// Update versions.json files with new version
const fs = require('fs');

const NEW_VERSION = process.argv[2] || '1.73.35';
const RELEASE_NOTES = process.argv[3] || 'v' + NEW_VERSION + ': 新版本发布';

const files = [
  '/var/www/html/versions.json',
  '/var/www/lingjing/versions.json',
  '/opt/lingjing/update-server/data/versions.json',
];

files.forEach(f => {
  try {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    d.latest = NEW_VERSION;

    const newEntry = {
      version: NEW_VERSION,
      status: 'published',
      releaseDate: new Date().toISOString(),
      releaseNotes: RELEASE_NOTES,
      platforms: {
        android: { size: 82585624, sha512: 'pending' }
      },
      files: {
        android: 'https://ide.zhejiangjinmo.com/downloads/lingjing-v' + NEW_VERSION + '.apk'
      }
    };
    d.versions.unshift(newEntry);
    fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf8');
    console.log('OK: ' + f + ' latest=' + d.latest);
  } catch (e) {
    console.log('SKIP: ' + f + ' - ' + e.message);
  }
});
