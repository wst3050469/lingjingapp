var fs=require('fs'); var ver='1.73.173';
['package.json','packages/electron/package.json','packages/core/package.json','packages/renderer/package.json','mobile/package.json'].forEach(f=>{var p=JSON.parse(fs.readFileSync(f,'utf8'));p.version=ver;fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n')});
var a=JSON.parse(fs.readFileSync('mobile/app.json','utf8'));a.expo.version=ver;if(!a.expo.android)a.expo.android={};a.expo.android.versionCode=173;fs.writeFileSync('mobile/app.json',JSON.stringify(a,null,2)+'\n');
console.log('v1.73.173 ready');
