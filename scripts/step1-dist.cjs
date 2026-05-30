const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec('rm -rf /tmp/build-dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && mkdir -p /tmp/build-dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && cd /tmp/build-dist && tar -xzf /tmp/dist-fixed.tar.gz && cd dist && tar cf - . | tar xf - -C /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && ls /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/index.js', (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => process.stderr.write(d));
    s.on('close', () => { console.log('RESULT:', o.trim()); c.end(); });
  });
});
c.on('error', e => { console.log('ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
