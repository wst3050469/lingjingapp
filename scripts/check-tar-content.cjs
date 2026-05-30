const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec('tar -tzf /tmp/dist-fixed.tar.gz | head -5', (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.on('close', () => { console.log('Tar contents:\n' + o); c.end(); });
  });
});
c.on('error', e => { console.log('ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
