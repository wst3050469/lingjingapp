#!/usr/bin/env node
// Deploy v1.42.2 Windows build to production server 120.55.5.220
// Fix: fast-glob ESM named import in @codepilot/core/security/scanner.js

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const REMOTE_HOST = '120.55.5.220';
const REMOTE_USER = 'root';
const REMOTE_PASS = 'liu201314!@#';
const VERSION = '1.42.2';

async function runSSH(cmd) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';
    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) { conn.end(); reject(err); return; }
        stream.on('data', d => output += d.toString());
        stream.stderr.on('data', d => output += d.toString());
        stream.on('close', (code) => {
          conn.end();
          if (code !== 0) reject(new Error(`Exit code ${code}:\n${output}`));
          else resolve(output);
        });
      });
    });
    conn.on('error', e => reject(e));
    conn.connect({ host: REMOTE_HOST, port: 22, username: REMOTE_USER, password: REMOTE_PASS, readyTimeout: 30000 });
  });
}

async function runSSHNoCheck(cmd) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';
    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) { conn.end(); reject(err); return; }
        stream.on('data', d => output += d.toString());
        stream.stderr.on('data', d => output += d.toString());
        stream.on('close', () => { conn.end(); resolve(output); });
      });
    });
    conn.on('error', e => reject(e));
    conn.connect({ host: REMOTE_HOST, port: 22, username: REMOTE_USER, password: REMOTE_PASS, readyTimeout: 30000 });
  });
}

async function scpFile(localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) { conn.end(); reject(err); return; }
        sftp.fastPut(localPath, remotePath, (err) => {
          conn.end();
          if (err) reject(err);
          else resolve();
        });
      });
    });
    conn.on('error', e => reject(e));
    conn.connect({ host: REMOTE_HOST, port: 22, username: REMOTE_USER, password: REMOTE_PASS, readyTimeout: 60000 });
  });
}

async function main() {
  console.log(`=== Deploy v${VERSION} to ${REMOTE_HOST} ===\n`);
  const startTime = Date.now();

  const releaseDir = path.join(__dirname, '..', 'packages', 'electron', 'release-v1422');
  const downloadsDir = '/var/www/downloads';

  // Files to upload
  const files = [
    path.join(releaseDir, `灵境 Setup ${VERSION}.exe`),
    path.join(releaseDir, `LingJing-Portable-${VERSION}-win-x64.exe`),
    path.join(releaseDir, 'latest.yml'),
  ];

  // Check all local files exist
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`❌ Missing: ${f}`);
      process.exit(1);
    }
    const stats = fs.statSync(f);
    console.log(`✅ ${path.basename(f)}: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
  }

  // Step 1: Upload files
  console.log('\n[1/4] Uploading build artifacts...');
  try {
    await runSSHNoCheck(`mkdir -p ${downloadsDir}/update`);

    // Upload Setup (named for auto-updater: LingJing-Setup-VERSION-win-x64.exe)
    const setupRemoteName = `LingJing-Setup-${VERSION}-win-x64.exe`;
    console.log('  Uploading Setup...');
    await scpFile(files[0], `${downloadsDir}/${setupRemoteName}`);
    console.log('  ✅ Setup uploaded');

    // Upload Portable
    console.log('  Uploading Portable...');
    await scpFile(files[1], `${downloadsDir}/LingJing-Portable-${VERSION}-win-x64.exe`);
    console.log('  ✅ Portable uploaded');

    // Upload latest.yml
    console.log('  Uploading latest.yml...');
    await scpFile(files[2], `${downloadsDir}/update/latest.yml`);
    console.log('  ✅ latest.yml uploaded');
  } catch (e) {
    console.error('❌ Upload failed:', e.message);
    return;
  }

  // Step 2: Update versions.json on all 5 sources
  console.log('\n[2/4] Updating versions.json...');
  const versionFiles = [
    '/var/www/downloads/versions.json',
    '/root/lingjing-update/data/versions.json',
    '/opt/lingjing-cloud-server/versions.json',
    '/opt/lingjing-update-server/data/versions.json',
  ];

  const versionsPayload = {
    version: VERSION,
    notes: "修复: fast-glob ESM 具名导入错误 (security/scanner.js)",
    pub_date: new Date().toISOString(),
    platforms: {
      "win-x64": {
        url: `LingJing-Setup-${VERSION}-win-x64.exe`,
        signature: ""
      }
    }
  };

  for (const vf of versionFiles) {
    try {
      const exists = await runSSHNoCheck(`test -f ${vf} && echo "exists" || echo "not_found"`);
      if (exists.trim() === 'not_found') {
        console.log(`  ⚠️ ${vf} not found, skipping`);
        continue;
      }
      await runSSHNoCheck(`cat > ${vf} << 'VJSON'
${JSON.stringify(versionsPayload, null, 2)}
VJSON`);
      console.log(`  ✅ Updated ${vf}`);
    } catch (e) {
      console.log(`  ⚠️ Failed to update ${vf}: ${e.message.substring(0, 80)}`);
    }
  }

  // Step 3: Copy latest.yml to root
  console.log('\n[3/4] Copying latest.yml to root...');
  try {
    await runSSHNoCheck(`cp ${downloadsDir}/update/latest.yml ${downloadsDir}/latest.yml`);
    console.log('  ✅ latest.yml copied to downloads root');
  } catch (e) {
    console.log(`  ⚠️ ${e.message.substring(0, 80)}`);
  }

  // Step 4: Verify deployment
  console.log('\n[4/4] Verifying deployment...');
  try {
    const checks = [
      `ls -lh ${downloadsDir}/LingJing-Setup-${VERSION}-win-x64.exe`,
      `ls -lh ${downloadsDir}/LingJing-Portable-${VERSION}-win-x64.exe`,
      `ls -lh ${downloadsDir}/update/latest.yml`,
      `ls -lh ${downloadsDir}/versions.json`,
    ];
    for (const check of checks) {
      try {
        const out = await runSSHNoCheck(check);
        console.log(`  ${out.trim()}`);
      } catch {
        console.log(`  ⚠️ Check failed: ${check}`);
      }
    }

    // Verify HTTP endpoints
    const httpChecks = [
      `curl -sI https://ide.zhejiangjinmo.com/downloads/LingJing-Setup-${VERSION}-win-x64.exe | head -3`,
      `curl -sI https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-${VERSION}-win-x64.exe | head -3`,
      `curl -s https://ide.zhejiangjinmo.com/versions.json | head -5`,
    ];
    for (const check of httpChecks) {
      try {
        const out = await runSSHNoCheck(check);
        console.log(`  ${out.substring(0, 100).trim()}`);
      } catch {
        console.log(`  ⚠️ HTTP check failed`);
      }
    }
  } catch (e) {
    console.log(`  ⚠️ Verification issue: ${e.message.substring(0, 80)}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n=== Deploy v${VERSION} complete (${elapsed} min) ===`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
