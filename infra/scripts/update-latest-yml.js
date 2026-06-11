const fs = require('fs');

const winYml = {
  version: '1.55.1',
  files: [
    {
      url: 'LingJing-Setup-1.55.1-win-x64.exe',
      sha512: '3d80d6a8f297730456f872446d8f990afe5172df482906e1982c483a31c8e15d4326aec9d0ec568471f3bb46a51f79d965971dc932000586da01de60dedadff4',
      size: 142145134
    }
  ],
  path: 'LingJing-Setup-1.55.1-win-x64.exe',
  sha512: '3d80d6a8f297730456f872446d8f990afe5172df482906e1982c483a31c8e15d4326aec9d0ec568471f3bb46a51f79d965971dc932000586da01de60dedadff4',
  releaseDate: new Date().toISOString()
};

const linYml = {
  version: '1.55.1',
  files: [
    {
      url: 'LingJing-1.55.0-linux-x86_64.AppImage',
      sha512: '79767a1ac8dd691c010a765517892c7594b5bf8006f8fe65bc71f39656df43978eacfc91e141e58ccb660dfa5cce0cea73159c20379eb2c806ef1f6f5246a3f0',
      size: 182918602
    }
  ],
  path: 'LingJing-1.55.0-linux-x86_64.AppImage',
  sha512: '79767a1ac8dd691c010a765517892c7594b5bf8006f8fe65bc71f39656df43978eacfc91e141e58ccb660dfa5cce0cea73159c20379eb2c806ef1f6f5246a3f0',
  releaseDate: new Date().toISOString()
};

function toYaml(obj, indent) {
  indent = indent || '';
  let result = '';
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      result += indent + key + ':\n';
      for (const item of value) {
        if (typeof item === 'object') {
          result += indent + '  - ' + Object.entries(item).map(([k, v]) => k + ': ' + JSON.stringify(v)).join('\n' + indent + '    ') + '\n';
        }
      }
    } else if (typeof value === 'object') {
      result += indent + key + ':\n';
      result += toYaml(value, indent + '  ');
    } else {
      result += indent + key + ': ' + JSON.stringify(value) + '\n';
    }
  }
  return result;
}

const paths = ['/var/www/downloads/latest.yml', '/var/www/html/latest.yml', '/var/www/lingjing/latest.yml'];
for (const p of paths) {
  fs.writeFileSync(p, toYaml(winYml));
  console.log('UPDATED:', p);
}

const linPaths = ['/var/www/downloads/latest-linux.yml', '/var/www/html/latest-linux.yml', '/var/www/lingjing/latest-linux.yml'];
for (const p of linPaths) {
  fs.writeFileSync(p, toYaml(linYml));
  console.log('UPDATED:', p);
}
