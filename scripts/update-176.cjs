const fs = require('fs');
const VERSION = '1.73.176';
const RELEASE_NOTES = 'v1.73.176: 音频输出设备切换UI (设置→高级→扬声器选择)';
const RELEASE_DATE = new Date().toISOString();

const files = {
  'win-x64_setup': { url: 'https://ide.zhejiangjinmo.com/downloads/LingJing-Setup-1.73.176-win-x64.exe', size: 142989818 },
  'win-x64_portable': { url: 'https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-1.73.176-win-x64.exe', size: 142647830 },
  'linux-x64_appimage': { url: 'https://ide.zhejiangjinmo.com/downloads/LingJing-1.73.176-linux-x86_64.AppImage', size: 183377131 },
  'linux-x64_deb': { url: 'https://ide.zhejiangjinmo.com/downloads/LingJing-1.73.176-linux-x86_64.deb', size: 181088658 }
};

// Download from prod
const { execSync } = require('child_process');
const json = execSync('ssh root@120.55.5.220 cat /var/www/downloads/versions.json', { encoding: 'utf8' });
const data = JSON.parse(json);

data.latest = VERSION;
data.versions.unshift({ version: VERSION, releaseDate: RELEASE_DATE, releaseNotes: RELEASE_NOTES, files });
data[VERSION] = { version: VERSION, releaseDate: RELEASE_DATE, releaseNotes: RELEASE_NOTES, files };

fs.writeFileSync(__dirname + '/versions-176.json', JSON.stringify(data, null, 2));
console.log('Updated: latest=' + VERSION + ', versions=' + data.versions.length);
