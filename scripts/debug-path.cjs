const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmds = [
    'cd /root/lingjing-git/packages/electron && ls -la ../core/dist/index.js && file ../core/dist',
    'cd /root/lingjing-git/packages/electron && ls -la ../core/dist/ | head -3',
    'cd /root/lingjing-git/packages/core && ls -la dist/index.js && pwd',
    'cd /root/lingjing-git/packages/core && file dist && stat dist',
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
