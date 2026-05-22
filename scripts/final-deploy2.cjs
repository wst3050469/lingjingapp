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

  // Step 1: Upload fixed Windows installers
  log('Step 1: Upload Windows installers...');
  const filesToUpload = [
    `LingJing-Setup-${VERSION}-win-x64.exe`,
    `LingJing-Portable-${VERSION}-win-x64.exe`,
    `LingJing-Setup-${VERSION}-win-x64.exe.blockmap`,
    'latest.yml',
  ];
  for (const file of filesToUpload) {
    const lp = join(RELEASE_DIR, file);
    if (!existsSync(lp)) { log(`  SKIP ${file}`); continue; }
    const sizeMB = (statSync(lp).size / 1024 / 1024).toFixed(0);
    log(`  Upload ${file} (${sizeMB} MB)...`);
    await new Promise((resolve) => {
      conn.sftp((err, sftp) => {
        const stream = sftp.createWriteStream(`${REMOTE_DL}/${file}`);
        stream.on('close', resolve);
        stream.end(readFileSync(lp));
      });
    });
  }

  // Step 2: Upload fixed dist tar
  log('Step 2: Upload fixed dist...');
  log('  Taring...');
  execSync(`powershell -NoProfile -Command "cd '${resolve(ROOT, 'packages/core')}'; tar -czf '${resolve(ROOT, 'dist-fixed.tar.gz')}' dist"`, { shell: 'cmd.exe', stdio: 'pipe' });
  const tarPath = resolve(ROOT, 'dist-fixed.tar.gz');
  log(`  Upload tar (${(statSync(tarPath).size / 1024 / 1024).toFixed(0)} MB)...`);
  await new Promise((resolve) => {
    conn.sftp((err, sftp) => {
      const stream = sftp.createWriteStream('/tmp/dist-fixed.tar.gz');
      stream.on('close', resolve);
      stream.end(readFileSync(tarPath));
    });
  });

  // Step 3: Build Linux on server
  log('Step 3: Build Linux on server (this takes 5-10 min)...');
  const buildCmd = [
    'cd /root/lingjing-git',
    'rm -rf packages/core/dist',
    'cd packages/core && tar -xzf /tmp/dist-fixed.tar.gz',
    'ls dist/index.js && echo DIST_OK',
    'sed -i \'s/"version": "1.49.0"/"version": "1.50.0"/g\' packages/electron/package.json',
    'cd packages/electron',
    'rm -rf node_modules/@codepilot/core/dist',
    'cd /root/lingjing-git/packages/core && tar cf - dist | tar xf - -C /root/lingjing-git/packages/electron/node_modules/@codepilot/',
    'ls /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/index.js && echo DIST_COPIED_OK',
    'cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1 | tail -3 && echo MAIN_OK',
    'npx electron-builder build --linux --x64 2>&1 | tail -10',
    'echo BUILD_RESULT:$?',
    'ls /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-* 2>/dev/null && echo ARTIFACTS_FOUND',
  ].join(' && ');
  
  const buildResult = await exec(buildCmd);
  log(`Build output:\n${buildResult}`);

  if (buildResult.includes('ARTIFACTS_FOUND')) {
    log('Linux build SUCCESS!');
    
    // Step 4: Copy Linux artifacts
    log('Step 4: Copy Linux artifacts...');
    const linuxFiles = (await exec('ls /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-* 2>/dev/null')).split('\n').filter(Boolean);
    for (const lf of linuxFiles) {
      const name = lf.split('/').pop();
      log(`  Copy ${name}...`);
      await exec(`cp "${lf}" ${REMOTE_DL}/${name}`);
    }

    // Step 5: Update latest-linux.yml
    log('Step 5: Update latest-linux.yml...');
    const appImage = linuxFiles.find(f => f.includes('.AppImage'));
    const debFile = linuxFiles.find(f => f.includes('.deb'));
    
    let linuxYml = `version: ${VERSION}\nfiles:\n`;
    for (const lf of [appImage, debFile].filter(Boolean)) {
      const name = lf.split('/').pop();
      const hash = (await exec(`openssl dgst -sha512 -binary "${lf}" | base64 -w0`));
      const size = (await exec(`stat -c%s "${lf}"`));
      linuxYml += `  - url: ${name}\n    sha512: ${hash}\n    size: ${size}\n`;
    }
    const firstPath = appImage || debFile;
    const firstHash = await exec(`openssl dgst -sha512 -binary "${firstPath}" | base64 -w0`);
    linuxYml += `path: ${firstPath.split('/').pop()}\nsha512: ${firstHash}\nreleaseDate: '${new Date().toISOString()}'\n`;
    await exec(`cat > ${REMOTE_DL}/latest-linux.yml << 'EOF'\n${linuxYml}\nEOF`);

    // Step 6: Update versions.json with linux files info
    log('Step 6: Update versions.json...');
    const verData = await exec(`cat ${REMOTE_DL}/versions.json`);
    const versions = JSON.parse(verData);
    const v150Entry = versions.versions.find(v => v.version === VERSION);
    
    if (v150Entry) {
      for (const lf of linuxFiles) {
        const name = lf.split('/').pop();
        const sizeR = await exec(`stat -c%s "${lf}"`);
        const size = parseInt(sizeR, 10);
        if (name.endsWith('.AppImage')) v150Entry.files['linux-x64'] = { url: name, size };
        if (name.endsWith('.deb')) v150Entry.files['linux-deb'] = { url: name, size };
      }
      // Keep as pending_review  
      v150Entry.status = 'pending_review';
    }
    
    const updatedJson = JSON.stringify(versions, null, 2);
    const verLocs = [REMOTE_DL, '/root/lingjing-update/data', '/var/www/update-server/data', '/opt/lingjing-update/data'];
    for (const loc of verLocs) {
      await exec(`mkdir -p ${loc} && cat > ${loc}/versions.json << 'EOF'\n${updatedJson}\nEOF`);
      log(`  ${loc} updated`);
    }

    // Restart PM2
    await exec('pm2 restart update-server 2>/dev/null || true');
    await exec('pm2 restart cloud-server 2>/dev/null || true');

    log('=== Linux v1.50.0 deploy complete! ===');
  } else {
    log('ERROR: Linux build may have failed');
  }

  conn.end();
  try { execSync(`del "${tarPath}"`, { stdio: 'pipe', shell: 'cmd.exe' }); } catch(e) {}
}

main().catch(err => { log('Error: ' + err.message); process.exit(1); });
