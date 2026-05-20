const https = require('https');
https.get('https://ide.zhejiangjinmo.com/versions.json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('Latest:', json.latest);
    console.log('Top-level files:', Object.keys(json.files || {}).join(', '));
    const v = json.versions.find(x => x.version === json.latest);
    console.log(v ? JSON.stringify(v.files, null, 2) : 'No entry');
  });
});
