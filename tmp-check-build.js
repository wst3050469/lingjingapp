const fs = require('fs');
const files = [
  'D:/lingjing/lingjing/packages/electron/release/LingJing-Setup-1.64.1-win-x64.exe',
  'D:/lingjing/lingjing/packages/electron/release/LingJing-Portable-1.64.1-win-x64.exe'
];
for (const f of files) {
  const exists = fs.existsSync(f);
  const name = f.split('\\').pop() || f.split('/').pop();
  if (exists) {
    const sizeMB = Math.round(fs.statSync(f).size / 1024 / 1024);
    console.log('✅ ' + name + ' (' + sizeMB + 'MB)');
  } else {
    console.log('❌ ' + name + ' 不存在');
  }
}
