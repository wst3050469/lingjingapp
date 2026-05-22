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
  log('=== Final Deploy v1.50.0 ===');

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => { log('SSH connected'); resolve(); });
    conn.on('error', reject);
    conn.connect(SERVER);
  });

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

  // Upload Windows installers (already done in previous run)
  log('Step 1: Windows installers already uploaded');

  // Upload tar
  log('Step 2: Upload fixed dist...');
  execSync(`powershell -NoProfile -Command "cd '${resolve(ROOT, 'packages/core')}'; tar -czf '${resolve(ROOT, 'dist-fixed.tar.gz')}' dist"`, { shell: 'cmd.exe', stdio: 'pipe' });
  const tarPath = resolve(ROOT, 'dist-fixed.tar.gz');
  log(`  Tar: ${(statSync(tarPath).size/1024/1024).toFixed(0)} MB`);
  await new Promise((resolve) => {
    conn.sftp((err, sftp) => {
      const s = sftp.createWriteStream('/tmp/dist-fixed.tar.gz');
      s.on('close', resolve);
      s.end(readFileSync(tarPath));
    });
  });

  // Step 3: Extract dist on server (separate exec)
  log('Step 3: Extract dist...');
  let r = await exec('cd /root/lingjing-git/packages/core && tar -xzf /tmp/dist-fixed.tar.gz && ls dist/index.js');
  log(`  Extract: ${r}`);

  // Step 4: Update version
  log('Step 4: Update version...');
  r = await exec("sed -i s/\\\"version\\\":\\ \\\"1.49.0\\\"/\\\"version\\\":\\ \\\"1.50.0\\\"/g /root/lingjing-git/packages/electron/package.json && grep version /root/lingjing-git/packages/electron/package.json");
  log(`  Version: ${r}`);

  // Step 5: Copy dist
  log('Step 5: Copy dist to electron...');
  r = await exec('rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist && cp -r /root/lingjing-git/packages/core/dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/ && ls /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/index.js');
  log(`  Copy: ${r}`);

  // Step 6: Build main.js
  log('Step 6: Build main.js...');
  r = await exec('cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1 | tail -5');
  log(`  Main build: exit embedded`);

  // Step 7: Build Linux
  log('Step 7: Build Linux (this takes 5-10 min)...');
  r = await exec('cd /root/lingjing-git/packages/electron && npx electron-builder build --linux --x64 2>&1 | tail -5');
  log(`  Linux build:\n${r}`);

  // Step 8: Find artifacts
  log('Step 8: Find and copy artifacts...');
  const lsCmd = 'ls /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-* 2>/dev/null';
  r = await exec(lsCmd);
  const linuxFiles = r.split('\n').filter(Boolean);
  log(`  Found ${linuxFiles.length} files`);
  
  if (linuxFiles.length > 0) {
    for (const lf of linuxFiles) {
      const name = lf.split('/').pop();
      await exec(`cp "${lf}" ${REMOTE_DL}/${name}`);
      log(`  Copied ${name}`);
    }

    // Step 9: Update latest-linux.yml
    log('Step 9: Update latest-linux.yml...');
    const appImage = linuxFiles.find(f => f.includes('.AppImage'));
    const debFile = linuxFiles.find(f => f.includes('.deb'));
    let yml = `version: ${VERSION}\nfiles:\n`;
    for (const f of [appImage, debFile].filter(Boolean)) {
      const name = f.split('/').pop();
      const hash = await exec(`openssl dgst -sha512 -binary "${f}" | base64 -w0`);
      const size = await exec(`stat -c%s "${f}"`);
      yml += `  - url: ${name}\n    sha512: ${hash}\n    size: ${size}\n`;
    }
    const firstPath = appImage || debFile;
    const firstHash = appImage ? await exec(`openssl dgst -sha512 -binary "${appImage}" | base64 -w0`) : '';
    yml += `path: ${firstPath.split('/').pop()}\nsha512: ${firstHash}\nreleaseDate: '${new Date().toISOString()}'\n`;
    await exec(`cat > ${REMOTE_DL}/latest-linux.yml << 'EOF'\n${yml}\nEOF`);
    log('  latest-linux.yml updated');

    // Step 10: Update versions.json
    log('Step 10: Update versions.json...');
    r = await exec(`cat ${REMOTE_DL}/versions.json`);
    const versions = JSON.parse(r);
    const entry = versions.versions.find(v => v.version === VERSION);
    if (entry) {
      entry.status = 'pending_review';
      for (const lf of linuxFiles) {
        const name = lf.split('/').pop();
        const sz = await exec(`stat -c%s "${REMOTE_DL}/${name}"`);
        const size = parseInt(sz, 10);
        if (name.endsWith('.AppImage')) entry.files['linux-x64'] = { url: name, size };
        if (name.endsWith('.deb')) entry.files['linux-deb'] = { url: name, size };
      }
    }
    const updatedJson = JSON.stringify(versions, null, 2);
    for (const loc of [REMOTE_DL, '/root/lingjing-update/data', '/var/www/update-server/data', '/opt/lingjing-update/data']) {
      await exec(`mkdir -p ${loc} && cat > ${loc}/versions.json << 'EOF'\n${updatedJson}\nEOF`);
    }

    // Step 11: Restart PM2
    await exec('pm2 restart update-server 2>/dev/null || true');
    await exec('pm2 restart cloud-server 2>/dev/null || true');

    log('=== Linux v1.50.0 deploy complete! ===');
  } else {
    log('ERROR: No Linux artifacts found!');
  }

  conn.end();
  try { execSync(`del "${tarPath}"`, { shell: 'cmd.exe', stdio: 'pipe' }); } catch(e) {}
}

main().catch(err => { console.error('FATAL:', err.message); console.error(err.stack); process.exit(1); });
