/**
 * Deploy v1.45.0 Windows + Linux installers to production server
 * Usage: node scripts/deploy-v1450.mjs
 */
import { Client } from 'ssh2';
import { readFileSync, existsSync, statSync } from 'fs';
import { basename, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stdout as cout, stderr as cerr } from 'process';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(__dirname, '..');

const SERVER = {
  host: '120.55.5.220',
  port: 22,
  username: 'root',
  password: 'WsT13575967132',
};

const RELEASE_DIR = resolve(ROOT, 'packages/electron/release-v1450');
const FILES = [
  'LingJing-Setup-1.45.0-win-x64.exe',
  'LingJing-Portable-1.45.0-win-x64.exe',
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
  log(`🚀 开始部署 v1.45.0 到 ${SERVER.host}`);
  console.log('');

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => { log('✅ SSH 连接成功'); resolve(); });
    conn.on('error', reject);
    conn.connect(SERVER);
  });
  console.log('');

  // Step 1: Upload Windows files
  log('📤 步骤 1/6: 上传 Windows 安装包...');
  for (const file of FILES) {
    const localPath = join(RELEASE_DIR, file);
    const remotePath = `${REMOTE_DL}/${file}`;
    if (!existsSync(localPath)) {
      log(`  ⚠️  跳过 ${file} (本地未找到)`);
      continue;
    }
    const sizeMB = (statSync(localPath).size / 1024 / 1024).toFixed(0);
    log(`  📤 上传 ${file} (${sizeMB} MB)...`);
    const start = Date.now();
    await uploadFile(conn, localPath, remotePath);
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    log(`  ✅ 完成 (${secs}秒)`);
  }
  console.log('');

  // Step 2: Build Linux on server
  log('🔧 步骤 2/6: 服务器构建 Linux 安装包');
  log('  ⏳ 此步骤需要 5-10 分钟，输出实时显示：');
  console.log('  ─────────────────────────────────────────');

  const buildScript = `
set -e
echo "[1/5] 拉取最新源码..."
cd /root/lingjing-git && git pull origin main 2>&1 | tail -3

echo "[2/5] 编译 @codepilot/core..."
cd /root/lingjing-git/packages/core && npx tsc 2>&1 | tail -5

echo "[3/5] 复制 dist 到 electron node_modules..."
rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist
cp -r /root/lingjing-git/packages/core/dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/

echo "[4/5] 构建 Electron 主进程..."
cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1 | tail -5

echo "[5/5] 构建 Linux 安装包 (AppImage + deb)..."
cd /root/lingjing-git/packages/electron && npx electron-builder build --linux --x64 2>&1 | tail -20

echo "DONE"
`;

  const buildResult = await execCmd(conn, buildScript, 'BUILD');
  console.log('  ─────────────────────────────────────────');
  log(`  ✅ Linux 构建完成 (exit code: ${buildResult.code})`);
  console.log('');

  // Step 3: Copy Linux artifacts
  log('📤 步骤 3/6: 复制 Linux 安装包到下载目录...');
  const linuxFiles = await execCmd(conn, `ls /root/lingjing-git/packages/electron/release-*/LingJing-*-linux-* 2>/dev/null`, '');
  const linuxFileList = linuxFiles.stdout.trim().split('\n').filter(Boolean);
  for (const lf of linuxFileList) {
    const name = basename(lf);
    log(`  📤 复制 ${name}...`);
    await execCmd(conn, `cp "${lf}" ${REMOTE_DL}/${name}`);
    const sizeResult = await execCmd(conn, `stat -c%s "${REMOTE_DL}/${name}"`);
    const sizeMB = (parseInt(sizeResult.stdout.trim()) / 1024 / 1024).toFixed(0);
    log(`  ✅ ${name} (${sizeMB} MB)`);
  }
  console.log('');

  // Step 4: Update latest-linux.yml
  log('📝 步骤 4/6: 更新 latest-linux.yml...');
  if (linuxFileList.length > 0) {
    const appImage = linuxFileList.find(f => f.includes('.AppImage'));
    const debFile = linuxFileList.find(f => f.includes('.deb'));
    let linuxYml = `version: 1.45.0\nfiles:\n`;
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
    log('  ✅ latest-linux.yml 已更新');
  } else {
    log('  ⚠️  未找到 Linux 构建产物，跳过');
  }
  console.log('');

  // Step 5: Update versions.json
  log('📝 步骤 5/6: 更新 versions.json...');
  const verCmd = await execCmd(conn, `cat ${REMOTE_DL}/versions.json`);
  let versions;
  try {
    versions = JSON.parse(verCmd.stdout);
    log(`  📖 当前最新版本: ${versions.latest}`);
  } catch {
    versions = { versions: [], latest: '1.44.9' };
    log('  ⚠️  解析失败，重新创建');
  }

  const newEntry = {
    version: '1.45.0',
    status: 'published',
    releaseDate: new Date().toISOString(),
    releaseNotes: '灵境IDE v1.45.0 - 新增版本审核流程UI（reviewStatus: draft→review→published）',
    files: {
      'win-x64': { url: 'LingJing-Setup-1.45.0-win-x64.exe', size: statSync(join(RELEASE_DIR, 'LingJing-Setup-1.45.0-win-x64.exe')).size },
      'win-portable': { url: 'LingJing-Portable-1.45.0-win-x64.exe', size: statSync(join(RELEASE_DIR, 'LingJing-Portable-1.45.0-win-x64.exe')).size },
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
  versions.latest = '1.45.0';
  const verJson = JSON.stringify(versions, null, 2);
  await execCmd(conn, `cat > ${REMOTE_DL}/versions.json << 'EOF'\n${verJson}\nEOF`);
  log('  ✅ versions.json 已更新');
  console.log('');

  // Step 6: Clean old files + restart
  log('🧹 步骤 6/6: 清理旧文件 + 重启服务...');
  await execCmd(conn, `rm -f ${REMOTE_DL}/LingJing-Setup-1.44.9-win-x64.exe ${REMOTE_DL}/LingJing-Portable-1.44.9-win-x64.exe`);
  log('  ✅ 已清理旧 v1.44.9 Windows 文件');
  await execCmd(conn, `pm2 restart cloud-server 2>&1 | tail -3`);
  log('  ✅ PM2 cloud-server 已重启');

  conn.end();
  console.log('');
  log('🎉 v1.45.0 全平台部署完成！');
}

main().catch(err => {
  console.error(`❌ 部署失败: ${err.message}`);
  process.exit(1);
});
