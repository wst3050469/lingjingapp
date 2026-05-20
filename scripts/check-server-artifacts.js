const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('ls -lh /root/artifacts-v1449.tar.gz 2>/dev/null && ls -lh /var/www/downloads/LingJing-1.44.9-linux* 2>/dev/null || echo "No Linux v1.44.9 files"', (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('close', () => { console.log(out); conn.end(); });
  });
});
conn.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
