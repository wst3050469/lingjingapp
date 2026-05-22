const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec('sed -i s/1.49.0/1.50.0/g /root/lingjing-git/packages/electron/package.json && grep version /root/lingjing-git/packages/electron/package.json', (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.on('close', () => { console.log(o); c.end(); });
  });
});
c.on('error', e => { console.log('ERR:', e.message); process.exit(1); });
c.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
