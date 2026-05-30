/**
 * Deploy v1.44.0 Windows + Linux installers to production server
 * Usage: node scripts/deploy-v1440.mjs
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
  password: 'li!@#',
};

const RELEASE_DIR = resolve(ROOT, 'packages/electron/release-v1439');
const FILES = [
  'LingJing-Setup-1.44.0-win-x64.exe',
  'LingJing-Portable-1.44.0-win-x64.exe',
];
const REMOTE_DL = '/var/www/downloads';

// SCP upload via SSH2
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

// Execute remote command
async function execCmd(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '', stderr = '';
      stream.on('data', d => stdout += d.toString());
      stream.stderr.on('data', d => stderr += d.toString());
      stream.on('close', code => {
        resolve({ code, stdout, stderr });
      });
    });
  });
}

async function main() {
  console.log(`🚀 Deploying v1.44.0 to ${SERVER.host}...`);

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect(SERVER);
  });
  console.log('✅ SSH connected');

  // Step 1: Upload Windows files
  for (const file of FILES) {
    const localPath = join(RELEASE_DIR, file);
    const remotePath = `${REMOTE_DL}/${file}`;
    if (!existsSync(localPath)) {
      console.log(`⚠️  Skipping ${file} (not found locally)`);
      continue;
    }
    const size = statSync(localPath).size;
    console.log(`📤 Uploading ${file} (${(size/1024/1024).toFixed(0)} MB)...`);
    const start = Date.now();
    await uploadFile(conn, localPath, remotePath);
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ ${file} uploaded in ${secs}s`);
  }

  // Step 2: Update latest.yml
  const latestYml = `version: 1.44.0
files:
  - url: LingJing-Setup-1.44.0-win-x64.exe
    sha512: ${(await execCmd(conn, `openssl dgst -sha512 -binary ${REMOTE_DL}/LingJing-Setup-1.44.0-win-x64.exe | base64 -w0`)).stdout.trim()}
    size: ${statSync(join(RELEASE_DIR, 'LingJing-Setup-1.44.0-win-x64.exe')).size}
path: LingJing-Setup-1.44.0-win-x64.exe
sha512: ${(await execCmd(conn, `openssl dgst -sha512 -binary ${REMOTE_DL}/LingJing-Setup-1.44.0-win-x64.exe | base64 -w0`)).stdout.trim()}
releaseDate: '${new Date().toISOString()}'
`;
  await execCmd(conn, `cat > ${REMOTE_DL}/latest.yml << 'EOF'\n${latestYml}\nEOF`);
  console.log('✅ latest.yml updated');

  // Step 3: Build Linux on server
  console.log('🔧 Building Linux packages on server...');
  const linuxBuild = await execCmd(conn, `
    cd /root/lingjing-git && git pull origin main 2>/dev/null && \
    cd packages/core && npx tsc 2>/dev/null; \
    cd /root/lingjing-git/packages/electron && \
    node scripts/build-main.mjs 2>/dev/null && \
    npx electron-builder build --linux --x64 2>&1 | tail -5
  `);
  console.log('Linux build output:', linuxBuild.stdout.substring(0, 500));

  // Step 4: Copy Linux artifacts
  const linuxFiles = await execCmd(conn, `ls /root/lingjing-git/packages/electron/release-*/LingJing-*-linux-* 2>/dev/null`);
  const linuxFileList = linuxFiles.stdout.trim().split('\n').filter(Boolean);
  for (const lf of linuxFileList) {
    const name = basename(lf);
    console.log(`📤 Copying ${name}...`);
    await execCmd(conn, `cp "${lf}" ${REMOTE_DL}/${name}`);
  }

  // Step 5: Update latest-linux.yml
  if (linuxFileList.length > 0) {
    const appImage = linuxFileList.find(f => f.includes('.AppImage'));
    const debFile = linuxFileList.find(f => f.includes('.deb'));
    let linuxYml = `version: 1.44.0\nfiles:\n`;
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
    console.log('✅ latest-linux.yml updated');
  }

  // Step 6: Update versions.json (read, modify, write)
  const verCmd = await execCmd(conn, `cat ${REMOTE_DL}/versions.json`);
  let versions;
  try {
    versions = JSON.parse(verCmd.stdout);
  } catch {
    versions = { versions: [], latest: '1.43.9' };
  }
  // Add v1.44.0 entry
  const newEntry = {
    version: '1.44.0',
    status: 'published',
    releaseDate: new Date().toISOString(),
    releaseNotes: '灵境IDE v1.44.0 - 修复@codepilot/core类型声明同步：dist/index.d.ts完整匹配dist/index.js导出',
    files: {
      'win-x64': { url: 'LingJing-Setup-1.44.0-win-x64.exe', size: statSync(join(RELEASE_DIR, 'LingJing-Setup-1.44.0-win-x64.exe')).size },
      'win-portable': { url: 'LingJing-Portable-1.44.0-win-x64.exe', size: statSync(join(RELEASE_DIR, 'LingJing-Portable-1.44.0-win-x64.exe')).size },
    },
  };
  // Add Linux files if available
  for (const lf of linuxFileList) {
    const name = basename(lf);
    const size = (await execCmd(conn, `stat -c%s "${REMOTE_DL}/${name}"`)).stdout.trim();
    if (name.includes('.AppImage')) newEntry.files['linux-x64'] = { url: name, size: parseInt(size) };
    if (name.includes('.deb')) newEntry.files['linux-deb'] = { url: name, size: parseInt(size) };
  }
  versions.versions.unshift(newEntry);
  versions.latest = '1.44.0';
  const verJson = JSON.stringify(versions, null, 2);
  await execCmd(conn, `cat > ${REMOTE_DL}/versions.json << 'EOF'\n${verJson}\nEOF`);
  console.log('✅ versions.json updated');

  // Step 7: Clean old v1.43.x files
  await execCmd(conn, `rm -f ${REMOTE_DL}/LingJing-Setup-1.43.9-win-x64.exe ${REMOTE_DL}/LingJing-Portable-1.43.9-win-x64.exe`);
  console.log('🧹 Cleaned old v1.43.9 Windows files');

  conn.end();
  console.log('🎉 v1.44.0 deployment complete!');
}

main().catch(err => {
  console.error('❌ Deployment failed:', err.message);
  process.exit(1);
});
