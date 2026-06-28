var fs=require('fs'),v='1.73.174';
['package.json','packages/electron/package.json','packages/core/package.json','packages/renderer/package.json','mobile/package.json'].forEach(function(f){var p=JSON.parse(fs.readFileSync(f,'utf8'));p.version=v;fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n')});
var a=JSON.parse(fs.readFileSync('mobile/app.json','utf8'));a.expo.version=v;if(!a.expo.android)a.expo.android={};a.expo.android.versionCode=174;fs.writeFileSync('mobile/app.json',JSON.stringify(a,null,2)+'\n');
console.log('v1.73.174');
