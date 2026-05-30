const { Client } = require('ssh2');
const { readFileSync, statSync, existsSync } = require('fs');
const { join, resolve } = require('path');
const { execSync } = require('child_process');

const SERVER = {
  host: '120.55.5.220',
  port: 22,
  username: 'root',
  password: 'WsT13575967132',
};

const VERSION = '1.50.0';
const ROOT = resolve(__dirname, '..');
const RELEASE_DIR = resolve(ROOT, 'packages/electron/release-v1480');
const REMOTE_DL = '/var/www/downloads';

function log(m) { console.log(new Date().toISOString().substr(11,8) + ' ' + m); }

async function main() {
  log('=== Final Deploy v1.50.0 (patch-renderer fix) ===');

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => { log('SSH connected'); resolve(); });
    conn.on('error', reject);
    conn.connect(SERVER);
  });

  // Upload files
  log('Step 1: Upload Windows installers...');
  for (const file of [`LingJing-Setup-${VERSION}-win-x64.exe`, `LingJing-Portable-${VERSION}-win-x64.exe`, `LingJing-Setup-${VERSION}-win-x64.exe.blockmap`, 'latest.yml']) {
    const lp = join(RELEASE_DIR, file);
    if (!existsSync(lp)) { log(`  SKIP ${file}`); continue; }
    log(`  Upload ${file} (${(statSync(lp).size/1024/1024).toFixed(0)} MB)...`);
    await new Promise((resolve) => {
      conn.sftp((err, sftp) => {
        const s = sftp.createWriteStream(`${REMOTE_DL}/${file}`);
        s.on('close', resolve);
        s.end(readFileSync(lp));
      });
    });
  }

  // Upload dist tar
  log('Step 2: Tar and upload fixed dist...');
  execSync(`powershell -NoProfile -Command "cd '${resolve(ROOT, 'packages/core')}'; tar -czf '${resolve(ROOT, 'dist-fixed.tar.gz')}' dist"`, { shell: 'cmd.exe', stdio: 'pipe' });
  const tarPath = resolve(ROOT, 'dist-fixed.tar.gz');
  log(`  Tar size: ${(statSync(tarPath).size/1024/1024).toFixed(0)} MB`);
  await new Promise((resolve) => {
    conn.sftp((err, sftp) => {
      const s = sftp.createWriteStream('/tmp/dist-fixed.tar.gz');
      s.on('close', resolve);
      s.end(readFileSync(tarPath));
    });
  });

  // Run build script via stdin pipe
  log('  Running build script on server...');
  const buildCmd = [
    'set -e',
    'cd /root/lingjing-git/packages/core && tar -xzf /tmp/dist-fixed.tar.gz 2>/dev/null; echo "EXTRACTED"',
    'ls /root/lingjing-git/packages/core/dist/index.js',
    'sed -i s/1.49.0/1.50.0/g /root/lingjing-git/packages/electron/package.json',
    'grep version /root/lingjing-git/packages/electron/package.json',
    'rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist',
    'mkdir -p /root/lingjing-git/packages/electron/node_modules/@codepilot/core',
    'cp -r /root/lingjing-git/packages/core/dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/',
    'ls /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/index.js',
    'cd /root/lingjing-git/packages/electron',
    'node scripts/build-main.mjs 2>&1',
    'npx electron-builder build --linux --x64 2>&1',
    'for f in /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-*; do [ -f "$f" ] && cp "$f" /var/www/downloads/$(basename "$f"); done',
  ].join('\n') + '\necho "ALL_DONE"';
  
  let fullOutput = '';
  await new Promise((resolve) => {
    conn.exec('bash -s', (err, stream) => {
      stream.stdin.write(buildCmd);
      stream.stdin.end();
      stream.on('data', d => { fullOutput += d.toString(); process.stdout.write(d); });
      stream.stderr.on('data', d => { fullOutput += d.toString(); process.stderr.write(d); });
      stream.on('close', () => resolve());
    });
  });

  if (fullOutput.includes('ALL_DONE')) {
    log('=== Linux build SUCCESS ===');
    
    // Update versions.json and latest-linux.yml
    log('Step 4: Update versions.json...');
    const r = await new Promise((res) => {
      conn.exec('cat /var/www/downloads/versions.json', (e, s) => {
        let o = ''; s.on('data', d => o += d); s.on('close', () => res(o));
      });
    });
    const versions = JSON.parse(r);
    const entry = versions.versions.find(v => v.version === VERSION);
    if (entry) {
      entry.status = 'pending_review';
      const lsR = await new Promise((res) => {
        conn.exec('ls /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-* 2>/dev/null', (e, s) => {
          let o = ''; s.on('data', d => o += d); s.on('close', () => res(o));
        });
      });
      const linuxFiles = lsR.split('\n').filter(Boolean);
      for (const lf of linuxFiles) {
        const name = lf.split('/').pop();
        const szR = await new Promise((res) => {
          conn.exec(`stat -c%s "/var/www/downloads/${name}"`, (e, s) => {
            let o = ''; s.on('data', d => o += d); s.on('close', () => res(o));
          });
        });
        const size = parseInt(szR.trim(), 10);
        if (name.endsWith('.AppImage')) entry.files['linux-x64'] = { url: name, size };
        if (name.endsWith('.deb')) entry.files['linux-deb'] = { url: name, size };
      }
    }
    const updatedJson = JSON.stringify(versions, null, 2);
    for (const loc of [REMOTE_DL, '/root/lingjing-update/data', '/var/www/update-server/data', '/opt/lingjing-update/data']) {
      await new Promise((res) => {
        conn.exec(`mkdir -p ${loc} && cat > ${loc}/versions.json << 'EOF'\n${updatedJson}\nEOF`, (e, s) => { s.on('close', () => res()); });
      });
      log(`  ${loc} updated`);
    }

    // latest-linux.yml
    log('Step 5: Latest-linux.yml...');
    const appImage = (await new Promise(r => { conn.exec('ls /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-*AppImage 2>/dev/null', (e,s) => { let o='';s.on('data',d=>o+=d);s.on('close',()=>r(o)); }); })).trim();
    const debFile = (await new Promise(r => { conn.exec('ls /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-*deb 2>/dev/null', (e,s) => { let o='';s.on('data',d=>o+=d);s.on('close',()=>r(o)); }); })).trim();
    
    let yml = `version: ${VERSION}\nfiles:\n`;
    for (const f of [appImage, debFile].filter(Boolean)) {
      const name = f.split('/').pop();
      const hash = await new Promise(r => { conn.exec(`openssl dgst -sha512 -binary "${f}" | base64 -w0`, (e,s) => { let o='';s.on('data',d=>o+=d);s.on('close',()=>r(o)); }); });
      const size = await new Promise(r => { conn.exec(`stat -c%s "${f}"`, (e,s) => { let o='';s.on('data',d=>o+=d);s.on('close',()=>r(o)); }); });
      yml += `  - url: ${name}\n    sha512: ${hash.trim()}\n    size: ${size.trim()}\n`;
    }
    const firstPath = appImage || debFile;
    const firstHash = appImage ? (await new Promise(r => { conn.exec(`openssl dgst -sha512 -binary "${appImage}" | base64 -w0`, (e,s) => { let o='';s.on('data',d=>o+=d);s.on('close',()=>r(o)); }); })).trim() : '';
    yml += `path: ${firstPath.split('/').pop()}\nsha512: ${firstHash}\nreleaseDate: '${new Date().toISOString()}'\n`;
    await new Promise(r => { conn.exec(`cat > ${REMOTE_DL}/latest-linux.yml << 'EOF'\n${yml}\nEOF`, (e,s) => { s.on('close', () => r()); }); });

    // Restart
    await new Promise(r => { conn.exec('pm2 restart update-server 2>/dev/null; pm2 restart cloud-server 2>/dev/null; echo PM2_DONE', (e,s) => { s.on('close', () => r()); }); });
    log('=== ALL DONE ===');
  } else {
    log('BUILD FAILED or incomplete');
    const lastLines = fullOutput.split('\n').filter(l => l.trim()).slice(-10);
    lastLines.forEach(l => log(`  ${l}`));
  }

  conn.end();
  try { execSync(`del "${tarPath}"`, { shell: 'cmd.exe', stdio: 'pipe' }); } catch(e) {}
}

main().catch(err => { log('Error: ' + err.message); process.exit(1); });
