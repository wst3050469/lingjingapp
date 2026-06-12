# 版本检测异常排查指南

> 适用场景：桌面端/移动APP已安装最新版本，但仍提示更新或版本号异常

## 快速自检（30秒）

在客户端设备上访问以下URL，检查返回的版本号：

```
https://ide.zhejiangjinmo.com/api/latest
```

如果返回的 `version` 字段 **不等于** 你已安装的版本号，说明服务器数据源过期。

## 排查步骤

### Step 1: 确认客户端当前版本

| 平台 | 查看方式 |
|------|----------|
| 桌面端 | 设置 → 高级 → 当前版本 |
| 移动端 | 设置 → 版本信息 |
| 命令行 | 桌面端打开 DevTools → `require('electron').app.getVersion()` |

### Step 2: 检查 API 返回的版本号

```bash
# 外网
curl https://ide.zhejiangjinmo.com/api/latest

# 内网（SSH到服务器）
curl http://localhost:3002/api/latest   # cloud-server
curl http://localhost:3000/api/latest   # update-server
curl http://localhost:3000/latest.yml   # electron-updater
```

**预期**: 所有端点返回一致的版本号，且与客户端版本一致。

### Step 3: 检查版本数据源文件

```bash
# SSH到服务器后执行
grep '"latest"' /var/www/lingjing/versions.json \
               /var/www/html/versions.json \
               /opt/lingjing/update-server/data/versions.json

head -1 /var/www/lingjing/latest.yml
head -1 /var/www/downloads/latest.yml
```

**预期**: 所有文件的 `latest` 字段一致。

### Step 4: 检查服务状态

```bash
pm2 list
# cloud-server, update-server, lingjing-update-server 三个必须 online
```

### Step 5: 检查版本比较逻辑

客户端的版本比较规则：

```
if (serverVersion > localVersion) → 提示更新
if (serverVersion <= localVersion) → 不提示
```

**常见误报场景**：
- 服务器返回旧版本 → 不会误报（但版本号显示错误）
- 服务器返回版本号格式异常（如 `v1.0` vs `1.0.0`）→ 比较逻辑可能出错
- 服务器返回 `hasUpdate: true` 但客户端不做本地对比 → 始终误报

## 已知问题速查表

| 现象 | 根因 | 修复 |
|------|------|------|
| `/api/latest` 版本号过低 | `/var/www/lingjing/versions.json` 过期 | `cp /var/www/html/versions.json /var/www/lingjing/versions.json` |
| `latest.yml` 版本号过低 | `/var/www/lingjing/latest.yml` 过期 | `cp /var/www/downloads/latest.yml /var/www/lingjing/latest.yml` |
| 更新提示始终出现 | 服务端 `hasUpdate` 永远返回 true | 重启已修复的 cloud-server / update-server |
| 部分请求版本号不一致 | cloud-server 缓存未刷新 | `pm2 restart cloud-server` |
| download URL 404 | `latest.yml` 中文件名不匹配 | 检查 `/var/www/downloads/` 下是否有对应文件 |

## 一键修复（SSH到服务器）

```bash
# 1. 同步版本文件
cp /var/www/html/versions.json /var/www/lingjing/versions.json
cp /var/www/downloads/latest.yml /var/www/lingjing/latest.yml

# 2. 同步所有 update-server 的 versions.json
for dir in /opt/lingjing/update-server/data /root/lingjing-update/data /var/www/update-server/data /opt/lingjing-update/data; do
  cp /var/www/html/versions.json "$dir/versions.json"
done

# 3. 重启所有服务
pm2 restart cloud-server update-server lingjing-update-server

# 4. 验证
curl https://ide.zhejiangjinmo.com/api/latest
```

## 架构参考

```
┌──────────────────────────────────────────────────────────────────┐
│                      版本检测数据流                                │
├──────────────┬───────────────────┬───────────────────────────────┤
│ 数据源        │ 路径               │ 使用者                         │
├──────────────┼───────────────────┼───────────────────────────────┤
│ versions.json│ /var/www/lingjing/  │ cloud-server (端口3002)        │
│              │                   │ lingjing-update-server         │
│ versions.json│ /var/www/html/     │ Web下载页                      │
│ versions.json│ /opt/../data/      │ update-server (端口3000)       │
│ latest.yml   │ /var/www/downloads/│ electron-updater (桌面端)      │
│ latest.yml   │ /var/www/lingjing/ │ electron-updater 备用          │
├──────────────┴───────────────────┴───────────────────────────────┤
│                      客户端请求路径                                │
├──────────────┬───────────────────┬───────────────────────────────┤
│ /api/latest  │ → cloud-server    │ 桌面 httpCheckVersion           │
│              │                   │ 移动端 UpdateChecker            │
│ /latest.yml  │ → nginx proxy     │ 桌面 VersionService YAML回退    │
│ /downloads/  │ → nginx static    │ 桌面 electron-updater           │
│   latest.yml │                   │                               │
└──────────────┴───────────────────┴───────────────────────────────┘
```
