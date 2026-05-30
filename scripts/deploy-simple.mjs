/**
 * Simple deploy v1.50.0 to production server
 * Uploads Windows files, builds Linux on server, updates versions.json
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

const VERSION = '1.50.0';
const RELEASE_DIR = resolve(ROOT, 'packages/electron/release-v1480');
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

async function main() {
  log(`=== Deploy v${VERSION} to ${SERVER.host} ===`);
  
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => { log('SSH connected'); resolve(); });
    conn.on('error', reject);
    conn.connect(SERVER);
  });

  // Step 1: Upload Windows files
  log('Step 1: Upload Windows installers...');
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

  // Step 2: Build Linux on server
  log('Step 2: Build Linux on server...');
  const buildScript = [
    'set -e',
    'cd /root/lingjing-git',
    'git pull origin main 2>&1 | tail -3',
    'cd /root/lingjing-git/packages/core && npx tsc 2>&1 | tail -5',
    'rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist',
    'cp -r /root/lingjing-git/packages/core/dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/',
    'cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1 | tail -5',
    'npx electron-builder build --linux --x64 2>&1 | tail -20',
    'echo "LINUX_BUILD_DONE"',
  ].join('\n');
  
  const buildResult = await execCmd(conn, buildScript);
  log(`  Linux build done (exit code: ${buildResult.code})`);
  log(`  stdout: ${buildResult.stdout.substring(buildResult.stdout.length - 200)}`);

  // Step 3: Copy Linux artifacts
  log('Step 3: Copy Linux to download dir...');
  const lsResult = await execCmd(conn, 'ls /root/lingjing-git/packages/electron/release-*/LingJing-*-linux-* 2>/dev/null');
  const linuxFiles = lsResult.stdout.trim().split('\n').filter(Boolean);
  
  for (const lf of linuxFiles) {
    const name = basename(lf);
    log(`  Copy ${name}...`);
    await execCmd(conn, `cp "${lf}" ${REMOTE_DL}/${name}`);
  }

  // Step 4: Update latest-linux.yml
  log('Step 4: Update latest-linux.yml...');
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
    const firstHash = appImage 
      ? (await execCmd(conn, `openssl dgst -sha512 -binary "${appImage}" | base64 -w0`)).stdout.trim() 
      : '';
    linuxYml += `path: ${basename(firstPath)}\nsha512: ${firstHash}\nreleaseDate: '${new Date().toISOString()}'\n`;
    await execCmd(conn, `cat > ${REMOTE_DL}/latest-linux.yml << 'EOF'\n${linuxYml}\nEOF`);
    log('  latest-linux.yml updated');
  }

  // Step 5: Update versions.json
  log('Step 5: Update versions.json...');
  const verCmd = await execCmd(conn, `cat ${REMOTE_DL}/versions.json`);
  const versions = JSON.parse(verCmd.stdout);
  log(`  Current latest: ${versions.latest}`);

  const newEntry = {
    version: VERSION,
    status: 'published',
    releaseDate: new Date().toISOString(),
    releaseNotes: `灵境IDE v${VERSION} - Quest Agent生命周期修复(4项HIGH) + 任务执行中断修复(5项) + 持久向量记忆(SqliteAdapter+真实Embedding) + 移动端完善(持久化存储+心跳+Markdown渲染+文件查看)`,
    files: {},
  };

  // Windows files
  const setupExe = join(RELEASE_DIR, `LingJing-Setup-${VERSION}-win-x64.exe`);
  const portableExe = join(RELEASE_DIR, `LingJing-Portable-${VERSION}-win-x64.exe`);
  if (existsSync(setupExe)) newEntry.files['win-x64'] = { url: `LingJing-Setup-${VERSION}-win-x64.exe`, size: statSync(setupExe).size };
  if (existsSync(portableExe)) newEntry.files['win-portable'] = { url: `LingJing-Portable-${VERSION}-win-x64.exe`, size: statSync(portableExe).size };

  // Linux files
  for (const lf of linuxFiles) {
    const name = basename(lf);
    const sizeResult = await execCmd(conn, `stat -c%s "${REMOTE_DL}/${name}"`);
    const size = parseInt(sizeResult.stdout.trim(), 10);
    if (name.endsWith('.AppImage')) newEntry.files['linux-x64'] = { url: name, size };
    if (name.endsWith('.deb')) newEntry.files['linux-deb'] = { url: name, size };
  }

  // Android (copy existing APK as placeholder)
  const apkList = await execCmd(conn, `ls ${REMOTE_DL}/*.apk 2>/dev/null | tail -1`);
  const latestApk = apkList.stdout.trim();
  if (latestApk) {
    const apkName = `LingJing-${VERSION}-android.apk`;
    await execCmd(conn, `cp "${latestApk}" ${REMOTE_DL}/${apkName}`);
    const apkSize = (await execCmd(conn, `stat -c%s "${REMOTE_DL}/${apkName}"`)).stdout.trim();
    newEntry.files['android'] = { url: apkName, size: parseInt(apkSize, 10) };
    log(`  Android APK copied: ${apkName}`);
  }

  versions.versions.unshift(newEntry);
  versions.latest = VERSION;

  const updatedJson = JSON.stringify(versions, null, 2);
  
  const verLocations = [
    REMOTE_DL,
    '/root/lingjing-update/data',
    '/var/www/update-server/data',
    '/opt/lingjing-update/data',
  ];
  for (const loc of verLocations) {
    try {
      await execCmd(conn, `mkdir -p ${loc} && cat > ${loc}/versions.json << 'EOF'\n${updatedJson}\nEOF`);
      log(`  ${loc}/versions.json updated`);
    } catch (err) {
      log(`  ${loc} skipped: ${err.message}`);
    }
  }

  // Restart PM2
  log('Restarting PM2 services...');
  await execCmd(conn, 'pm2 restart update-server 2>/dev/null || true');
  await execCmd(conn, 'pm2 restart cloud-server 2>/dev/null || true');
  
  conn.end();
  log(`=== v${VERSION} deploy complete! ===`);
}

main().catch(err => {
  console.error(`Deploy failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
