/**
 * 灵境 Update Server
 * 为 electron-updater 提供版本更新服务
 * 运行在 :3000 端口
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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
  res.json({ hasUpdate: true, version: data.latest });
});

// latest.yml - electron-updater 需要
app.get('/latest.yml', (req, res) => {
  const data = getLatestVersion();
  const latest = data.versions?.[0];
  if (!latest) {
    return res.status(404).json({ error: 'no_version_found' });
  }

  // 生成 latest.yml 格式
  const yml = `version: ${data.latest}
files:
  - url: ${latest.files?.installer || `https://zhejiangjinmo.oss-cn-shenzhen.aliyuncs.com/releases/${data.latest}/灵境-Setup-${data.latest}-win-x64.exe`}
    sha512: ${latest.sha512 || 'TBD'}
    size: ${latest.size || 0}
path: ${latest.files?.installer || `https://zhejiangjinmo.oss-cn-shenzhen.aliyuncs.com/releases/${data.latest}/灵境-Setup-${data.latest}-win-x64.exe`}
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
  const filename = req.params[1];
  const ossUrl = `https://zhejiangjinmo.oss-cn-shenzhen.aliyuncs.com/releases/${version}/${filename}`;
  res.redirect(302, ossUrl);
});

// 静态文件下载 — 提供APK/安装包直接从本地文件系统服务
app.get('/downloads/:filename', (req, res) => {
  const filename = req.params.filename;
  // 安全校验：防止路径穿越
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'invalid_filename' });
  }
  const filepath = path.join('/var/www/html/downloads', filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'file_not_found' });
  }
  res.download(filepath, filename);
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'update-server', version: '1.0.0' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`灵境 Update Server running on http://0.0.0.0:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
