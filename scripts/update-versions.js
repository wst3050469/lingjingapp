const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/var/www/html/downloads/versions.json','utf8'));
const apk = {url:'/downloads/1.73.85/lingjing-mobile-1.73.85.apk',size:182414188,type:'apk'};
data.versions.forEach(v => { if(v.version==='1.73.85' && v.files) v.files['android-apk'] = apk; });
data.entries.unshift({type:'android-apk',version:'1.73.85',url:'https://lingjing.zhejiangjinmo.com/downloads/1.73.85/lingjing-mobile-1.73.85.apk',size:182414188});
fs.writeFileSync('/var/www/html/downloads/versions.json',JSON.stringify(data,null,2));
console.log('updated');
