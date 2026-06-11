const fs = require('fs');
const c = fs.readFileSync('electron-builder.json', 'utf8');
// Fix missing comma before "deb"
const result = c.replace(
  '    "artifactName": "LingJing-${version}-linux-x86_64.${ext}"\r\n    "deb": {',
  '    "artifactName": "LingJing-${version}-linux-x86_64.${ext}",\r\n    "deb": {'
);
fs.writeFileSync('electron-builder.json', result, 'utf8');
console.log('Fixed JSON syntax - added missing comma');
