const fs = require('fs');
// Also update the primary versions.json read by the update server
const paths = ['/var/www/html/versions.json', '/var/www/html/downloads/versions.json'];
for (const p of paths) {
  if (!fs.existsSync(p)) { console.log('SKIP (not found):', p); continue; }
  const data = JSON.parse(fs.readFileSync(p,'utf8'));
  const apk = {url:'/downloads/1.73.85/lingjing-mobile-1.73.85.apk',size:182414188,type:'apk'};
  let changed = false;
  if (data.versions) {
    data.versions.forEach(v => {
      if (v.version === '1.73.85' && v.files) {
        if (!v.files['android-apk']) { v.files['android-apk'] = apk; changed = true; }
      }
    });
  }
  if (data.entries) {
    const exists = data.entries.some(e => e.type === 'android-apk' && e.version === '1.73.85');
    if (!exists) {
      data.entries.unshift({type:'android-apk',version:'1.73.85',url:'https://lingjing.zhejiangjinmo.com/downloads/1.73.85/lingjing-mobile-1.73.85.apk',size:182414188});
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    console.log('UPDATED:', p);
  } else {
    console.log('UNCHANGED:', p);
  }
}
