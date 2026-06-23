const fs = require('fs');
const path = require('path');

const VERSION = '1.73.175';
const RELEASE_NOTES = 'v1.73.175: 系统电源控制UI集成 (高级设置→关机/重启/休眠/锁屏)';
const RELEASE_DATE = new Date().toISOString();

const files = {
  'win-x64_setup': {
    url: 'https://ide.zhejiangjinmo.com/downloads/LingJing-Setup-1.73.175-win-x64.exe',
    size: 142985884
  },
  'win-x64_portable': {
    url: 'https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-1.73.175-win-x64.exe',
    size: 142643895
  },
  'linux-x64_appimage': {
    url: 'https://ide.zhejiangjinmo.com/downloads/LingJing-1.73.175-linux-x86_64.AppImage',
    size: 183377135
  },
  'linux-x64_deb': {
    url: 'https://ide.zhejiangjinmo.com/downloads/LingJing-1.73.175-linux-x86_64.deb',
    size: 181089790
  }
};

// Read current versions.json
const inputPath = process.argv[2] || path.join(__dirname, 'versions.json.in');
let data;
try {
  data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch(e) {
  console.error('Failed to parse versions.json:', e.message);
  process.exit(1);
}

// Update latest
data.latest = VERSION;

// Add new entry to versions array
const newEntry = {
  version: VERSION,
  releaseDate: RELEASE_DATE,
  releaseNotes: RELEASE_NOTES,
  files: files
};
data.versions.unshift(newEntry);

// Add top-level key for backwards compatibility
data[VERSION] = {
  version: VERSION,
  releaseDate: RELEASE_DATE,
  releaseNotes: RELEASE_NOTES,
  files: files
};

// Output
const outputPath = process.argv[3] || path.join(__dirname, 'versions.json.out');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
console.log(`Updated versions.json: latest=${VERSION}, versions count=${data.versions.length}`);
console.log(`Written to: ${outputPath}`);
