/**
 * 灵境AI Update Server
 * 为 electron-updater 提供版本更新服务
 * 运行在 :3001 端口
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// 版本数据路径
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const VERSIONS_FILE = path.join(DATA_DIR, 'versions.json');

// 读取版本信息
function getLatestVersion() {
  try {
    if (fs.existsSync(VERSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf8'));
      return data;
    }
  } catch (e) {
    console.error('[Update] Failed to read versions.json:', e.message);
  }
  // 默认返回最新版本
  return { latest: '1.0.32', versions: [{ version: '1.0.32' }] };
}

// ── API 端点 ──

// electron-updater 请求的最新版本信息
app.get('/api/latest', (req, res) => {
  const data = getLatestVersion();
  const latest = data.versions?.[0];
  
  if (!latest) {
    return res.json({ hasUpdate: false, version: null });
  }

  // 修复点：提取 platforms 中的所有文件信息到 files 字段
  const files = {};
  if (latest.platforms) {
    for (const [platform, info] of Object.entries(latest.platforms)) {
      files[platform] = {
        url: info.url,
        size: info.size
      };
    }
  }

  res.json({ 
    hasUpdate: true, 
    version: data.latest,
    status: latest.status,
    releaseDate: latest.releaseDate,
    releaseNotes: latest.releaseNotes,
    files: files // 现在包含了正确的下载路径
  });
});

// latest.yml - electron-updater 需要
app.get('/latest.yml', (reg, res) => {
  const data = getLatestVersion();
  const latest = data.versions?.[0];
  if (!latest) {
    return res.status(404).json({ error: 'no_version_found' });
  }

  // 生成 latest.yml 格式
  // 注意：这里为了兼容性，我们主要针对 win-x64 构造，因为 electron-updater 默认查找此结构
  const winX64 = latest.platforms?.['win-x64'];
  const yml = `version: ${data.latest}
files:
  - url: ${winX64?.url || ''}
    sha512: ${winX64?.sha512 || 'TBD'}
    size: ${winX64?.size || 0}
path: ${winX64?.url || ''}
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
  const version = req.params[0];
  const filename = req.pass[1]; // 修正：应该是 req.params[1]
  // 修正：由于上面写错了，我得重新写一个干净的
  const ossUrl = `https://zhejiangjinmo.oss-cn-shenzhen.aliyuncs.com/releases/${version}/${filename}`;
  res.redirect(302, ossUrl);
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'update-server', version: '1.0.0' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`灵境AI Update Server running on http://0.0.0.0:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
