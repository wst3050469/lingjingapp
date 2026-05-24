const fs = require('fs');
const path = require('path');

const VERSION = '1.55.1';
const RELEASE_DATE = new Date().toISOString();
const RELEASE_NOTES = 'v1.55.1 修复: Web IDE 云同步显示"未连接"(No handler for cloud:connect)';

const newEntry = {
  version: VERSION,
  releaseDate: RELEASE_DATE,
  releaseNotes: RELEASE_NOTES,
  status: 'published',
  publishedAt: RELEASE_DATE,
  files: {
    'win-x64': {
      url: 'LingJing-Setup-1.55.1-win-x64.exe',
      size: 142145134,
      sha512: '3d80d6a8f297730456f872446d8f990afe5172df482906e1982c483a31c8e15d4326aec9d0ec568471f3bb46a51f79d965971dc932000586da01de60dedadff4'
    },
    'win-x64-portable': {
      url: 'LingJing-Portable-1.55.1-win-x64.exe',
      size: 141803639,
      sha512: '0de732254eca63bab4ea258e285b61ba5348577cae66c18facd8fda8b5a41e5e299e3561336d9e2a663b80be18f06a8062a54761c97b576d88d75dfc16a02454'
    },
    'win-x64-blockmap': {
      url: 'LingJing-Setup-1.55.1-win-x64.exe.blockmap',
      size: 148535
    },
    'android': {
      url: 'lingjing-mobile-v1.52.12.apk',
      size: 81479178
    }
  },
  features: [
    'CloudSyncTab Web模式降级：connectDirect()原生fetch+WebSocket替代Electron IPC',
    'cloudApi/cloudApiDirect 顺序修复(移到triggerAutoSync之前防ReferenceError)',
    'isWebMode()检测 + 所有CRUD操作支持Web直连'
  ]
};

// Update all versions.json files
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

for (const p of paths) {
  try {
    if (!fs.existsSync(p)) {
      console.log('SKIP (not found):', p);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    
    // Remove old entry for this version if exists
    data.versions = data.versions.filter(v => v.version !== VERSION);
    
    // Add new entry at the beginning
    data.versions.unshift(newEntry);
    
    // Update latest
    data.latest = VERSION;
    data.version = VERSION;
    
    // Update top-level files with win-x64
    data.files = data.files || {};
    data.files['win-x64'] = newEntry.files['win-x64'];
    data.files['win-x64-portable'] = newEntry.files['win-x64-portable'];
    data.files['win-x64-blockmap'] = newEntry.files['win-x64-blockmap'];
    data.files['android'] = newEntry.files['android'];
    
    data.updated = new Date().toISOString();
    
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
    console.log('UPDATED:', p);
  } catch (e) {
    console.log('ERROR:', p, e.message);
  }
}
