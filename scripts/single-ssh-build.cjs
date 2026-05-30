/**
 * Single SSH exec build - no CWD issues
 * Uses absolute paths for everything
 */
const { Client } = require('ssh2');
const { readFileSync, statSync } = require('fs');
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
const TAR_PATH = join(ROOT, 'dist1500.tar.gz');
const REMOTE_DL = '/var/www/downloads';

function log(msg) { console.log(`[${new Date().toISOString().substring(11, 19)}] ${msg}`); }

async function main() {
  log('=== Single SSH Build Linux v1.50.0 ===');
  
  // Tar local dist/ using PowerShell to avoid CWD issues
  log('Step 1: Tar local dist/...');
  execSync(`powershell -NoProfile -Command "cd '${join(ROOT, 'packages/core')}'; tar -czf '${TAR_PATH}' dist"`, { stdio: 'pipe', shell: 'cmd.exe' });
  log(`  Size: ${(statSync(TAR_PATH).size / 1024 / 1024).toFixed(0)} MB`);

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => { log('SSH connected'); resolve(); });
    conn.on('error', reject);
    conn.connect(SERVER);
  });

  // Upload tar
  log('Step 2: Upload tar...');
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const stream = sftp.createWriteStream('/tmp/dist1500.tar.gz');
      const buf = readFileSync(TAR_PATH);
      stream.on('close', () => resolve());
      stream.on('error', reject);
      stream.end(buf);
    });
  });
  log('  Upload done');

  // Single SSH command: extract, copy, build
  log('Step 3: Build (single SSH exec)...');
  const fullScript = `
set -e
echo "=== PHASE 1: Extract ==="
rm -rf /root/lingjing-git/packages/core/dist
cd /root/lingjing-git/packages/core && tar -xzf /tmp/dist1500.tar.gz
echo "Files: $(ls /root/lingjing-git/packages/core/dist | wc -l)"

echo "=== PHASE 2: Update version ==="
cd /root/lingjing-git
sed -i 's/"version": "1.49.0"/"version": "1.50.0"/g' packages/electron/package.json packages/renderer/package.json package.json
echo "Version: $(grep '"version"' packages/electron/package.json)"

echo "=== PHASE 3: Copy dist ==="
cd /root/lingjing-git/packages/electron
rm -rf node_modules/@codepilot/core/dist
mkdir -p node_modules/@codepilot/core
cd /root/lingjing-git/packages/core && tar cf - dist | tar xf - -C /root/lingjing-git/packages/electron/node_modules/@codepilot/
echo "DIST_COPIED"
ls node_modules/@codepilot/core/dist/index.js && echo "VERIFY_OK"

echo "=== PHASE 4: Build main ==="
ls /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/index.js
node scripts/build-main.mjs 2>&1
echo "MAIN_BUILT: $?"

echo "=== PHASE 5: Build Linux ==="
npx electron-builder build --linux --x64 2>&1
echo "LINUX_BUILD_DONE: $?"

echo "=== PHASE 6: Copy artifacts ==="
for f in /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-*; do
  if [ -f "$f" ]; then
    cp "$f" ${REMOTE_DL}/$(basename "$f")
    echo "COPIED: $(basename "$f")"
  fi
done

echo "=== BUILD COMPLETE ==="
`.trim();

  // Need to pipe the script since it's too long for exec
  const result = await new Promise((resolve, reject) => {
    conn.exec(`bash -s`, (err, stream) => {
      if (err) return reject(err);
      stream.stdin.write(fullScript);
      stream.stdin.end();
      let stdout = '', stderr = '';
      stream.on('data', d => { stdout += d.toString(); process.stdout.write(d.toString()); });
      stream.stderr.on('data', d => { stderr += d.toString(); process.stderr.write(d.toString()); });
      stream.on('close', () => resolve({ stdout, stderr }));
    });
  });
  
  log(`\nBuild exit check: ${result.stdout.includes('BUILD COMPLETE') ? 'SUCCESS' : 'CHECK OUTPUT ABOVE'}`);

  if (result.stdout.includes('BUILD COMPLETE')) {
    // Update versions.json and latest-linux.yml
    log('Step 4: Update latest-linux.yml...');
    const lsResult = await new Promise((resolve, reject) => {
      conn.exec('for f in /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-*; do [ -f "$f" ] && echo "$f"; done', (e, s) => {
        let o = ''; s.on('data', d => o += d); s.on('close', () => resolve(o));
      });
    });
    const linuxFiles = lsResult.trim().split('\n').filter(Boolean);
    log(`  Linux files: ${linuxFiles.length}`);

    if (linuxFiles.length > 0) {
      const appImage = linuxFiles.find(f => f.includes('.AppImage'));
      const debFile = linuxFiles.find(f => f.includes('.deb'));
      
      let linuxYml = `version: ${VERSION}\nfiles:\n`;
      for (const lf of [appImage, debFile].filter(Boolean)) {
        const name = lf.split('/').pop();
        const hashResult = await new Promise((resolve, reject) => {
          conn.exec(`openssl dgst -sha512 -binary "${lf}" | base64 -w0`, (e, s) => {
            let o = ''; s.on('data', d => o += d); s.on('close', () => resolve(o));
          });
        });
        const sizeResult = await new Promise((resolve, reject) => {
          conn.exec(`stat -c%s "${lf}"`, (e, s) => {
            let o = ''; s.on('data', d => o += d); s.on('close', () => resolve(o));
          });
        });
        linuxYml += `  - url: ${name}\n    sha512: ${hashResult.trim()}\n    size: ${sizeResult.trim()}\n`;
      }
      const firstPath = appImage || debFile;
      const firstHash = appImage ? (await new Promise(res => { conn.exec(`openssl dgst -sha512 -binary "${appImage}" | base64 -w0`, (e,s) => { let o='';s.on('data',d=>o+=d);s.on('close',()=>res(o)); }); })).trim() : '';
      linuxYml += `path: ${firstPath.split('/').pop()}\nsha512: ${firstHash}\nreleaseDate: '${new Date().toISOString()}'\n`;
      
      await new Promise((resolve, reject) => {
        conn.exec(`cat > ${REMOTE_DL}/latest-linux.yml << 'EOF'\n${linuxYml}\nEOF`, (e, s) => { s.on('close', () => resolve()); });
      });
      log('  latest-linux.yml updated');

      // Update versions.json
      log('Step 5: Update versions.json...');
      const verResult = await new Promise((resolve, reject) => {
        conn.exec(`cat ${REMOTE_DL}/versions.json`, (e, s) => {
          let o = ''; s.on('data', d => o += d); s.on('close', () => resolve(o));
        });
      });
      const versions = JSON.parse(verResult);
      const entry = versions.versions.find(v => v.version === VERSION);
      
      if (entry) {
        for (const lf of linuxFiles) {
          const name = lf.split('/').pop();
          const sizeResult = await new Promise(res => {
            conn.exec(`stat -c%s "${REMOTE_DL}/${name}"`, (e,s) => { let o='';s.on('data',d=>o+=d);s.on('close',()=>res(o)); });
          });
          const size = parseInt(sizeResult.trim(), 10);
          if (name.endsWith('.AppImage')) entry.files['linux-x64'] = { url: name, size };
          if (name.endsWith('.deb')) entry.files['linux-deb'] = { url: name, size };
        }
      }
      
      const updatedJson = JSON.stringify(versions, null, 2);
      const verLocations = [REMOTE_DL, '/root/lingjing-update/data', '/var/www/update-server/data', '/opt/lingjing-update/data'];
      for (const loc of verLocations) {
        try {
          await new Promise((resolve, reject) => {
            conn.exec(`mkdir -p ${loc} && cat > ${loc}/versions.json << 'EOF'\n${updatedJson}\nEOF`, (e,s) => { s.on('close', () => resolve()); });
          });
          log(`  ${loc} updated`);
        } catch(e) { log(`  ${loc} skipped`); }
      }
      
      // Restart PM2
      log('Step 6: Restart PM2...');
      const restartCmd = 'pm2 restart update-server 2>/dev/null; pm2 restart cloud-server 2>/dev/null; echo "PM2_DONE"';
      await new Promise(res => { conn.exec(restartCmd, (e,s) => { s.on('close', () => res()); }); });
      
      log('=== Linux v1.50.0 build and deploy complete! ===');
    }
  }

  conn.end();
  try { execSync(`del "${TAR_PATH}"`, { stdio: 'pipe' }); } catch(e) {}
}

main().catch(err => { console.error(`Failed: ${err.message}`); process.exit(1); });
