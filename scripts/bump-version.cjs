// Bump version from 1.73.162 to 1.73.163
var fs = require('fs');

var files = [
  'D:/lingjing/lingjing/package.json',
  'D:/lingjing/lingjing/packages/electron/package.json',
  'D:/lingjing/lingjing/packages/core/package.json',
  'D:/lingjing/lingjing/packages/renderer/package.json',
];

files.forEach(function(f) {
  var p = JSON.parse(fs.readFileSync(f, 'utf-8'));
  var old = p.version;
  p.version = '1.73.163';
  fs.writeFileSync(f, JSON.stringify(p, null, 2));
  console.log(f.split('/').pop() + ': ' + old + ' -> ' + p.version);
});

// Mobile
var mp = JSON.parse(fs.readFileSync('D:/lingjing/lingjing/mobile/package.json', 'utf-8'));
console.log('mobile pkg: ' + mp.version + ' -> 1.73.163');
mp.version = '1.73.163';
fs.writeFileSync('D:/lingjing/lingjing/mobile/package.json', JSON.stringify(mp, null, 2));

var ma = JSON.parse(fs.readFileSync('D:/lingjing/lingjing/mobile/app.json', 'utf-8'));
console.log('app.json: ' + ma.expo.version + ' -> 1.73.163');
ma.expo.version = '1.73.163';
ma.expo.android = ma.expo.android || {};
ma.expo.android.versionCode = 83;
fs.writeFileSync('D:/lingjing/lingjing/mobile/app.json', JSON.stringify(ma, null, 2));
