const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/var/www/lingjing/versions.json', 'utf8'));

// Update latest
data.latest = '1.71.1';

// Add v1.71.1 entry
const newEntry = {
  version: '1.71.1',
  status: 'published',
  releaseDate: '2026-06-07',
  releaseNotes: '4项遗留审计缺陷修复(BUG-007/008/014/DB-002) + 版本号统一升级',
  platforms: {
    'win-x64': {
      sha512: '9e6922d0c12cedf4b8163c69785b5eb7109a4459a530f192b9f92b3a3e1f1354b09d57164d1c1a0641fc9a28842f69c582368b9130e3b13fbe3224caa870aab9',
      size: 142398152
    },
    'win-x64-portable': {
      sha512: 'e5415fb215fa245ffe2898383629e932042a0627fb6bd055a2355e97456ff2d6e81f7cc2d6d9342f8269bd30fc0eebc433a7b4048973d158462e2d8b2a4dfb3a',
      size: 142170461
    }
  },
  files: {
    'win-x64': 'https://ide.zhejiangjinmo.com/downloads/灵境 Setup 1.71.1.exe',
    'win-x64-portable': 'https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-1.71.1-win-x64.exe'
  }
};

// Insert at top
data.versions.unshift(newEntry);

// Write back
fs.writeFileSync('/var/www/lingjing/versions.json', JSON.stringify(data, null, 2));
console.log('OK: latest=' + data.latest + ' count=' + data.versions.length);
