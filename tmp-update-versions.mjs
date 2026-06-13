const fs = require('fs');
const path = '/var/www/html/versions.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
data.latest = '1.73.47';
data.versions.unshift({
  version: '1.73.47',
  date: new Date().toISOString().split('T')[0],
  status: 'published',
  files: {
    'win-x64': 'https://ide.zhejiangjinmo.com/downloads/LingJing-Setup-1.73.47-win-x64.exe',
    'win-x64-portable': 'https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-1.73.47-win-x64.exe'
  },
  sha512: '10ceab8b0e96e8061c0fa37a2e892dd8cf1d3cca9dbcd7e7ef436f36ebdd9f6de28540808a136df5bb34e216f407e89b33bc99c807f901f9688d4bce1aaf5a27'
});
fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Updated versions.json to v1.73.47');
