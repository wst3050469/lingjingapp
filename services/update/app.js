/**
 * 灵境 Update Server
 * 为 electron-updater 提供版本更新服务
 * 运行在 :3000 端口 (实际部署在 :3001)
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// OSS base URL for download fallback (configurable via env)
const OSS_BASE_URL = process.env.OSS_BASE_URL || 'https://zhejiangjinmo.oss-cn-shenzhen.aliyuncs.com';

// 版本数据路径 — 多路径回退
const VERSION_SEARCH_PATHS = [
  path.join(__dirname, 'data', 'versions.json'),           // Primary: local data dir
  '/var/www/html/versions.json',                            // Authoritative source
  '/opt/lingjing/update-server/data/versions.json',        // Standard path
  '/opt/lingjing/update-server/versions.json',             // Alternate
  '/var/www/lingjing/versions.json',                       // Legacy
  '/root/lingjing-update/data/versions.json',              // Fallback
];

// 读取版本信息
function getLatestVersion() {
  for (const p of VERSION_SEARCH_PATHS) {
    try {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        console.log('[Update] Loaded versions.json from:', p);
        return data;
      }
    } catch (e) {
      // try next path
    }
  }
  console.error('[Update] No versions.json found in any path, using default');
  return { latest: '1.0.32', versions: [{ version: '1.0.32' }] };
}

/**
 * Simple semver comparison: returns >0 if a > b, <0 if a < b, 0 if equal
 */
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

// ── API 端点 ──

// 版本检测 API — 支持客户端传入当前版本号进行对比
app.get('/api/latest', (req, res) => {
  const data = getLatestVersion();
  const latestVersion = data.latest;
  const currentVersion = req.query.current || '';

  // 如果客户端传入了当前版本号，进行对比判断
  let hasUpdate = true;
  if (currentVersion) {
    hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
  }

  res.json({
    hasUpdate,
    version: latestVersion,
    status: 'published',
  });
});

// latest.yml - electron-updater 需要
app.get('/latest.yml', (req, res) => {
  const data = getLatestVersion();
  const latest = data.versions?.[0];
  if (!latest) {
    return res.status(404).json({ error: 'no_version_found' });
  }

  // 兼容两种格式: 新格式 (files.platform.url) 和旧格式 (installer/portable/mobile)
  const installerUrl = latest.files?.['win-x64']?.url
    || latest.files?.installer
    || `${OSS_BASE_URL}/releases/${data.latest}/LingJing-Setup-${data.latest}-win-x64.exe`;

  const installerSha = latest.files?.['win-x64']?.sha512
    || latest.platforms?.['win-x64']?.sha512
    || latest.sha512
    || 'TBD';

  const installerSize = latest.files?.['win-x64']?.size
    || latest.platforms?.['win-x64']?.size
    || latest.size
    || 0;

  // 生成 latest.yml 格式（electron-updater 标准格式）
  const yml = `version: ${data.latest}
files:
  - url: ${installerUrl}
    sha512: ${installerSha}
    size: ${installerSize}
path: ${installerUrl}
sha512: ${installerSha}
releaseDate: ${latest.releaseDate || new Date().toISOString()}
`;

  res.set('Content-Type', 'text/yaml');
  res.send(yml);
});

// 版本列表
app.get('/api/versions', (req, res) => {
  res.json(getLatestVersion());
});

// 下载重定向
app.get('/download/:version/*', (req, res) => {
  const version = req.params.version;
  const filename = req.params[0];
  const ossUrl = `${OSS_BASE_URL}/releases/${version}/${filename}`;
  res.redirect(302, ossUrl);
});

// 健康检查
app.get('/health', (req, res) => {
  const data = getLatestVersion();
  res.json({
    status: 'ok',
    service: 'update-server',
    version: '1.0.0',
    latestVersion: data.latest,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`灵境 Update Server running on http://0.0.0.0:${PORT}`);
  console.log(`Search paths: ${VERSION_SEARCH_PATHS.length} configured`);
  const data = getLatestVersion();
  console.log(`Latest version: ${data.latest}`);
});
