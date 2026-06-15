/**
 * 灵境 Update Server
 * 为 electron-updater 提供版本更新服务
 * 运行在 :3000 端口 (实际部署在 :3001)
 *
 * v1.2.1 - /latest.yml & /latest-linux.yml 兼容新版 files key 格式
 *   - 新增 resolveFileInfo() 支持 win-x64_setup / linux-x64_appimage 等新 key
 *   - 新增 /latest-linux.yml 端点 (Linux AppImage 自动更新)
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// OSS base URL for download fallback (configurable via env)
const OSS_BASE_URL = process.env.OSS_BASE_URL || 'https://zhejiangjinmo.oss-cn-shenzhen.aliyuncs.com';

// 版本数据路径 — 多路径回退（权威来源优先）
const VERSION_SEARCH_PATHS = [
  '/var/www/html/versions.json',                            // PRIMARY: authoritative source (Admin + Nginx)
  path.join(__dirname, 'data', 'versions.json'),           // Local data dir
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

/**
 * Resolve file info from versions.json with multi-key fallback
 * Supports both new format (win-x64_setup, linux-x64_appimage) and old (win-x64, linux-x64)
 */
function resolveFileInfo(latest, primaryKeys, fallbackKeys, platformKey) {
  // Try primary keys first (new format)
  for (const key of primaryKeys) {
    if (latest.files?.[key]) return latest.files[key];
  }
  // Try fallback keys (old format)
  for (const key of fallbackKeys) {
    if (latest.files?.[key]) return latest.files[key];
  }
  // Try platforms
  if (platformKey && latest.platforms?.[platformKey]) return latest.platforms[platformKey];
  return null;
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

  // 查找最新版本的完整信息（包含下载链接）
  const latestEntry = data.versions?.find(v => v.version === latestVersion && v.status === 'published');
  const response = {
    hasUpdate,
    version: latestVersion,
    status: 'published',
  };
  if (latestEntry?.files) {
    response.files = { ...latestEntry.files };
    // 移动端兼容: android → android-apk 别名
    if (response.files['android-apk']) {
      response.files.android = response.files['android-apk'];
    }
  }
  if (latestEntry?.platforms) {
    response.platforms = latestEntry.platforms;
  }

  res.json(response);
});

// latest.yml - electron-updater (Windows) 需要
app.get('/latest.yml', (req, res) => {
  const data = getLatestVersion();
  const latest = data.versions?.[0];
  if (!latest) {
    return res.status(404).json({ error: 'no_version_found' });
  }

  // 兼容新旧多种格式: win-x64_setup > win-setup > win-x64 > installer
  const winInfo = resolveFileInfo(latest,
    ['win-x64_setup', 'win-setup'],
    ['win-x64', 'win-x64_portable'],
    'win-x64'
  );
  const winUrl = winInfo?.url
    || latest.files?.installer
    || `${OSS_BASE_URL}/releases/${data.latest}/LingJing-Setup-${data.latest}-win-x64.exe`;
  const winSha = winInfo?.sha512 || 'TBD';
  const winSize = winInfo?.size || 0;

  // 生成 latest.yml 格式（electron-updater 标准格式）
  const yml = [
    'version: ' + data.latest,
    'files:',
    '  - url: ' + winUrl,
    '    sha512: ' + winSha,
    '    size: ' + winSize,
    'path: ' + winUrl,
    'sha512: ' + winSha,
    'releaseDate: ' + (latest.releaseDate || new Date().toISOString()),
    ''
  ].join('\n');

  res.set('Content-Type', 'text/yaml');
  res.send(yml);
});

// latest-linux.yml - electron-updater (Linux AppImage) 需要
app.get('/latest-linux.yml', (req, res) => {
  const data = getLatestVersion();
  const latest = data.versions?.[0];
  if (!latest) {
    return res.status(404).json({ error: 'no_version_found' });
  }

  // 兼容新旧格式: linux-x64_appimage > linux-x64
  const linuxInfo = resolveFileInfo(latest,
    ['linux-x64_appimage'],
    ['linux-x64', 'linux-x86_64'],
    'linux-x64'
  );
  const linuxUrl = linuxInfo?.url
    || 'LingJing-' + data.latest + '-linux-x86_64.AppImage';
  const linuxSha = linuxInfo?.sha512 || 'TBD';
  const linuxSize = linuxInfo?.size || 0;

  const yml = [
    'version: ' + data.latest,
    'files:',
    '  - url: ' + linuxUrl,
    '    sha512: ' + linuxSha,
    '    size: ' + linuxSize,
    'path: ' + linuxUrl,
    'sha512: ' + linuxSha,
    'releaseDate: ' + (latest.releaseDate || new Date().toISOString()),
    ''
  ].join('\n');

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
    version: '1.2.1',
    latestVersion: data.latest,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`灵境 Update Server running on http://0.0.0.0:${PORT}`);
  console.log(`Search paths: ${VERSION_SEARCH_PATHS.length} configured`);
  const data = getLatestVersion();
  console.log(`Latest version: ${data.latest}`);
});
