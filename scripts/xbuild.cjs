const SSH2 = require('ssh2');
const conn = new SSH2.Client();

function log(m) { console.log(new Date().toISOString().substr(11,8) + ' ' + m); }

conn.on('ready', async () => {
  log('SSH ready');
  
  function exec(cmd) {
    return new Promise((res, rej) => {
      conn.exec(cmd, (err, stream) => {
        if (err) return rej(err);
        let o = '';
        stream.on('data', d => o += d);
        stream.stderr.on('data', d => {});
        stream.on('close', () => res(o.trim()));
      });
    });
  }

  // 1. Copy dist
  log('Copying dist...');
  let r = await exec('cd /root/lingjing-git/packages/core && tar cf - dist | tar xf - -C /root/lingjing-git/packages/electron/node_modules/@codepilot/ && echo OK');
  log('Copy: ' + r);

  // 2. Build main
  log('Building main.js...');
  let output = '';
  await new Promise((res, rej) => {
    conn.exec('cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1', (err, stream) => {
      stream.on('data', d => output += d);
      stream.stderr.on('data', d => output += d);
      stream.on('close', () => res());
    });
  });
  log('main.js done. Output tail: ' + output.slice(-200));

  // 3. Build Linux installer
  log('Building Linux installer...');
  output = '';
  await new Promise((res, rej) => {
    conn.exec('cd /root/lingjing-git/packages/electron && npx electron-builder build --linux --x64 2>&1', (err, stream) => {
      stream.on('data', d => output += d);
      stream.stderr.on('data', d => output += d);
      stream.on('close', () => res());
    });
  });
  log('Linux build done. Output tail: ' + output.slice(-300));

  // 4. List artifacts
  r = await exec('ls -la /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-* 2>/dev/null || echo NO_FILES');
  log('Artifacts: ' + r);

  conn.end();
});

conn.on('error', e => { log('SSH ERROR: ' + e.message); process.exit(1); });
conn.connect({ host: '120.55.5.220', port: 22, username: 'root', password: 'WsT13575967132' });
