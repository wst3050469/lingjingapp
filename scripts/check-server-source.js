const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  conn.exec('cd /root/lingjing-git && git log --oneline -3 && echo "---" && cat packages/electron/package.json | head -3', (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('close', () => { console.log(out); conn.end(); });
  });
});

conn.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
