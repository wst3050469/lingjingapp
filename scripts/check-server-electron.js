const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat /root/lingjing-git/packages/electron/package.json | grep version && ls /root/lingjing-git/packages/electron/node_modules/electron/dist 2>/dev/null && echo "electron installed" || echo "electron NOT installed"', (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('close', () => { console.log(out); conn.end(); });
  });
});
conn.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
