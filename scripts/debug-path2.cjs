const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec('cd /root/lingjing-git && ls -la packages/core/dist && ls packages/core/dist/index.js && cp -r packages/core/dist /tmp/test-cp 2>&1; echo "EXIT:$?"', (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.on('close', () => { console.log(o); c.end(); });
  });
});
c.on('error', e => { console.log('ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
