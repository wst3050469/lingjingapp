/**
 * 灵境 LingJing Update Server
 * 零依赖 - 仅使用 Node.js 内置模块
 * 运行在 :3002 端口，专为灵境移动端版本更新服务
 *
 * v1.2.1 - /latest.yml & /latest-linux.yml 兼容新版 files key 格式
 *   - 新增 win-x64_setup / win-x64_portable / linux-x64_appimage 等 key 支持
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3002;
const CACHE_TTL_MS = 60000; // 60 second cache
const VERSION_SEARCH_PATHS = [
  '/var/www/html/versions.json',                       // PRIMARY: authoritative source
  '/var/www/lingjing/versions.json',                   // Default path
  '/opt/lingjing-update-server/versions.json',         // Local fallback
  '/opt/lingjing-update-server/data/versions.json',    // Data dir fallback
  '/opt/lingjing/update-server/versions.json',         // Update-server
  '/var/www/downloads/versions.json',                  // Downloads
];

// ── Memory cache ──
let _cache = { data: null, ts: 0, path: '' };

function getVersions() {
  const now = Date.now();
  // Return cached data if still fresh
  if (_cache.data && (now - _cache.ts) < CACHE_TTL_MS) {
    return _cache.data;
  }
  for (const p of VERSION_SEARCH_PATHS) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const data = JSON.parse(raw);
        _cache = { data, ts: now, path: p };
        console.error('[LingJing Update] Loaded versions.json from:', p, '(cached for 60s)');
        return data;
      }
    } catch (e) {
      console.error('[LingJing Update] Failed to read', p, ':', e.message);
    }
  }
  // Return stale cache if available (better than crashing)
  if (_cache.data) {
    console.error('[LingJing Update] All paths failed, returning stale cache from:', _cache.path);
    return _cache.data;
  }
  console.error('[LingJing Update] No versions.json found, using default');
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

const server = http.createServer((req, res) => {
  try {
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

      // 查找最新版本的完整信息（包含下载链接）
      const latestEntry = data.versions?.find(v => v.version === latestVersion && v.status === 'published');
      const response = {
        hasUpdate,
        version: latestVersion,
        status: 'published',
      };
      // 附加多平台下载链接
      if (latestEntry?.files) {
        response.files = latestEntry.files;
      }
      if (latestEntry?.platforms) {
        response.platforms = latestEntry.platforms;
      }

      jsonResponse(res, response);
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
      // 兼容新旧多种格式: win-x64_setup > win-setup > win-x64 > installer
      const winInfo = resolveFileInfo(latest,
        ['win-x64_setup', 'win-setup'], 
        ['win-x64', 'win-x64_portable'],
        'win-x64'
      );
      const winUrl = winInfo?.url
        || latest.files?.installer
        || 'LingJing-Setup-' + data.latest + '-win-x64.exe';
      const winSha = winInfo?.sha512 || 'TBD';
      const winSize = winInfo?.size || 0;
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
      ymlResponse(res, yml);
      return;
    }
    if (urlPath === '/health') {
      const data = getVersions();
      jsonResponse(res, {
        status: 'ok',
        service: 'lingjing-update-server',
        version: '1.2.1',
        latestVersion: data.latest,
        cacheAge: Date.now() - _cache.ts,
      });
      return;
    }
    if (urlPath === '/versions.json' || urlPath === '/') {
      const data = getVersions();
      jsonResponse(res, data);
      return;
    }
    jsonResponse(res, { error: 'not_found' }, 404);
  } catch (err) {
    console.error('[LingJing Update] Request handler error:', err.message);
    try {
      jsonResponse(res, { error: 'internal_server_error' }, 500);
    } catch {
      // If response already sent, nothing we can do
    }
  }
});

// ── Crash protection: catch uncaught exceptions ──
process.on('uncaughtException', (err) => {
  console.error('[LingJing Update] UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  // Don't exit — keep the server running
});

process.on('unhandledRejection', (reason) => {
  console.error('[LingJing Update] UNHANDLED REJECTION:', reason);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('灵境 LingJing Update Server running on http://0.0.0.0:' + PORT);
  console.log('Search paths: ' + VERSION_SEARCH_PATHS.join(', '));
  const data = getVersions();
  console.log('Latest version: ' + data.latest);
});
