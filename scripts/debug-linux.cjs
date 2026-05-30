const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmds = [
    'ls -la /root/lingjing-git/packages/core/dist/ | head -5',
    'ls -la /root/lingjing-git/packages/electron/node_modules/@codepilot/core/ | head -5',
    'cat /root/lingjing-git/packages/electron/node_modules/@codepilot/core/package.json | grep version',
    'file /root/lingjing-git/packages/core/dist',
  ];
  let idx = 0;
  function runNext() {
    if (idx >= cmds.length) return c.end();
    c.exec(cmds[idx], (e, s) => {
      let o = '';
      s.on('data', d => o += d);
      s.on('close', () => { console.log(`>>> ${cmds[idx]}\n${o}`); idx++; runNext(); });
    });
  }
  runNext();
});
c.on('error', e => { console.log('ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
