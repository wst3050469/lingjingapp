const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  function exec(cmd) {
    return new Promise((res) => {
      c.exec(cmd, (err, s) => {
        let o = '';
        s.on('data', d => o += d);
        s.stderr.on('data', d => process.stderr.write(d));
        s.on('close', () => res(o));
      });
    });
  }

  (async () => {
    console.log('=== Debug extract ===');
    let r = await exec('rm -rf /tmp/test-dist && mkdir -p /tmp/test-dist && cd /tmp/test-dist && tar -xzf /tmp/dist-fixed.tar.gz && ls dist/index.js');
    console.log('1:', r);
    
    r = await exec('ls /tmp/test-dist/dist/index.js 2>&1');
    console.log('2:', r);
    
    r = await exec('cp -r /tmp/test-dist/dist /root/lingjing-git/packages/core/');
    console.log('3:', r);
    
    r = await exec('ls /root/lingjing-git/packages/core/dist/index.js && echo CP_OK');
    console.log('4:', r);
    
    c.end();
  })();
});
c.on('error', e => { console.log('ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
