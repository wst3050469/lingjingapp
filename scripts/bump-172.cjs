var fs=require('fs');
var ver='1.73.172';
var files=[
  'package.json',
  'packages/electron/package.json',
  'packages/core/package.json',
  'packages/renderer/package.json',
  'mobile/package.json'
];
files.forEach(f=>{
  var p=JSON.parse(fs.readFileSync(f,'utf8'));
  p.version=ver;
  fs.writeFileSync(f, JSON.stringify(p,null,2)+'\n');
  console.log('Updated: '+f+' -> '+ver);
});
var app=JSON.parse(fs.readFileSync('mobile/app.json','utf8'));
app.expo.version=ver;
if(!app.expo.android) app.expo.android={};
app.expo.android.versionCode=172;
fs.writeFileSync('mobile/app.json', JSON.stringify(app,null,2)+'\n');
console.log('Updated: mobile/app.json -> '+ver+' (vc:172)');
