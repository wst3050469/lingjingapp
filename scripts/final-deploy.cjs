const { Client } = require('ssh2');
const { readFileSync, statSync, existsSync } = require('fs');
const { join, resolve } = require('path');

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

function uploadFile(conn, localPath, remotePath) {
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

function exec(conn, cmd) {
  return new Promise((res) => {
    conn.exec(cmd, (err, stream) => {
      let o = '';
      stream.on('data', d => o += d);
      stream.stderr.on('data', d => {});
      stream.on('close', () => res(o.trim()));
    });
  });
}

async function main() {
  log('=== Final Deploy v1.50.0 (fixed) ===');

  // Step 1: Upload fixed Windows installers
  log('Step 1: Uploading fixed Windows installers...');
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => { log('SSH connected'); resolve(); });
    conn.on('error', reject);
    conn.connect(SERVER);
  });

  const files = [
    `LingJing-Setup-${VERSION}-win-x64.exe`,
    `LingJing-Portable-${VERSION}-win-x64.exe`,
    `LingJing-Setup-${VERSION}-win-x64.exe.blockmap`,
    'latest.yml',
  ];

  for (const file of files) {
    const localPath = join(RELEASE_DIR, file);
    if (!existsSync(localPath)) {
      log(`  SKIP ${file} (not found)`);
      continue;
    }
    const sizeMB = (statSync(localPath).size / 1024 / 1024).toFixed(0);
    log(`  Upload ${file} (${sizeMB} MB)...`);
    await uploadFile(conn, localPath, `${REMOTE_DL}/${file}`);
    log(`  Done`);
  }

  // Step 2: Upload fixed dist/ tar to server and build Linux
  log('Step 2: Upload fixed dist/ to server...');
  const { execSync } = require('child_process');
  
  // Tar the fixed dist
  log('  Taring fixed dist/...');
  execSync(`powershell -NoProfile -Command "cd '${resolve(ROOT, 'packages/core')}'; tar -czf '${resolve(ROOT, 'dist1500-fixed.tar.gz')}' dist"`, { shell: 'cmd.exe', stdio: 'pipe' });

  // Upload
  const tarPath = resolve(ROOT, 'dist1500-fixed.tar.gz');
  log(`  Uploading tar (${(statSync(tarPath).size / 1024 / 1024).toFixed(0)} MB)...`);
  await uploadFile(conn, tarPath, '/tmp/dist1500-fixed.tar.gz');
  log('  Uploaded');

  // Step 3: Build Linux on server
  log('Step 3: Building Linux on server...');
  const script = `
set -e
echo "=== Phase 1: Extract fixed dist ==="
rm -rf /root/lingjing-git/packages/core/dist
cd /root/lingjing-git/packages/core && tar -xzf /tmp/dist1500-fixed.tar.gz
echo "dist restored: $(ls dist/index.js)"

echo "=== Phase 2: Update version ==="
cd /root/lingjing-git
sed -i 's/"version": "1.49.0"/"version": "1.50.0"/g' packages/electron/package.json packages/renderer/package.json package.json
echo "version: $(grep '"version"' packages/electron/package.json)"

echo "=== Phase 3: Copy dist ==="
cd /root/lingjing-git/packages/electron
rm -rf node_modules/@codepilot/core/dist
cd /root/lingjing-git/packages/core && tar cf - dist | tar xf - -C /root/lingjing-git/packages/electron/node_modules/@codepilot/
echo "dist copied: $(ls /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist/index.js)"

echo "=== Phase 4: Build main.js ==="
cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1 | tail -5
echo "MAIN_BUILT"

echo "=== Phase 5: Build Linux installer ==="
cd /root/lingjing-git/packages/electron && npx electron-builder build --linux --x64 2>&1 | tail -20
echo "LINUX_BUILD_DONE"

echo "=== Phase 6: Copy artifacts ==="
for f in /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-*; do
  [ -f "$f" ] && cp "$f" ${REMOTE_DL}/$(basename "$f") && echo "COPIED: $(basename "$f")"
done
echo "DONE"
`.trim();

  const output = await new Promise((resolve) => {
    conn.exec('bash -s', (err, stream) => {
      let o = '';
      stream.on('data', d => { o += d; process.stdout.write(d); });
      stream.stderr.on('data', d => { o += d; process.stderr.write(d); });
      stream.on('close', () => resolve(o));
    });
    stream;  // need to send the script
  });

  // We need to send the script via stdin
  log('  Sending build script...');
  const stream = conn.exec('bash -s', (err, stream) => {
    let o = '';
    stream.on('data', d => { o += d; });
    stream.stderr.on('data', d => {});
    stream.on('close', () => {
      log('Build output tail:');
      const lines = o.split('\n').filter(l => l.trim());
      lines.forEach(l => log(`  ${l}`));
      done();
    });
  });

  // Actually, exec already uses a method that sends the script. Let me redo this.
  // The previous approach with stream.stdin.write should work.
  
  // Wait - let me use the pipe approach instead.
  const { spawn } = require('child_process');
  // Actually, let's just do it differently - send the script as a heredoc
  // In the exec command itself

  log('  Sending build command...');
  // Write script to a temp file then source it
  const result = await exec(conn, [
    'cat > /tmp/build-v1500.sh << "BUILDSCRIPT"',
    '#!/bin/bash',
    'set -e',
    'cd /root/lingjing-git',
    'rm -rf packages/core/dist',
    'cd packages/core && tar -xzf /tmp/dist1500-fixed.tar.gz',
    'ls dist/index.js',
    'sed -i \'s/"version": "1.49.0"/"version": "1.50.0"/g\' packages/electron/package.json packages/renderer/package.json package.json',
    'cd packages/electron',
    'rm -rf node_modules/@codepilot/core/dist',
    'cd /root/lingjing-git/packages/core && tar cf - dist | tar xf - -C /root/lingjing-git/packages/electron/node_modules/@codepilot/',
    'cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1',
    'npx electron-builder build --linux --x64 2>&1',
    'echo "BUILD_COMPLETE:$?"',
    'for f in /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-*; do',
    '  [ -f "$f" ] && cp "$f" /var/www/downloads/$(basename "$f") && echo "COPIED: $(basename "$f")"',
    'done',
    'echo "ALL_DONE"',
    'BUILDSCRIPT',
    'bash /tmp/build-v1500.sh 2>&1',
  ].join('\n'));
  
  log('Build result:');
  const outputLines = result.split('\n').filter(l => l.trim());
  outputLines.forEach(l => log(`  ${l}`));

  if (result.includes('ALL_DONE')) {
    log('=== Linux v1.50.0 built successfully! ===');
    
    // Step 4: Update versions.json
    log('Step 4: Updating versions.json...');
    const verData = await exec(conn, 'cat /var/www/downloads/versions.json');
    const versions = JSON.parse(verData);
    
    // Find and update v1.50.0 entry with Linux files
    const v150Entry = versions.versions.find(v => v.version === '1.50.0');
    if (v150Entry) {
      // Get Linux file sizes
      const lsResult = await exec(conn, 'ls /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-* 2>/dev/null');
      const linuxFiles = lsResult.split('\n').filter(Boolean);
      for (const lf of linuxFiles) {
        const name = lf.split('/').pop();
        const sizeR = await exec(conn, `stat -c%s "${lf}"`);
        const size = parseInt(sizeR.trim(), 10);
        if (name.endsWith('.AppImage')) v150Entry.files['linux-x64'] = { url: name, size };
        if (name.endsWith('.deb')) v150Entry.files['linux-deb'] = { url: name, size };
      }
    }
    
    // Keep v1.50.0 as pending_review
    v150Entry.status = 'pending_review';
    
    const updatedJson = JSON.stringify(versions, null, 2);
    const verLocs = ['/var/www/downloads', '/root/lingjing-update/data', '/var/www/update-server/data', '/opt/lingjing-update/data'];
    for (const loc of verLocs) {
      await exec(`mkdir -p ${loc} && cat > ${loc}/versions.json << 'EOF'\n${updatedJson}\nEOF`);
      log(`  ${loc} updated`);
    }
    
    // Update latest-linux.yml
    log('Step 5: Updating latest-linux.yml...');
    const linuxFiles = (await exec(conn, 'ls /root/lingjing-git/packages/electron/release-*/LingJing-1.50.0-linux-* 2>/dev/null')).split('\n').filter(Boolean);
    const appImage = linuxFiles.find(f => f.includes('.AppImage'));
    const debFile = linuxFiles.find(f => f.includes('.deb'));
    
    let linuxYml = `version: ${VERSION}\nfiles:\n`;
    for (const lf of [appImage, debFile].filter(Boolean)) {
      const name = lf.split('/').pop();
      const hashR = await exec(conn, `openssl dgst -sha512 -binary "${lf}" | base64 -w0`);
      const sizeR = await exec(conn, `stat -c%s "${lf}"`);
      linuxYml += `  - url: ${name}\n    sha512: ${hashR.trim()}\n    size: ${sizeR.trim()}\n`;
    }
    const firstPath = appImage || debFile;
    const firstHash = await exec(conn, `openssl dgst -sha512 -binary "${firstPath}" | base64 -w0`);
    linuxYml += `path: ${firstPath.split('/').pop()}\nsha512: ${firstHash.trim()}\nreleaseDate: '${new Date().toISOString()}'\n`;
    await exec(conn, `cat > ${REMOTE_DL}/latest-linux.yml << 'EOF'\n${linuxYml}\nEOF`);
    log('  latest-linux.yml updated');
    
    // Restart PM2
    await exec(conn, 'pm2 restart update-server 2>/dev/null || true');
    await exec(conn, 'pm2 restart cloud-server 2>/dev/null || true');
  }

  conn.end();
  
  // Cleanup
  try { require('child_process').execSync(`del "${tarPath}"`, { stdio: 'pipe' }); } catch(e) {}
  
  log('=== Final deploy complete! ===');
}

main().catch(err => { log('Error: ' + err.message); process.exit(1); });
