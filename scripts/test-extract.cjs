const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec('rm -rf /root/lingjing-git/packages/core/dist; cd /root/lingjing-git/packages/core && tar -xzf /tmp/dist1500.tar.gz && ls dist/index.js && echo "EXTRACT_OK"', (e, s) => {
    let o = '', er = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => er += d);
    s.on('close', () => { console.log('OUT:', o); console.log('ERR:', er); c.end(); });
  });
});
c.on('error', e => { console.log('ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
