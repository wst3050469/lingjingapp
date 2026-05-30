const { Client } = require('ssh2');
const conn = new Client();

function log(m) { console.log(new Date().toISOString().substr(11,8) + ' ' + m); }

conn.on('ready', async () => {
  log('SSH ready');

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

  // 1. Check versions.json (count and latest)
  let r = await exec('cat /var/www/downloads/versions.json | node -e "const d=require(\"fs\").readFileSync(0,\"utf8\");const j=JSON.parse(d);console.log(\"latest:\",j.latest);console.log(\"count:\",j.versions.length);j.versions.slice(0,3).forEach(v=>console.log(\" \",v.version,v.status));j.versions.slice(-3).forEach(v=>console.log(\" ...\",v.version,v.status))"');
  log('versions: ' + r);

  // 2. Check what files are on the server
  r = await exec('ls -la /var/www/downloads/LingJing-*-android.apk 2>/dev/null | tail -3');
  log('Android APKs: ' + r);

  r = await exec('ls -la /var/www/downloads/LingJing-Setup-* 2>/dev/null | tail -5');
  log('Windows Setup: ' + r);

  r = await exec('ls -la /var/www/downloads/LingJing-*-linux-x86_64.AppImage 2>/dev/null | tail -5');
  log('Linux AppImage: ' + r);

  // 3. Check if v1.50.0 has linux files
  r = await exec('ls /var/www/downloads/LingJing-1.50.0-linux-* 2>/dev/null || echo NO_LINUX');
  log('v1.50.0 Linux: ' + r);

  // 4. Check currently deployed version on API
  r = await exec('curl -s https://ide.zhejiangjinmo.com/api/latest');
  log('API /latest: ' + r);

  conn.end();
});

conn.on('error', e => { log('SSH ERROR: ' + e.message); process.exit(1); });
conn.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
