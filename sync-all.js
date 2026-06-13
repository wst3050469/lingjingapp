const fs = require('fs'); const cp = require('child_process');  
const src = '/var/www/html/versions.json';  
const paths = ['/var/www/lingjing/versions.json','/var/www/downloads/versions.json','/opt/lingjing/update-server/data/versions.json','/opt/lingjing-update/data/versions.json','/var/www/update-server/data/versions.json','/root/lingjing-update/data/versions.json'];  
const data = fs.readFileSync(src, 'utf8');  
for (const p of paths) { try { fs.writeFileSync(p, data, 'utf8'); console.log('Synced:', p); } catch(e) { console.log('Failed:', p, e.message); } }  
cp.execSync('pm2 restart cloud-server', {stdio:'inherit'});  
