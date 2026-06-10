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

  if (req.url === '/api/latest') {
    const data = getVersions();
    jsonResponse(res, { hasUpdate: true, version: data.latest });
    return;
  }
  if (req.url === '/api/versions') {
    jsonResponse(res, getVersions());
    return;
  }
  if (req.url === '/latest.yml') {
    const data = getVersions();
    const latest = data.versions?.[0];
    if (!latest) { jsonResponse(res, { error: 'no_version_found' }, 404); return; }
    const yml = [
      'version: ' + data.latest,
      'files:',
      '  - url: ' + (latest.files?.['win-x64']?.url || 'LingJing-Setup-' + data.latest + '-win-x64.exe'),
      '    sha512: ' + (latest.files?.['win-x64']?.sha512 || latest.files?.['win-x64-portable']?.sha512 || 'TBD'),
      '    size: ' + (latest.files?.['win-x64']?.size || 0),
      'path: ' + (latest.files?.['win-x64']?.url || 'LingJing-Setup-' + data.latest + '-win-x64.exe'),
      'releaseDate: ' + (latest.releaseDate || new Date().toISOString()),
      ''
    ].join('\n');
    ymlResponse(res, yml);
    return;
  }
  if (req.url === '/latest-linux.yml') {
    const data = getVersions();
    const latest = data.versions?.[0];
    if (!latest) { jsonResponse(res, { error: 'no_version_found' }, 404); return; }
    const yml = [
      'version: ' + data.latest,
      'files:',
      '  - url: ' + (latest.files?.['linux-x64']?.url || 'LingJing-' + data.latest + '-linux-x86_64.AppImage'),
      '    sha512: ' + (latest.files?.['linux-x64']?.sha512 || latest.files?.['linux-deb']?.sha512 || 'TBD'),
      '    size: ' + (latest.files?.['linux-x64']?.size || 0),
      'path: ' + (latest.files?.['linux-x64']?.url || 'LingJing-' + data.latest + '-linux-x86_64.AppImage'),
      'releaseDate: ' + (latest.releaseDate || new Date().toISOString()),
      ''
    ].join('\n');
    ymlResponse(res, yml);
    return;
  }
  if (req.url === '/health') {
    jsonResponse(res, { status: 'ok', service: 'lingjing-update-server', version: '1.0.0' });
    return;
  }
  if (req.url === '/versions.json' || req.url === '/') {
    const data = getVersions();
    jsonResponse(res, data);
    return;
  }
  jsonResponse(res, { error: 'not_found' }, 404);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('灵境 LingJing Update Server running on http://0.0.0.0:' + PORT);
  console.log('Data file: ' + VERSIONS_FILE);
});
