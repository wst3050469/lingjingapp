const d = JSON.parse(require('fs').readFileSync('/var/www/html/versions.json','utf8'));
const v183 = d.versions.filter(v => v.version === '1.73.85');
console.log('1.73.85 entries:', v183.length);
console.log('Latest:', d.latest);
console.log('Total versions:', d.versions.length);
console.log('Total entries:', d.entries?.length || 0);
