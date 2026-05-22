const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  function exec(cmd) {
    return new Promise((res) => {
      c.exec(cmd, (err, s) => {
        if (err) { console.log('EXEC ERR:', err.message); res(''); return; }
        let o = '';
        s.on('data', d => o += d);
        s.stderr.on('data', d => {});
        s.on('close', () => res(o.trim()));
      });
    });
  }
  (async () => {
    console.log('=== Test direct copy ===');
    let r = await exec('rm -rf /tmp/build-dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && mkdir -p /tmp/build-dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && cd /tmp/build-dist && tar -xzf /tmp/dist-fixed.tar.gz && cd dist && tar cf - . | tar xf - -C /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && ls /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/index.js');
    console.log('Result:', r);
    c.end();
  })();
});
c.on('error', e => { console.log('SSH ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
