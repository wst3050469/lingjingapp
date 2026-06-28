var fs=require('fs');
var files=[
  'package.json',
  'packages/electron/package.json',
  'packages/core/package.json',
  'packages/renderer/package.json',
  'mobile/package.json'
];
files.forEach(f=>{
  var p=JSON.parse(fs.readFileSync(f,'utf8'));
  p.version='1.73.171';
  fs.writeFileSync(f, JSON.stringify(p,null,2)+'\n');
  console.log('Updated: '+f+' -> 1.73.171');
});
// mobile/app.json
var app=JSON.parse(fs.readFileSync('mobile/app.json','utf8'));
app.expo.version='1.73.171';
if(!app.expo.android) app.expo.android={};
app.expo.android.versionCode=171;
fs.writeFileSync('mobile/app.json', JSON.stringify(app,null,2)+'\n');
console.log('Updated: mobile/app.json -> 1.73.171 (vc:171)');
