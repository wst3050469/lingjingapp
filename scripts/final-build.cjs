const { Client } = require('ssh2');

const SERVER = {
  host: '120.55.5.220',
  port: 22,
  username: 'root',
  password: 'WsT13575967132',
};

const VERSION = '1.50.0';
const REMOTE_DL = '/var/www/downloads';

function log(msg) { console.log(`[${new Date().toISOString().substring(11, 19)}] ${msg}`); }

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '', stderr = '';
      stream.on('data', d => { stdout += d.toString(); });
      stream.stderr.on('data', d => { stderr += d.toString(); });
      stream.on('close', code => resolve({ code, stdout, stderr }));
    });
  });
}

async function main() {
  log('=== Final Build Linux v1.50.0 ===');

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => { log('SSH connected'); resolve(); });
    conn.on('error', reject);
    conn.connect(SERVER);
  });

  // Verify dist exists
  let r = await exec(conn, 'ls /root/lingjing-git/packages/core/dist/index.js');
  log(`  dist verified: ${r.stdout.trim()}`);
  
  // Update version
  await exec(conn, `cd /root/lingjing-git && sed -i 's/"version": "1.49.0"/"version": "1.50.0"/g' packages/electron/package.json packages/renderer/package.json package.json`);
  r = await exec(conn, `grep '"version"' /root/lingjing-git/packages/electron/package.json`);
  log(`  version: ${r.stdout.trim()}`);

  // Copy dist
  log('  Copy dist to electron node_modules...');
  r = await exec(conn, 'rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && mkdir -p /root/lingjing-git/packages/electron/node_modules/@codepilot/core && cd /root/lingjing-git/packages/core && tar cf - dist | tar xf - -C /root/lingjing-git/packages/electron/node_modules/@codepilot/ && ls /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/index.js && echo "COPY_OK"');
  log(`  copy: ${r.stdout.trim()}`);

  // Build main
  log('  Building main.js...');
  r = await exec(conn, 'cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1');
  log(`  main build: exit=${r.code}`);

  if (r.code !== 0) {
    log('  ERROR building main - checking stderr');
    const errLines = r.stderr.split('\n').filter(l => l.trim()).slice(-10);
    errLines.forEach(l => log(`  ${l}`));
    conn.end();
    return;
  }

  // Build Linux
  log('  Building Linux installer...');
  r = await exec(conn, 'cd /root/lingjing-git/packages/electron && npx electron-builder build --linux --x64 2>&1');
  log(`  linux build: exit=${r.code}`);
  log(`  last lines: ${r.stdout.split('\n').filter(l => l.trim()).slice(-3).join(' | ')}`);

  if (r.code !== 0 || !r.stdout.includes('released')) {
    log('  ERROR building Linux installer');
    if (r.stderr) {
      r.stderr.split('\n').filter(l => l.trim()).slice(-10).forEach(l => log(`  ${l}`));
    }
    conn.end();
    return;
  }

  // Find artifacts
  log('  Finding Linux artifacts...');
  r = await exec(conn, 'ls /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-* 2>/dev/null');
  const linuxFiles = r.stdout.trim().split('\n').filter(Boolean);
  log(`  Found ${linuxFiles.length} files`);

  // Copy to download dir
  for (const lf of linuxFiles) {
    const name = lf.split('/').pop();
    log(`  Copy ${name}...`);
    await exec(conn, `cp "${lf}" ${REMOTE_DL}/${name}`);
  }

  // Update latest-linux.yml
  log('  Updating latest-linux.yml...');
  const appImage = linuxFiles.find(f => f.includes('.AppImage'));
  const debFile = linuxFiles.find(f => f.includes('.deb'));

  let linuxYml = `version: ${VERSION}\nfiles:\n`;
  for (const lf of [appImage, debFile].filter(Boolean)) {
    const name = lf.split('/').pop();
    const hashR = await exec(conn, `openssl dgst -sha512 -binary "${lf}" | base64 -w0`);
    const sizeR = await exec(conn, `stat -c%s "${lf}"`);
    linuxYml += `  - url: ${name}\n    sha512: ${hashR.stdout.trim()}\n    size: ${sizeR.stdout.trim()}\n`;
  }
  const firstPath = appImage || debFile;
  const firstHashR = await exec(conn, `openssl dgst -sha512 -binary "${firstPath}" | base64 -w0`);
  linuxYml += `path: ${firstPath.split('/').pop()}\nsha512: ${firstHashR.stdout.trim()}\nreleaseDate: '${new Date().toISOString()}'\n`;
  await exec(conn, `cat > ${REMOTE_DL}/latest-linux.yml << 'EOF'\n${linuxYml}\nEOF`);
  log('  latest-linux.yml updated');

  // Update versions.json
  log('  Updating versions.json...');
  r = await exec(conn, `cat ${REMOTE_DL}/versions.json`);
  const versions = JSON.parse(r.stdout);
  const entry = versions.versions.find(v => v.version === VERSION);
  if (entry) {
    for (const lf of linuxFiles) {
      const name = lf.split('/').pop();
      const sizeR = await exec(conn, `stat -c%s "${REMOTE_DL}/${name}"`);
      const size = parseInt(sizeR.stdout.trim(), 10);
      if (name.endsWith('.AppImage')) entry.files['linux-x64'] = { url: name, size };
      if (name.endsWith('.deb')) entry.files['linux-deb'] = { url: name, size };
    }
  }
  const updatedJson = JSON.stringify(versions, null, 2);
  const verLocs = [REMOTE_DL, '/root/lingjing-update/data', '/var/www/update-server/data', '/opt/lingjing-update/data'];
  for (const loc of verLocs) {
    try {
      await exec(conn, `mkdir -p ${loc} && cat > ${loc}/versions.json << 'EOF'\n${updatedJson}\nEOF`);
      log(`  ${loc} updated`);
    } catch (e) { log(`  ${loc} skipped`); }
  }

  // Restart PM2
  await exec(conn, 'pm2 restart update-server 2>/dev/null || true');
  await exec(conn, 'pm2 restart cloud-server 2>/dev/null || true');
  
  // Verify
  r = await exec(conn, `curl -s https://ide.zhejiangjinmo.com/api/latest | grep -o '"version":"[^"]*"'`);
  log(`  API: ${r.stdout.trim()}`);

  conn.end();
  log('=== Linux v1.50.0 build and deploy complete! ===');
}

main().catch(err => { console.error(`Failed: ${err.message}`); process.exit(1); });
