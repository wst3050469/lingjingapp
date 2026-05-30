const { Client } = require('ssh2');
const conn = new Client();

function log(m) { console.log(new Date().toISOString().substr(11,8) + ' ' + m); }

conn.on('ready', async () => {
  function exec(cmd) {
    return new Promise((res) => {
      conn.exec(cmd, (err, stream) => {
        let o = '';
        stream.on('data', d => o += d);
        stream.stderr.on('data', d => {});
        stream.on('close', () => res(o.trim()));
      });
    });
  }

  // Full versions.json
  let r = await exec('cat /var/www/downloads/versions.json');
  console.log('=== versions.json ===');
  console.log(r);
  
  log('---');
  
  // Check what files exist
  r = await exec('ls /var/www/downloads/LingJing-* 2>/dev/null | sort');
  console.log('=== All download files ===');
  console.log(r);

  conn.end();
});

conn.on('error', e => { log('ERR: ' + e.message); process.exit(1); });
conn.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
