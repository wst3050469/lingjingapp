var fs=require('fs'),v='1.73.175';
[
  'package.json',
  'mobile/package.json',
  'packages/core/package.json',
  'packages/electron/package.json',
  'packages/renderer/package.json',
].forEach(function(f){
  var p=JSON.parse(fs.readFileSync(f,'utf8'));
  p.version=v;
  fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n');
  console.log('Updated '+f+' -> '+v);
});
// mobile/app.json
var app=JSON.parse(fs.readFileSync('mobile/app.json','utf8'));
app.expo.version=v;
fs.writeFileSync('mobile/app.json',JSON.stringify(app,null,2)+'\n');
console.log('Updated mobile/app.json -> '+v);
console.log('v'+v);
