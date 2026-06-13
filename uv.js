const fs = require('fs');  
const p = '/var/www/html/versions.json';  
const d = JSON.parse(fs.readFileSync(p, 'utf8'));  
d.latest = '1.73.47';  
d.versions.unshift({version:'1.73.47',date:'2026-06-13',status:'published',files:{'win-x64':'https://ide.zhejiangjinmo.com/downloads/LingJing-Setup-1.73.47-win-x64.exe','win-x64-portable':'https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-1.73.47-win-x64.exe'}});  
fs.writeFileSync(p, JSON.stringify(d, null, 2));  
console.log('OK');  
