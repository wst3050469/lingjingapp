/**
 * Final Linux v1.50.0 build script
 * Properly handles dist/ restore from git with .gitignore override
 */
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

function execCmd(conn, cmd) {
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
  log('=== Build Linux v1.50.0 ===');
  
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => { log('SSH connected'); resolve(); });
    conn.on('error', reject);
    conn.connect(SERVER);
  });

  // Step 1: Check state
  log('Step 1: Check state...');
  let r = await execCmd(conn, 'cd /root/lingjing-git && git log --oneline -1');
  log(`  HEAD: ${r.stdout.trim()}`);
  
  // Step 2: Restore dist/ completely
  log('Step 2: Restore dist/ from git...');
  // dist/ directory doesn't exist in worktree, create it first
  const restoreScript = [
    'mkdir -p /root/lingjing-git/packages/core/dist',
    'cd /root/lingjing-git && git checkout HEAD -- packages/core/dist/ 2>&1 | tail -3',
    'ls /root/lingjing-git/packages/core/dist/index.js',
    'ls /root/lingjing-git/packages/core/dist/fusion/vector-memory/adapters/sqlite-adapter.js 2>/dev/null || echo "no-sqlite"',
  ].join('\n');
  r = await execCmd(conn, restoreScript);
  log(`  restore output:\n${r.stdout}`);

  // Step 3: Update package.json versions
  log('Step 3: Update package.json versions...');
  await execCmd(conn, `cd /root/lingjing-git && sed -i 's/"version": "1.49.0"/"version": "1.50.0"/g' packages/electron/package.json packages/renderer/package.json package.json`);
  
  r = await execCmd(conn, `cd /root/lingjing-git && grep '"version"' packages/electron/package.json`);
  log(`  electron version: ${r.stdout.trim()}`);

  // Step 4: Build Linux
  log('Step 4: Build Linux...');
  const buildScript = [
    'set -e',
    'cd /root/lingjing-git/packages/electron',
    'echo "=== Copying dist ==="',
    'ls /root/lingjing-git/packages/core/dist/index.js',
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
  
  log('  Starting Linux build...');
  const buildResult = await execCmd(conn, buildScript);
  log(`  Exit code: ${buildResult.code}`);
  const outLines = buildResult.stdout.split('\n').filter(l => l.trim());
  outLines.forEach(l => log(`  ${l}`));

  if (buildResult.stdout.includes('LINUX_BUILD_DONE')) {
    // Step 5: Find and copy Linux artifacts
    log('Step 5: Copy Linux artifacts...');
    r = await execCmd(conn, 'ls /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-* 2>/dev/null');
    const linuxFiles = r.stdout.trim().split('\n').filter(Boolean);
    log(`  Found ${linuxFiles.length} files`);
    
    for (const lf of linuxFiles) {
      const name = lf.split('/').pop();
      log(`  Copy ${name}...`);
      await execCmd(conn, `cp "${lf}" ${REMOTE_DL}/${name}`);
    }

    // Step 6: Update latest-linux.yml
    log('Step 6: Update latest-linux.yml...');
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

    // Step 7: Update versions.json
    log('Step 7: Update versions.json...');
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
      } catch (err) {
        log(`  ${loc} skipped`);
      }
    }
    
    // Step 8: Restart PM2
    log('Step 8: Restart PM2...');
    await execCmd(conn, 'pm2 restart update-server 2>/dev/null || true');
    await execCmd(conn, 'pm2 restart cloud-server 2>/dev/null || true');
    
    // Verify deployment
    log('Step 9: Verify...');
    r = await execCmd(conn, `curl -s https://ide.zhejiangjinmo.com/api/latest | grep -o '"version":"[^"]*"'`);
    log(`  API latest: ${r.stdout.trim()}`);
    
    log('=== Linux v1.50.0 build and deploy complete! ===');
  } else {
    log('ERROR: Linux build failed');
    if (buildResult.stderr) {
      const errLines = buildResult.stderr.split('\n').filter(l => l.trim());
      errLines.forEach(l => log(`  ERR: ${l}`));
    }
  }
  
  conn.end();
}

main().catch(err => {
  console.error(`Failed: ${err.message}`);
  process.exit(1);
});
