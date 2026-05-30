const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  function exec(cmd) {
    return new Promise((res) => {
      c.exec(cmd, (err, s) => {
        let o = '';
        s.on('data', d => o += d);
        s.stderr.on('data', d => process.stderr.write('ERR: ' + d));
        s.on('close', () => res(o.trim()));
      });
    });
  }

  (async () => {
    // Test each step individually
    let r = await exec('rm -rf /tmp/build-dist /root/lingjing-git/packages/core/dist');
    console.log('rm:', r);

    r = await exec('mkdir -p /tmp/build-dist');
    console.log('mkdir:', r);

    r = await exec('cd /tmp/build-dist && tar -xzf /tmp/dist-fixed.tar.gz');
    console.log('tar:', r);

    r = await exec('ls /tmp/build-dist/dist/index.js && echo EXISTS');
    console.log('ls dist:', r);

    // Now copy this dist
    r = await exec('cp -r /tmp/build-dist/dist /root/lingjing-git/packages/core/');
    console.log('cp core:', r);

    r = await exec('ls /root/lingjing-git/packages/core/dist/index.js && echo CP_OK');
    console.log('verify:', r);
    
    // Copy to electron
    r = await exec('rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && cp -r /root/lingjing-git/packages/core/dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/');
    console.log('cp electron:', r);
    
    r = await exec('ls /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/index.js && echo FINAL_OK');
    console.log('final verify:', r);
    
    c.end();
  })();
});
c.on('error', e => { console.log('ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
