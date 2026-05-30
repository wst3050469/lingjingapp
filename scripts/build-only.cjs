const { Client } = require('ssh2');

const SERVER = {
  host: '120.55.5.220',
  port: 22,
  username: 'root',
  password: 'WsT13575967132',
};

function log(msg) { console.log(`[${new Date().toISOString().substring(11, 19)}] ${msg}`); }

async function main() {
  log('=== Build Linux v1.50.0 ===');

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => { log('SSH connected'); resolve(); });
    conn.on('error', reject);
    conn.connect(SERVER);
  });

  // Check dist exists
  let r = await new Promise((resolve, reject) => {
    conn.exec('ls /root/lingjing-git/packages/core/dist/index.js', (e, s) => {
      let o = '';
      s.on('data', d => o += d);
      s.on('close', () => resolve(o.trim()));
    });
  });
  log('dist exists: ' + r);

  // Update version
  await new Promise((resolve, reject) => {
    conn.exec(`sed -i 's/"version": "1.49.0"/"version": "1.50.0"/g' /root/lingjing-git/packages/electron/package.json`, (e, s) => {
      s.on('close', () => resolve());
    });
  });
  
  // Copy dist to electron
  log('Copying dist...');
  await new Promise((resolve, reject) => {
    conn.exec('rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && cd /root/lingjing-git/packages/core && tar cf - dist | tar xf - -C /root/lingjing-git/packages/electron/node_modules/@codepilot/ && echo COPY_OK', (e, s) => {
      let o = '';
      s.on('data', d => o += d);
      s.on('close', () => { log('copy: ' + o.trim()); resolve(); });
    });
  });

  // Build main
  log('Building main.js (may take 1-2 min)...');
  await new Promise((resolve, reject) => {
    conn.exec('cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1', (e, s) => {
      let o = '';
      s.on('data', d => o += d);
      s.on('close', () => { log('main.js done'); resolve(); });
    });
  });

  // Build Linux installer
  log('Building Linux installer (may take 5-10 min)...');
  await new Promise((resolve, reject) => {
    conn.exec('cd /root/lingjing-git/packages/electron && npx electron-builder build --linux --x64 2>&1', (e, s) => {
      let o = '';
      s.on('data', d => o += d);
      s.on('close', () => { log('Linux build complete'); log(o); resolve(); });
    });
  });

  // List artifacts
  await new Promise((resolve, reject) => {
    conn.exec('ls -la /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-* 2>/dev/null || echo NO_FILES', (e, s) => {
      let o = '';
      s.on('data', d => o += d);
      s.on('close', () => { log('Artifacts:'); log(o); resolve(); });
    });
  });

  conn.end();
}

main().catch(err => { log('Error: ' + err.message); process.exit(1); });
