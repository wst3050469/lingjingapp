/**
 * Tar local dist/, upload to server, and build Linux v1.50.0
 */
const { Client } = require('ssh2');
const { readFileSync, existsSync, statSync, writeFileSync } = require('fs');
const { basename, join, resolve } = require('path');
const { execSync } = require('child_process');

const SERVER = {
  host: '120.55.5.220',
  port: 22,
  username: 'root',
  password: 'WsT13575967132',
};

const VERSION = '1.50.0';
const ROOT = resolve(__dirname, '..');
const DIST_DIR = join(ROOT, 'packages/core/dist');
const TAR_PATH = join(ROOT, 'dist-v1500.tar.gz');
const REMOTE_DL = '/var/www/downloads';

function log(msg) { console.log(`[${new Date().toISOString().substring(11, 19)}] ${msg}`); }

async function execCmd(conn, cmd) {
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

async function uploadFile(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const stream = sftp.createWriteStream(remotePath);
      const buf = readFileSync(localPath);
      stream.on('close', () => resolve());
      stream.on('error', reject);
      stream.end(buf);
    });
  });
}

async function main() {
  log('=== Tar + Upload + Build Linux v1.50.0 ===');
  
  // Step 1: Tar local dist/
  log('Step 1: Tar dist/...');
  execSync(`tar -czf "${TAR_PATH}" -C "${join(ROOT, 'packages/core')}" dist`, { stdio: 'pipe' });
  const tarSize = statSync(TAR_PATH).size;
  log(`  Tar created: ${(tarSize / 1024 / 1024).toFixed(0)} MB`);
  
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => { log('SSH connected'); resolve(); });
    conn.on('error', reject);
    conn.connect(SERVER);
  });

  // Step 2: Update package.json version
  log('Step 2: Update package.json to v1.50.0...');
  await execCmd(conn, `cd /root/lingjing-git && sed -i 's/"version": "1.49.0"/"version": "1.50.0"/g' packages/electron/package.json packages/renderer/package.json package.json`);
  let r = await execCmd(conn, `cd /root/lingjing-git && grep '"version"' packages/electron/package.json`);
  log(`  version: ${r.stdout.trim()}`);

  // Step 3: Upload tar
  log('Step 3: Upload tar...');
  const remoteTar = '/tmp/dist-v1500.tar.gz';
  const start = Date.now();
  await uploadFile(conn, TAR_PATH, remoteTar);
  log(`  Uploaded in ${((Date.now() - start) / 1000).toFixed(0)}s`);

  // Step 4: Extract tar on server
  log('Step 4: Extract tar...');
  r = await execCmd(conn, `cd /root/lingjing-git/packages/core && tar -xzf ${remoteTar} 2>&1`);
  log(`  Extract: ${r.stdout.trim() || 'OK'}`);
  
  r = await execCmd(conn, 'ls /root/lingjing-git/packages/core/dist/index.js /root/lingjing-git/packages/core/dist/fusion/vector-memory/adapters/sqlite-adapter.js 2>&1');
  log(`  Verify: ${r.stdout.trim()}`);

  // Step 5: Build Linux
  log('Step 5: Build Linux...');
  const buildScript = [
    'set -e',
    'cd /root/lingjing-git/packages/electron',
    'echo "=== Copying dist ==="',
    'rm -rf node_modules/@codepilot/core/dist',
    'cp -r /root/lingjing-git/packages/core/dist node_modules/@codepilot/core/',
    'echo "DIST_COPIED"',
    'echo "=== Building main ==="',
    'node scripts/build-main.mjs 2>&1 | tail -10',
    'echo "MAIN_BUILT"',
    'echo "=== Building Linux installer ==="',
    'npx electron-builder build --linux --x64 2>&1 | tail -30',
    'echo "LINUX_BUILD_DONE"',
  ].join('\n');
  
  log('  Building (this may take 5-10 min)...');
  const buildResult = await execCmd(conn, buildScript);
  log(`  Exit code: ${buildResult.code}`);
  const outLines = buildResult.stdout.split('\n').filter(l => l.trim());
  outLines.slice(-15).forEach(l => log(`  ${l}`));

  if (buildResult.stdout.includes('LINUX_BUILD_DONE')) {
    // Step 6: Copy Linux artifacts
    log('Step 6: Copy Linux artifacts...');
    r = await execCmd(conn, 'ls /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-* 2>/dev/null');
    const linuxFiles = r.stdout.trim().split('\n').filter(Boolean);
    log(`  Found ${linuxFiles.length} files`);
    
    for (const lf of linuxFiles) {
      const name = lf.split('/').pop();
      log(`  Copy ${name}...`);
      await execCmd(conn, `cp "${lf}" ${REMOTE_DL}/${name}`);
    }

    // Step 7: Update latest-linux.yml
    log('Step 7: Update latest-linux.yml...');
    const appImage = linuxFiles.find(f => f.includes('.AppImage'));
    const debFile = linuxFiles.find(f => f.includes('.deb'));
    
    let linuxYml = `version: ${VERSION}\nfiles:\n`;
    if (appImage) {
      const hash = (await execCmd(conn, `openssl dgst -sha512 -binary "${appImage}" | base64 -w0`)).stdout.trim();
      const size = (await execCmd(conn, `stat -c%s "${appImage}"`)).stdout.trim();
      linuxYml += `  - url: ${appImage.split('/').pop()}\n    sha512: ${hash}\n    size: ${size}\n`;
    }
    if (debFile) {
      const hash = (await execCmd(conn, `openssl dgst -sha512 -binary "${debFile}" | base64 -w0`)).stdout.trim();
      const size = (await execCmd(conn, `stat -c%s "${debFile}"`)).stdout.trim();
      linuxYml += `  - url: ${debFile.split('/').pop()}\n    sha512: ${hash}\n    size: ${size}\n`;
    }
    const firstPath = appImage || debFile;
    const firstHash = appImage 
      ? (await execCmd(conn, `openssl dgst -sha512 -binary "${appImage}" | base64 -w0`)).stdout.trim() 
      : '';
    linuxYml += `path: ${firstPath.split('/').pop()}\nsha512: ${firstHash}\nreleaseDate: '${new Date().toISOString()}'\n`;
    await execCmd(conn, `cat > ${REMOTE_DL}/latest-linux.yml << 'EOF'\n${linuxYml}\nEOF`);
    log('  latest-linux.yml updated');

    // Step 8: Update versions.json
    log('Step 8: Update versions.json...');
    r = await execCmd(conn, `cat ${REMOTE_DL}/versions.json`);
    const versions = JSON.parse(r.stdout);
    const versionEntry = versions.versions.find(v => v.version === VERSION);
    
    if (versionEntry) {
      for (const lf of linuxFiles) {
        const name = lf.split('/').pop();
        const sizeResult = await execCmd(conn, `stat -c%s "${REMOTE_DL}/${name}"`);
        const size = parseInt(sizeResult.stdout.trim(), 10);
        if (name.endsWith('.AppImage')) versionEntry.files['linux-x64'] = { url: name, size };
        if (name.endsWith('.deb')) versionEntry.files['linux-deb'] = { url: name, size };
      }
    }
    
    const updatedJson = JSON.stringify(versions, null, 2);
    const verLocations = [REMOTE_DL, '/root/lingjing-update/data', '/var/www/update-server/data', '/opt/lingjing-update/data'];
    for (const loc of verLocations) {
      try {
        await execCmd(conn, `mkdir -p ${loc} && cat > ${loc}/versions.json << 'EOF'\n${updatedJson}\nEOF`);
        log(`  ${loc}/versions.json updated`);
      } catch (err) { log(`  ${loc} skipped`); }
    }
    
    // Step 9: Restart PM2
    log('Step 9: Restart PM2...');
    await execCmd(conn, 'pm2 restart update-server 2>/dev/null || true');
    await execCmd(conn, 'pm2 restart cloud-server 2>/dev/null || true');
    
    // Step 10: Verify
    log('Step 10: Verify...');
    r = await execCmd(conn, `curl -s https://ide.zhejiangjinmo.com/api/latest | grep -o '"version":"[^"]*"'`);
    log(`  API: ${r.stdout.trim()}`);
    
    // Cleanup
    await execCmd(conn, `rm -f ${remoteTar}`);
    
    log('=== Linux v1.50.0 build and deploy complete! ===');
  } else {
    log('ERROR: Build failed');
    if (buildResult.stderr) {
      buildResult.stderr.split('\n').filter(l => l.trim()).slice(-15).forEach(l => log(`  ERR: ${l}`));
    }
  }
  
  conn.end();
  
  // Cleanup local tar
  try { execSync(`del "${TAR_PATH}"`, { stdio: 'pipe' }); } catch(e) {}
}

main().catch(err => {
  console.error(`Failed: ${err.message}`);
  process.exit(1);
});
