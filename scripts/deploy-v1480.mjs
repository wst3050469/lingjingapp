/**
 * Deploy v1.48.0 Windows installers to production server
 * v1.48.0: Fusion融合层完整集成 + OpenSpace宇宙可视化 + scifi-dark科技感主题 + 24项缺陷修复
 * Usage: node scripts/deploy-v1480.mjs
 */
import { Client } from 'ssh2';
import { readFileSync, existsSync, statSync } from 'fs';
import { basename, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(__dirname, '..');

const SERVER = {
  host: '120.55.5.220',
  port: 22,
  username: 'root',
  password: 'WsT13575967132',
};

const RELEASE_DIR = resolve(ROOT, 'packages/electron/release-v1480');
const FILES = [
  'LingJing-Setup-1.48.0-win-x64.exe',
  'LingJing-Portable-1.48.0-win-x64.exe',
  'latest.yml',
];
const REMOTE_DL = '/var/www/downloads';

function log(msg) {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`[${ts}] ${msg}`);
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

async function execCmd(conn, cmd, label = '') {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '', stderr = '';
      stream.on('data', d => {
        const text = d.toString();
        stdout += text;
        if (label) process.stdout.write(`  [${label}] ${text}`);
      });
      stream.stderr.on('data', d => {
        const text = d.toString();
        stderr += text;
        if (label) process.stdout.write(`  [${label} ERR] ${text}`);
      });
      stream.on('close', code => {
        resolve({ code, stdout, stderr });
      });
    });
  });
}

async function main() {
  log(`v1.48.0 deploy to ${SERVER.host}`);
  console.log('');

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => { log('SSH connected'); resolve(); });
    conn.on('error', reject);
    conn.connect(SERVER);
  });
  console.log('');

  // Step 1: Upload Windows files
  log('Step 1/6: Upload Windows installers...');
  for (const file of FILES) {
    const localPath = join(RELEASE_DIR, file);
    const remotePath = `${REMOTE_DL}/${file}`;
    if (!existsSync(localPath)) {
      log(`  SKIP ${file} (not found)`);
      continue;
    }
    const sizeMB = (statSync(localPath).size / 1024 / 1024).toFixed(0);
    log(`  Upload ${file} (${sizeMB} MB)...`);
    const start = Date.now();
    await uploadFile(conn, localPath, remotePath);
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    log(`  Done (${secs}s)`);
  }
  console.log('');

  // Step 2: Build Linux on server
  log('Step 2/6: Build Linux on server...');
  console.log('  -----------------------------------------');

  const buildScript = `
set -e
echo "[1/5] Pull latest source..."
cd /root/lingjing-git && git pull origin main 2>&1 | tail -3

echo "[2/5] Build @codepilot/core..."
cd /root/lingjing-git/packages/core && npx tsc 2>&1 | tail -5

echo "[3/5] Sync dist to electron node_modules..."
rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist
cp -r /root/lingjing-git/packages/core/dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/

echo "[4/5] Build Electron main process..."
cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1 | tail -5

echo "[5/5] Build Linux (AppImage + deb)..."
cd /root/lingjing-git/packages/electron && npx electron-builder build --linux --x64 2>&1 | tail -20

echo "DONE"
`;

  const buildResult = await execCmd(conn, buildScript, 'BUILD');
  console.log('  -----------------------------------------');
  log(`  Linux build done (exit code: ${buildResult.code})`);
  console.log('');

  // Step 3: Copy Linux artifacts
  log('Step 3/6: Copy Linux to download dir...');
  const linuxFiles = await execCmd(conn, `ls /root/lingjing-git/packages/electron/release-*/LingJing-*-linux-* 2>/dev/null`, '');
  const linuxFileList = linuxFiles.stdout.trim().split('\n').filter(Boolean);
  for (const lf of linuxFileList) {
    const name = basename(lf);
    log(`  Copy ${name}...`);
    await execCmd(conn, `cp "${lf}" ${REMOTE_DL}/${name}`);
    const sizeResult = await execCmd(conn, `stat -c%s "${REMOTE_DL}/${name}"`);
    const sizeMB = (parseInt(sizeResult.stdout.trim()) / 1024 / 1024).toFixed(0);
    log(`  ${name} (${sizeMB} MB)`);
  }
  console.log('');

  // Step 4: Update latest-linux.yml
  log('Step 4/6: Update latest-linux.yml...');
  if (linuxFileList.length > 0) {
    const appImage = linuxFileList.find(f => f.includes('.AppImage'));
    const debFile = linuxFileList.find(f => f.includes('.deb'));
    let linuxYml = `version: 1.48.0\nfiles:\n`;
    if (appImage) {
      const appHash = (await execCmd(conn, `openssl dgst -sha512 -binary "${appImage}" | base64 -w0`)).stdout.trim();
      const appSize = (await execCmd(conn, `stat -c%s "${appImage}"`)).stdout.trim();
      linuxYml += `  - url: ${basename(appImage)}\n    sha512: ${appHash}\n    size: ${appSize}\n`;
    }
    if (debFile) {
      const debHash = (await execCmd(conn, `openssl dgst -sha512 -binary "${debFile}" | base64 -w0`)).stdout.trim();
      const debSize = (await execCmd(conn, `stat -c%s "${debFile}"`)).stdout.trim();
      linuxYml += `  - url: ${basename(debFile)}\n    sha512: ${debHash}\n    size: ${debSize}\n`;
    }
    const firstPath = appImage || debFile;
    const firstHash = appImage ? (await execCmd(conn, `openssl dgst -sha512 -binary "${appImage}" | base64 -w0`)).stdout.trim() : '';
    linuxYml += `path: ${basename(firstPath)}\nsha512: ${firstHash}\nreleaseDate: '${new Date().toISOString()}'\n`;
    await execCmd(conn, `cat > ${REMOTE_DL}/latest-linux.yml << 'EOF'\n${linuxYml}\nEOF`);
    log('  latest-linux.yml updated');
  } else {
    log('  No Linux artifacts, skip');
  }
  console.log('');

  // Step 5: Update versions.json (4 locations)
  log('Step 5/6: Update versions.json...');
  const verCmd = await execCmd(conn, `cat ${REMOTE_DL}/versions.json`);
  let versions;
  try {
    versions = JSON.parse(verCmd.stdout);
    log(`  Current latest: ${versions.latest}`);
  } catch {
    versions = { versions: [], latest: '1.43.2' };
    log('  Parse failed, recreating');
  }

  const newEntry = {
    version: '1.48.0',
    status: 'published',
    releaseDate: new Date().toISOString(),
    releaseNotes: '灵境IDE v1.48.0 - Fusion融合层完整集成(Hermes 14特性+OpenSpace宇宙可视化+scifi-dark科技感主题+24项缺陷修复)',
    files: {
      'win-x64': { url: 'LingJing-Setup-1.48.0-win-x64.exe', size: statSync(join(RELEASE_DIR, 'LingJing-Setup-1.48.0-win-x64.exe')).size },
      'win-portable': { url: 'LingJing-Portable-1.48.0-win-x64.exe', size: statSync(join(RELEASE_DIR, 'LingJing-Portable-1.48.0-win-x64.exe')).size },
    },
  };
  for (const lf of linuxFileList) {
    const name = basename(lf);
    const sizeResult = await execCmd(conn, `stat -c%s "${REMOTE_DL}/${name}"`);
    const size = parseInt(sizeResult.stdout.trim());
    if (name.includes('.AppImage')) newEntry.files['linux-x64'] = { url: name, size };
    if (name.includes('.deb')) newEntry.files['linux-deb'] = { url: name, size };
  }
  versions.versions.unshift(newEntry);
  versions.latest = '1.48.0';
  const verJson = JSON.stringify(versions, null, 2);

  // Update all 4 versions.json locations
  const verLocations = [
    REMOTE_DL,
    '/root/lingjing-update/data',
    '/var/www/update-server/data',
    '/opt/lingjing-update/data',
  ];
  for (const loc of verLocations) {
    try {
      await execCmd(conn, `mkdir -p ${loc} && cat > ${loc}/versions.json << 'EOF'\n${verJson}\nEOF`);
      log(`  ${loc}/versions.json updated`);
    } catch (err) {
      log(`  ${loc} skipped: ${err.message}`);
    }
  }
  console.log('');

  // Step 6: Clean old + restart
  log('Step 6/6: Clean old files + restart services...');
  await execCmd(conn, `cd ${REMOTE_DL} && ls LingJing-Setup-1.4[0-7]*.exe LingJing-Portable-1.4[0-7]*.exe LingJing-*-1.4[0-7]*-linux-* 2>/dev/null | head -20 | xargs -r rm -f`);
  log('  Old v1.4x files cleaned');
  await execCmd(conn, `pm2 restart cloud-server 2>&1 | tail -3`);
  log('  PM2 cloud-server restarted');

  conn.end();
  console.log('');
  log('v1.48.0 deploy complete!');
}

main().catch(err => {
  console.error(`Deploy failed: ${err.message}`);
  process.exit(1);
});
