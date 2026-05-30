/**
 * Deploy v1.48.1 Windows installers + Linux build to production server
 * v1.48.1: Fix 3 missing IPC module registrations (batch/connector/trigger)
 * Usage: node scripts/deploy-v1481.mjs
 */
import { Client } from 'ssh2';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
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

const VERSION = '1.48.1';
const RELEASE_DIR = resolve(ROOT, `packages/electron/release-v${VERSION.replace(/\./g, '')}`);
const FILES = [
  `LingJing-Setup-${VERSION}-win-x64.exe`,
  `LingJing-Portable-${VERSION}-win-x64.exe`,
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
      stream.on('data', d => { stdout += d.toString(); });
      stream.stderr.on('data', d => { stderr += d.toString(); });
      stream.on('close', code => resolve({ code, stdout, stderr }));
    });
  });
}

async function main() {
  log(`v${VERSION} deploy to ${SERVER.host}`);
  console.log('');

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => { log('SSH connected'); resolve(); });
    conn.on('error', reject);
    conn.connect(SERVER);
  });
  console.log('');

  // Step 1: Upload Windows files
  log('Step 1/5: Upload Windows installers...');
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
  log('Step 2/5: Build Linux on server...');
  const buildScript = `
set -e
cd /root/lingjing-git
git pull origin main 2>&1 | tail -3
cd /root/lingjing-git/packages/core && npx tsc 2>&1 | tail -5
rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist
cp -r /root/lingjing-git/packages/core/dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/
cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1 | tail -5
npx electron-builder build --linux --x64 2>&1 | tail -20
echo "LINUX_BUILD_DONE"
`;
  const buildResult = await execCmd(conn, buildScript, 'BUILD');
  log(`  Linux build done (exit code: ${buildResult.code})`);
  console.log('');

  // Step 3: Copy Linux artifacts to download dir
  log('Step 3/5: Copy Linux to download dir...');
  const linuxFiles = (await execCmd(conn, `ls /root/lingjing-git/packages/electron/release-*/LingJing-*-linux-* 2>/dev/null`)).stdout.trim().split('\n').filter(Boolean);
  for (const lf of linuxFiles) {
    const name = basename(lf);
    log(`  Copy ${name}...`);
    await execCmd(conn, `cp "${lf}" ${REMOTE_DL}/${name}`);
  }
  console.log('');

  // Step 4: Update latest-linux.yml
  log('Step 4/5: Update latest-linux.yml...');
  if (linuxFiles.length > 0) {
    const appImage = linuxFiles.find(f => f.includes('.AppImage'));
    const debFile = linuxFiles.find(f => f.includes('.deb'));
    let linuxYml = `version: ${VERSION}\nfiles:\n`;
    if (appImage) {
      const hash = (await execCmd(conn, `openssl dgst -sha512 -binary "${appImage}" | base64 -w0`)).stdout.trim();
      const size = (await execCmd(conn, `stat -c%s "${appImage}"`)).stdout.trim();
      linuxYml += `  - url: ${basename(appImage)}\n    sha512: ${hash}\n    size: ${size}\n`;
    }
    if (debFile) {
      const hash = (await execCmd(conn, `openssl dgst -sha512 -binary "${debFile}" | base64 -w0`)).stdout.trim();
      const size = (await execCmd(conn, `stat -c%s "${debFile}"`)).stdout.trim();
      linuxYml += `  - url: ${basename(debFile)}\n    sha512: ${hash}\n    size: ${size}\n`;
    }
    const firstPath = appImage || debFile;
    const firstHash = appImage ? (await execCmd(conn, `openssl dgst -sha512 -binary "${appImage}" | base64 -w0`)).stdout.trim() : '';
    linuxYml += `path: ${basename(firstPath)}\nsha512: ${firstHash}\nreleaseDate: '${new Date().toISOString()}'\n`;
    await execCmd(conn, `cat > ${REMOTE_DL}/latest-linux.yml << 'EOF'\n${linuxYml}\nEOF`);
    log('  latest-linux.yml updated');
  }
  console.log('');

  // Step 5: Update versions.json
  log('Step 5/5: Update versions.json...');
  const verCmd = await execCmd(conn, `cat ${REMOTE_DL}/versions.json`);
  const versions = JSON.parse(verCmd.stdout);
  log(`  Current latest: ${versions.latest}`);

  const newEntry = {
    version: VERSION,
    status: 'published',
    releaseDate: new Date().toISOString(),
    releaseNotes: `灵境IDE v${VERSION} - 修复3个IPC模块(batch/connector/trigger)未注册问题`,
    files: {
      'win-x64': { url: `LingJing-Setup-${VERSION}-win-x64.exe`, size: statSync(join(RELEASE_DIR, `LingJing-Setup-${VERSION}-win-x64.exe`)).size },
      'win-portable': { url: `LingJing-Portable-${VERSION}-win-x64.exe`, size: statSync(join(RELEASE_DIR, `LingJing-Portable-${VERSION}-win-x64.exe`)).size },
    },
  };
  for (const lf of linuxFiles) {
    const name = basename(lf);
    const sizeResult = await execCmd(conn, `stat -c%s "${REMOTE_DL}/${name}"`);
    const size = parseInt(sizeResult.stdout.trim());
    if (name.includes('.AppImage')) newEntry.files['linux-x64'] = { url: name, size };
    if (name.includes('.deb')) newEntry.files['linux-deb'] = { url: name, size };
  }
  versions.versions.unshift(newEntry);
  versions.latest = VERSION;
  const verJson = JSON.stringify(versions, null, 2);

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

  conn.end();
  log(`v${VERSION} deploy complete!`);
}

main().catch(err => {
  console.error(`Deploy failed: ${err.message}`);
  process.exit(1);
});
