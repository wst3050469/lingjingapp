const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RELEASE_DIR = 'D:/lingjing/lingjing/packages/electron/release';
const VERSION = '1.64.1';

const files = [
  `LingJing-Setup-${VERSION}-win-x64.exe`,
  `LingJing-Portable-${VERSION}-win-x64.exe`,
  `LingJing-Setup-${VERSION}-win-x64.exe.blockmap`,
  'latest.yml'
];

console.log('=== 上传到生产服务器 (120.55.5.220) ===');
for (const file of files) {
  const localPath = path.join(RELEASE_DIR, file);
  if (!fs.existsSync(localPath)) {
    console.log(`❌ 本地文件不存在: ${file}`);
    continue;
  }
  const sizeMB = Math.round(fs.statSync(localPath).size / 1024 / 1024);
  console.log(`📤 上传 ${file} (${sizeMB}MB)...`);
  
  // Upload to downloads directory
  const cmd = `pscp -pw WsT13575967132 "${localPath}" root@120.55.5.220:/var/www/html/downloads/`;
  try {
    const out = execSync(cmd, { timeout: 300000, encoding: 'utf-8' });
    console.log(`✅ ${file} 上传完成`);
  } catch (e) {
    console.log(`❌ 上传失败: ${file} - ${e.message}`);
  }
}

console.log('\n=== 更新 versions.json ===');
// SSH commands to update versions.json
const updateCmd = `ssh -o StrictHostKeyChecking=no root@120.55.5.220 "node /var/www/html/update-versions.js ${VERSION} 2>&1"`;
try {
  const out = execSync(updateCmd, { timeout: 30000, encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.log('❌ versions.json 更新失败:', e.message);
}

// Also update via direct node script
const versionsScript = 'D:/lingjing/lingjing/scripts/update-versions.js';
if (fs.existsSync(versionsScript)) {
  console.log('\n=== 本地执行 update-versions.js ===');
  try {
    const out = execSync(`node "${versionsScript}" ${VERSION}`, { timeout: 30000, encoding: 'utf-8', cwd: 'D:/lingjing/lingjing' });
    console.log(out);
  } catch (e) {
    console.log('❌ 本地 versions.json 更新失败:', e.message);
  }
}

console.log('\n=== 部署完成 ===');
