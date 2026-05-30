// Deploy v1.42.3 - fix @codepilot/core exports map for subdirectory exports
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = '120.55.5.220';
const USER = 'root';
const PASS = 'liu201314!@#';
const V = '1.42.3';

function run(cmd) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let o = '';
    conn.on('ready', () => {
      conn.exec(cmd, (e, s) => {
        if (e) { conn.end(); reject(e); return; }
        s.on('data', d => o += d);
        s.stderr.on('data', d => o += d);
        s.on('close', () => { conn.end(); resolve(o); });
      });
    });
    conn.on('error', reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 30000 });
  });
}

function scp(local, remote) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) { conn.end(); reject(err); return; }
        sftp.fastPut(local, remote, e => { conn.end(); e ? reject(e) : resolve(); });
      });
    });
    conn.on('error', reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 60000 });
  });
}

async function main() {
  console.log(`=== Deploy v${V} to ${HOST} ===\n`);
  
  const dir = path.join(__dirname, '..', 'packages', 'electron', `release-v1423`);
  const dl = '/var/www/downloads';
  
  const files = [
    ['灵境 Setup 1.42.3.exe', `LingJing-Setup-${V}-win-x64.exe`],
    [`LingJing-Portable-${V}-win-x64.exe`, `LingJing-Portable-${V}-win-x64.exe`],
  ];
  
  for (const [local, remote] of files) {
    const fp = path.join(dir, local);
    if (!fs.existsSync(fp)) { console.error(`Missing: ${fp}`); process.exit(1); }
    console.log(`✅ ${path.basename(fp)}: ${(fs.statSync(fp).size/1024/1024).toFixed(1)} MB`);
  }
  
  // Upload
  console.log('\n[1/3] Uploading...');
  for (const [local, remote] of files) {
    await scp(path.join(dir, local), `${dl}/${remote}`);
    console.log(`  ✅ ${remote}`);
  }
  
  // Upload latest.yml from build output (already has the right URL from electron-builder)
  const buildYml = fs.readFileSync(path.join(dir, 'latest.yml'), 'utf8');
  // Fix: replace Chinese filename with English filename for auto-updater URL
  const fixedYml = buildYml
    .replace(/灵境 Setup [\d.]+.exe/g, `LingJing-Setup-${V}-win-x64.exe`);
  
  console.log('\n[2/3] Fixing and uploading latest.yml...');
  // Write fixed yml locally first, then upload
  fs.writeFileSync(path.join(dir, 'latest-fixed.yml'), fixedYml, 'utf8');
  await scp(path.join(dir, 'latest-fixed.yml'), `${dl}/update/latest.yml`);
  await run(`cp ${dl}/update/latest.yml ${dl}/latest.yml`);
  console.log('  ✅ latest.yml uploaded and fixed');
  
  // Update versions.json - read via temp file
  console.log('\n[3/3] Updating versions.json...');
  await run(`cp ${dl}/versions.json /tmp/versions_old.json`);
  const verRaw = await run(`cat /tmp/versions_old.json`);
  const ver = JSON.parse(verRaw);
  ver.version = V;
  ver.notes = '修复: @codepilot/core exports map 缺失, 无法解析 rules/checkpoint/utils 子路径';
  ver.platforms['win-x64'] = { url: `LingJing-Setup-${V}-win-x64.exe`, signature: '' };
  // Write to a temp file via SSH using heredoc
  const verJson = JSON.stringify(ver, null, 2);
  fs.writeFileSync(path.join(dir, 'versions.json'), verJson, 'utf8');
  await scp(path.join(dir, 'versions.json'), `${dl}/versions.json`);
  console.log(`  ✅ versions.json → v${V}`);
  
  // Verify
  console.log('\n--- Verification ---');
  const checks = [
    `ls -lh ${dl}/LingJing-Setup-${V}-win-x64.exe`,
    `ls -lh ${dl}/LingJing-Portable-${V}-win-x64.exe`,
    `ls -lh ${dl}/update/latest.yml`,
    `cat ${dl}/versions.json | grep version`,
  ];
  for (const c of checks) {
    const r = await run(c);
    console.log(`  ${r.trim().substring(0, 120)}`);
  }
  
  console.log(`\n=== v${V} deploy complete ===`);
}

main().catch(e => { console.error(e); process.exit(1); });
