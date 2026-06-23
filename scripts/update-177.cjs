const { execSync } = require('child_process');
const fs = require('fs');
const json = execSync('ssh root@120.55.5.220 cat /var/www/downloads/versions.json', {encoding:'utf8'});
const d = JSON.parse(json);
d.latest = '1.73.177';
d.versions.unshift({version:'1.73.177',releaseDate:new Date().toISOString(),releaseNotes:'v1.73.177: 音量控制UI (滑块+静音)',files:{'win-x64_setup':{url:'https://ide.zhejiangjinmo.com/downloads/LingJing-Setup-1.73.177-win-x64.exe',size:142985917},'win-x64_portable':{url:'https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-1.73.177-win-x64.exe',size:142643928},'linux-x64_appimage':{url:'https://ide.zhejiangjinmo.com/downloads/LingJing-1.73.177-linux-x86_64.AppImage',size:183377085},'linux-x64_deb':{url:'https://ide.zhejiangjinmo.com/downloads/LingJing-1.73.177-linux-x86_64.deb',size:181090776}}});
d['1.73.177'] = d.versions[0];
fs.writeFileSync('scripts/versions-177.json', JSON.stringify(d,null,2));
console.log('OK latest='+d.latest+' count='+d.versions.length);
