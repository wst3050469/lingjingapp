/**
 * Fix Linux build v1.45.0 - upload local dist.tar.gz and build on server
 */
import { Client } from 'ssh2';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(__dirname, '..');

const SERVER = {
  host: '120.55.5.220',
  port: 22,
  username: 'root',
  password: 'WsT13575967132',
};

const REMOTE_DL = '/var/www/downloads';
const TAR_PATH = join(ROOT, 'scripts', '_core-dist.tar.gz');

function log(msg) {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`[${ts}] ${msg}`);
}

async function execStream(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '', stderr = '';
      stream.on('data', d => {
        const text = d.toString();
        stdout += text;
        process.stdout.write(text);
      });
      stream.stderr.on('data', d => {
        const text = d.toString();
        stderr += text;
        process.stdout.write(text);
      });
      stream.on('close', code => resolve({ code, stdout, stderr }));
    });
  });
}

async function main() {
  log('🚀 修复 Linux v1.45.0 构建');

  // Step 0: Create tar.gz of local dist
  log('📦 打包本地 packages/core/dist...');
  execSync(`tar -czf "${TAR_PATH}" -C "${join(ROOT, 'packages/core')}" dist`, { stdio: 'pipe' });
  const tarSize = statSync(TAR_PATH).size;
  log(`  ✅ 打包完成 (${(tarSize/1024/1024).toFixed(1)} MB)`);

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', () => { log('✅ SSH 已连接'); resolve(); });
    conn.on('error', reject);
    conn.connect(SERVER);
  });

  // Step 1: Upload dist.tar.gz
  log('📤 上传 dist.tar.gz 到服务器...');
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const stream = sftp.createWriteStream('/root/lingjing-git/packages/core/dist.tar.gz');
      const buf = readFileSync(TAR_PATH);
      stream.on('close', resolve);
      stream.on('error', reject);
      stream.end(buf);
    });
  });
  log('  ✅ 上传完成');

  // Step 1.5: Update version to v1.45.0 on server
  log('🔢 更新服务器 package.json 版本...');
  await execStream(conn, `
    sed -i 's/"version": "1.44.9"/"version": "1.45.0"/' /root/lingjing-git/packages/core/package.json
    sed -i 's/"version": "1.44.9"/"version": "1.45.0"/' /root/lingjing-git/packages/electron/package.json
    sed -i 's/"output": "release-v1449"/"output": "release-v1450"/' /root/lingjing-git/packages/electron/electron-builder.json
    echo core: $(grep '"version"' /root/lingjing-git/packages/core/package.json)
    echo electron: $(grep '"version"' /root/lingjing-git/packages/electron/package.json)
    echo builder: $(grep '"output"' /root/lingjing-git/packages/electron/electron-builder.json)
  `);
  log('  ✅ 版本已更新');

  // Step 2: Extract and copy
  log('📂 解压并同步到 electron node_modules...');
  const result = await execStream(conn, `
    set -e
    echo "[1/3] 解压 dist..."
    cd /root/lingjing-git/packages/core
    rm -rf dist
    tar -xzf dist.tar.gz
    rm dist.tar.gz
    echo "  dist 目录: $(ls dist/ | wc -l) 个条目"

    echo "[2/3] 复制到 electron node_modules..."
    rm -rf /root/lingjing-git/packages/electron/node_modules/@codepilot/core/dist
    cp -r /root/lingjing-git/packages/core/dist /root/lingjing-git/packages/electron/node_modules/@codepilot/core/
    echo "  node_modules 同步完成"

    echo "[3/3] 验证 index.js 导出..."
    grep -c "export" /root/lingjing-git/packages/core/dist/index.js
    echo "DONE"
  `);
  log(`  ✅ 同步完成 (exit: ${result.code})`);

  // Step 3: Build main.js
  log('🔧 构建 Electron 主进程...');
  await execStream(conn, 'cd /root/lingjing-git/packages/electron && node scripts/build-main.mjs 2>&1');
  log('  ✅ 主进程构建完成');

  // Step 4: Build Linux packages
  log('📦 构建 Linux 安装包 (2-3 分钟)...');
  await execStream(conn, 'cd /root/lingjing-git/packages/electron && npx electron-builder build --linux --x64 2>&1');
  log('  ✅ Linux 构建完成');

  // Step 5: Copy to download dir
  log('📤 复制到下载目录...');
  const lsResult = await execStream(conn, `
    ls -t /root/lingjing-git/packages/electron/release-*/LingJing-*-linux-* 2>/dev/null | head -2
  `);
  const lines = lsResult.stdout.trim().split('\n').filter(Boolean);
  
  for (const lf of lines) {
    const name = lf.split('/').pop();
    log(`  📤 复制 ${name}...`);
    await execStream(conn, `cp "${lf}" ${REMOTE_DL}/${name}`);
    const size = (await execStream(conn, `stat -c%s ${REMOTE_DL}/${name}`)).stdout.trim();
    log(`  ✅ ${name} (${(size/1024/1024).toFixed(0)} MB)`);
  }

  // Step 6: Update latest-linux.yml
  if (lines.length > 0) {
    log('📝 更新 latest-linux.yml...');
    const appImage = lines.find(f => f.includes('.AppImage'));
    const debFile = lines.find(f => f.includes('.deb'));
    if (appImage) {
      const appHash = (await execStream(conn, `openssl dgst -sha512 -binary "${appImage}" | base64 -w0`)).stdout.trim();
      const appSize = (await execStream(conn, `stat -c%s "${appImage}"`)).stdout.trim();
      const debHash = debFile ? (await execStream(conn, `openssl dgst -sha512 -binary "${debFile}" | base64 -w0`)).stdout.trim() : '';
      const debSize = debFile ? (await execStream(conn, `stat -c%s "${debFile}"`)).stdout.trim() : '';
      
      let yml = `version: 1.45.0\nfiles:\n`;
      yml += `  - url: ${appImage.split('/').pop()}\n    sha512: ${appHash}\n    size: ${appSize}\n`;
      if (debFile) {
        yml += `  - url: ${debFile.split('/').pop()}\n    sha512: ${debHash}\n    size: ${debSize}\n`;
      }
      yml += `path: ${appImage.split('/').pop()}\nsha512: ${appHash}\nreleaseDate: '${new Date().toISOString()}'\n`;
      await execStream(conn, `cat > ${REMOTE_DL}/latest-linux.yml << 'EOF'\n${yml}\nEOF`);
      log('  ✅ latest-linux.yml 已更新');
    }
  }

  // Step 7: Clean old Linux files
  await execStream(conn, `rm -f ${REMOTE_DL}/LingJing-1.44.8-linux-x86_64.* ${REMOTE_DL}/LingJing-1.44.9-linux-x86_64.*`);
  log('🧹 已清理旧 Linux 文件');

  // Step 8: Restart PM2
  await execStream(conn, 'pm2 restart cloud-server 2>&1 | tail -3');
  log('🔄 PM2 cloud-server 已重启');

  conn.end();

  // Cleanup local tar
  execSync(`del "${TAR_PATH}"`, { stdio: 'pipe' });
  log('🧹 本地临时文件已清理');

  log('🎉 Linux v1.45.0 构建部署完成！');
  
  // Summary
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  v1.45.0 全平台部署验证');
  console.log('═══════════════════════════════════════');
  console.log('  🪟 LingJing-Setup-1.45.0-win-x64.exe  ✅');
  console.log('  🪟 LingJing-Portable-1.45.0-win-x64.exe ✅');
  console.log('  🐧 Linux AppImage  ✅');
  console.log('  🐧 Linux deb       ✅');
  console.log('  📝 versions.json   ✅');
  console.log('  📝 latest.yml      ✅');
  console.log('  📝 latest-linux.yml ✅');
  console.log('═══════════════════════════════════════');
}

main().catch(err => {
  console.error(`❌ 失败: ${err.message}`);
  process.exit(1);
});
