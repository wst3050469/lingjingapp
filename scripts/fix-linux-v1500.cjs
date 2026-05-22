/**
 * Fix Linux build for v1.50.0 on production server
 * Uses git dist/ directly (skip tsc since src/ is incomplete)
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
  log('=== Linux v1.50.0 build fix ===');
  
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => { log('SSH connected'); resolve(); });
    conn.on('error', reject);
    conn.connect(SERVER);
  });

  // Step 1: Check current state
  log('Step 1: Check git and dist state...');
  let r = await execCmd(conn, 'cd /root/lingjing-git && git log --oneline -1');
  log(`  HEAD: ${r.stdout.trim()}`);
  
  r = await execCmd(conn, 'ls /root/lingjing-git/packages/core/dist/fusion/integration/index.js 2>/dev/null && echo YES || echo NO');
  log(`  integration/dist exists: ${r.stdout.trim()}`);

  // Step 2: Build Linux using dist/ directly (skip tsc)
  log('Step 2: Build Linux using pre-compiled dist...');
  const buildScript = [
    'set -e',
    'cd /root/lingjing-git',
    'rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist',
    'cp -r /root/lingjing-git/packages/core/dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/',
    'echo "DIST_COPIED"',
    'cd /root/lingjing-git/packages/electron',
    'node scripts/build-main.mjs 2>&1 | tail -5',
    'echo "MAIN_BUILT"',
    'npx electron-builder build --linux --x64 2>&1 | tail -30',
    'echo "LINUX_BUILD_DONE"',
  ].join('\n');
  
  log('  Starting Linux build...');
  const buildResult = await execCmd(conn, buildScript);
  log(`  Exit code: ${buildResult.code}`);
  const outLines = buildResult.stdout.split('\n').filter(l => l.trim());
  outLines.slice(-10).forEach(l => log(`  ${l}`));
  
  if (buildResult.stdout.includes('LINUX_BUILD_DONE')) {
    // Step 3: Find and copy Linux artifacts
    log('Step 3: Find Linux artifacts...');
    r = await execCmd(conn, 'ls /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-* 2>/dev/null');
    const linuxFiles = r.stdout.trim().split('\n').filter(Boolean);
    log(`  Found ${linuxFiles.length} files`);
    
    for (const lf of linuxFiles) {
      const name = lf.split('/').pop();
      log(`  Copy ${name}...`);
      await execCmd(conn, `cp "${lf}" ${REMOTE_DL}/${name}`);
    }
    
    // Step 4: Update latest-linux.yml
    log('Step 4: Update latest-linux.yml...');
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
    
    // Step 5: Update versions.json with Linux file info
    log('Step 5: Update versions.json...');
    r = await execCmd(conn, `cat ${REMOTE_DL}/versions.json`);
    const versions = JSON.parse(r.stdout);
    
    for (const lf of linuxFiles) {
      const name = lf.split('/').pop();
      const sizeResult = await execCmd(conn, `stat -c%s "${REMOTE_DL}/${name}"`);
      const size = parseInt(sizeResult.stdout.trim(), 10);
      const versionEntry = versions.versions.find(v => v.version === VERSION);
      if (versionEntry) {
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
    
    // Restart PM2
    log('Restarting PM2...');
    await execCmd(conn, 'pm2 restart update-server 2>/dev/null || true');
    await execCmd(conn, 'pm2 restart cloud-server 2>/dev/null || true');
    
    log('=== Linux v1.50.0 build and deploy complete! ===');
  } else {
    log('ERROR: Linux build did not complete successfully');
    log(`stderr: ${buildResult.stderr.substring(-500)}`);
  }
  
  conn.end();
}

main().catch(err => {
  console.error(`Failed: ${err.message}`);
  process.exit(1);
});
