const fs = require('fs');
const path = require('path');
const root = 'D:\\lingjing\\lingjing';
const files = [
  'package.json',
  'packages\\electron\\package.json',
  'packages\\renderer\\package.json',
  'packages\\core\\package.json',
  'app.json',
  'server\\app\\main.py',
  'android\\app\\build.gradle'
];

files.forEach(f => {
  const fullPath = path.join(root, f);
  let content = fs.readFileSync(fullPath, 'utf8');
  if (f.includes('build.gradle')) {
    content = content.replace(/versionCode \d+/, 'versionCode 28');
  }
  content = content.replace(/"1\.64\.4[4-6]"/g, '"1.64.47"');
  fs.writeFileSync(fullPath, content);
  console.log('Updated:', f);
});
