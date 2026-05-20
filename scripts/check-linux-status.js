const https = require('https');

https.get('https://ide.zhejiangjinmo.com/versions.json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const v1449 = json.versions.find(v => v.version === '1.44.9');
    console.log('v1.44.9 files:', JSON.stringify(v1449?.files || {}, null, 2));
    console.log('\nTop-level files:', JSON.stringify(json.files || {}, null, 2));
    
    const hasLinux = v1449?.files?.['linux-x64'] || v1449?.files?.['linux-deb'];
    console.log('\nLinux builds present:', hasLinux ? 'YES ✅' : 'NO ❌ - NEEDS BUILD');
  });
});
