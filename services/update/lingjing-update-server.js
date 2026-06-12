/**
 * 灵境 LingJing Update Server
 * 零依赖 - 仅使用 Node.js 内置模块
 * 运行在 :3002 端口，专为 lingjing.zhejiangjinmo.com 服务
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3002;
const VERSIONS_FILE = '/var/www/lingjing/versions.json';

function getVersions() {
  try {
    if (fs.existsSync(VERSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[LingJing Update] Failed to read versions.json:', e.message);
  }
  return { latest: '1.52.3', versions: [{ version: '1.52.3' }] };
}

/**
 * Simple semver comparison: >0 if a > b, <0 if a < b, 0 if equal
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

function jsonResponse(res, data, status) {
  status = status || 200;
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function ymlResponse(res, data) {
  res.writeHead(200, { 'Content-Type': 'text/yaml; charset=utf-8' });
  res.end(data);
}

// 灰度发布检测
function handleRolloutCheck(req, res) {
  const urlObj = new URL(req.url, 'http://localhost');
  const deviceId = urlObj.searchParams.get('device') || 'unknown';
  const rolloutPercentage = parseInt(process.env.ROLLOUT_PERCENTAGE || '100', 10);
  const hash = [...deviceId].reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);
  const pct = ((hash % 10000) + 10000) % 10000 / 100;
  const enabled = pct < rolloutPercentage;
  jsonResponse(res, {
    device: deviceId, enabled, percentage: rolloutPercentage, pct: Math.round(pct * 100) / 100
  });
}

// 最低版本检测
function handleMinVersion(req, res) {
  const minVersion = process.env.MIN_VERSION || '1.64.0';
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(minVersion + '\n');
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  if (urlPath === '/api/rollout/check') { handleRolloutCheck(req, res); return; }
  if (urlPath === '/min-version.txt') { handleMinVersion(req, res); return; }

  if (urlPath === '/api/latest') {
    const data = getVersions();
    const latestVersion = data.latest;
    const urlObj = new URL(req.url, 'http://localhost');
    const currentVersion = urlObj.searchParams.get('current') || '';

    // 智能 hasUpdate：客户端传入旧版本才返回 true
    let hasUpdate = true;
    if (currentVersion) {
      hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
    }

    jsonResponse(res, {
      hasUpdate,
      version: latestVersion,
      status: 'published',
    });
    return;
  }
  if (urlPath === '/api/versions') {
    jsonResponse(res, getVersions());
    return;
  }
  if (urlPath === '/latest.yml') {
    const data = getVersions();
    const latest = data.versions?.[0];
    if (!latest) { jsonResponse(res, { error: 'no_version_found' }, 404); return; }
    // 兼容新旧两种格式
    const winUrl = latest.files?.['win-x64']?.url
      || latest.files?.installer
      || 'LingJing-Setup-' + data.latest + '-win-x64.exe';
    const winSha = latest.files?.['win-x64']?.sha512
      || latest.platforms?.['win-x64']?.sha512
      || 'TBD';
    const winSize = latest.files?.['win-x64']?.size
      || latest.platforms?.['win-x64']?.size
      || 0;
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
    ymlResponse(res, yml);
    return;
  }
  if (urlPath === '/latest-linux.yml') {
    const data = getVersions();
    const latest = data.versions?.[0];
    if (!latest) { jsonResponse(res, { error: 'no_version_found' }, 404); return; }
    const linuxUrl = latest.files?.['linux-x64']?.url
      || 'LingJing-' + data.latest + '-linux-x86_64.AppImage';
    const linuxSha = latest.files?.['linux-x64']?.sha512
      || latest.platforms?.['linux-x64']?.sha512
      || 'TBD';
    const linuxSize = latest.files?.['linux-x64']?.size
      || latest.platforms?.['linux-x64']?.size
      || 0;
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
    ymlResponse(res, yml);
    return;
  }
  if (urlPath === '/health') {
    const data = getVersions();
    jsonResponse(res, {
      status: 'ok',
      service: 'lingjing-update-server',
      version: '1.0.0',
      latestVersion: data.latest,
    });
    return;
  }
  if (urlPath === '/versions.json' || urlPath === '/') {
    const data = getVersions();
    jsonResponse(res, data);
    return;
  }
  jsonResponse(res, { error: 'not_found' }, 404);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('灵境 LingJing Update Server running on http://0.0.0.0:' + PORT);
  console.log('Data file: ' + VERSIONS_FILE);
  const data = getVersions();
  console.log('Latest version: ' + data.latest);
});
