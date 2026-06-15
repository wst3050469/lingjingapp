const fs = require('fs');
const path = '/var/www/html/versions.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Update latest version
data.latest = '1.73.86';
data.releaseDate = new Date().toISOString().split('T')[0];
data.releaseNotes = 'v1.73.86: fix v8 repair wrapper catch brace (SyntaxError crash)';

// Add new version entry
const newVer = {
  version: '1.73.86',
  status: 'published',
  releaseDate: new Date().toISOString(),
  releaseNotes: 'Hotfix: fix SyntaxError in v8 repair wrapper — catch(e3) missing closing brace',
  files: {
    'win-x64_setup': {
      url: '/downloads/1.73.86/灵境 Setup 1.73.86.exe',
      size: 195073108,
      type: 'setup'
    },
    'win-x64_portable': {
      url: '/downloads/1.73.86/LingJing-Portable-1.73.86-win-x64.exe',
      size: 194731607,
      type: 'portable'
    }
  }
};
data.versions.unshift(newVer);

// Add entry
data.entries.unshift({
  type: 'win-setup',
  version: '1.73.86',
  url: 'https://lingjing.zhejiangjinmo.com/downloads/1.73.86/灵境 Setup 1.73.86.exe',
  size: 195073108
});
data.entries.unshift({
  type: 'win-portable',
  version: '1.73.86',
  url: 'https://lingjing.zhejiangjinmo.com/downloads/1.73.86/LingJing-Portable-1.73.86-win-x64.exe',
  size: 194731607
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Updated versions.json: latest=' + data.latest + ' entries=' + data.versions.length);
