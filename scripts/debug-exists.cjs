const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmds = [
    'ls -la /root/lingjing-git/packages/core/dist 2>&1',
    'ls /root/lingjing-git/packages/core/dist/index.js 2>&1',
    'ls /tmp/dist1500.tar.gz 2>&1',
  ];
  let idx = 0;
  function runNext() {
    if (idx >= cmds.length) return c.end();
    c.exec(cmds[idx], (e, s) => {
      let o = '';
      s.on('data', d => o += d);
      s.on('close', () => { console.log(`CMD${idx}: ${o.trim()}`); idx++; runNext(); });
    });
  }
  runNext();
});
c.on('error', e => { console.log('ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
