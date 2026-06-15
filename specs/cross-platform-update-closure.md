# 跨平台在线升级完整度修复

## 审计结论
经全面代码审查 + 线上验证，发现 **3 个 Bug** 需要修复：

---

## Bug #1 (Critical): 移动端 APK 下载 URL 断裂

### 问题验证
- 服务器 `/api/latest` → `files['android-apk'].url` = `/downloads/1.73.86/LingJing-1.73.86-android.apk`
- 移动端代码查找 `data.files.android` → `undefined` → fallback 到 `/downloads/lingjing-v1.73.86.apk` → **HTTP 404**

### 根因
`versions.json` 用 key `android-apk`，但移动端两个文件都用 key `android`

### 修改方案
**双端对齐** — 服务器+客户端都改：

| 文件 | 修改 |
|------|------|
| `services/update/app.js:102-104` | `/api/latest` 响应增加 `android` 别名 = `android-apk` |
| `services/update/lingjing-update-server.js:150-156` | 同上 |
| `mobile/src/services/api.ts:310-314` | 查找 key 优先级: `android-apk` → `android` |
| `mobile/src/components/UpdateChecker.tsx:41-45` | 同上 |

### 潜在风险
- **低**: 仅在 `/api/latest` 响应中新增别名，不改变现有 key，向后兼容
- **测试点**: `curl /api/latest | jq '.files.android'` 应返回有效 URL

---

## Bug #2 (Critical): 桌面端 latest.yml / latest-linux.yml 静态文件过期

### 问题验证
```
/api/latest         → "version": "1.73.86" ✅
/latest.yml         → "version: 1.73.85"  ❌ (Nginx 静态文件, Last-Modified: Jun 15)
/latest-linux.yml   → "version: 1.73.85"  ❌
```

### 根因
Nginx 直接 serve 静态文件 `/var/www/html/latest.yml`，部署 v1.73.86 时未更新这两个文件

### 修改方案
**方案 A（推荐）**: 重新生成静态 yml 文件并部署到服务器
- 无需改代码，只需执行部署操作

**方案 B**: 修改 Nginx 将 `/latest.yml` 代理到 update-server 动态生成
- 需要改 nginx 配置，涉及更多变更

**采用方案 A** — 最小改动

### 潜在风险
- **低**: 仅更新静态文件内容，不改变服务拓扑
- **测试点**: `curl /latest.yml && curl /latest-linux.yml` 均应返回 1.73.86

---

## Bug #3 (Medium): HTTP fallback 下载硬编码 win-x64 平台

### 位置
`desktop/electron/src/ipc/update-ipc.ts:876`

```typescript
const downloadUrl = files['win-x64']?.url || files['win-x64'];
```

### 问题
Linux/macOS 用户若触发 HTTP fallback 下载路径，会尝试下载 Windows exe

### 修改方案
根据 `process.platform` 选择正确的 key：

| Platform | Primary Key | Fallback |
|----------|-------------|----------|
| win32 | `win-x64_setup` | `win-x64` |
| linux | `linux-x64_appimage` | `linux-x64` |
| darwin | `mac-x64` | `mac` |

### 潜在风险
- **低**: HTTP fallback 是 electron-updater 失败后的备用路径，极少触发
- **测试点**: 模拟 Linux 环境验证 download URL 解析正确

---

## 影响文件汇总

| 文件 | 操作 | Bug |
|------|------|-----|
| `services/update/app.js` | 修改: `/api/latest` 增加 android 别名 | #1 |
| `services/update/lingjing-update-server.js` | 修改: `/api/latest` 增加 android 别名 | #1 |
| `mobile/src/services/api.ts` | 修改: download URL 兼容 android-apk key | #1 |
| `mobile/src/components/UpdateChecker.tsx` | 修改: download URL 兼容 android-apk key | #1 |
| `desktop/electron/src/ipc/update-ipc.ts` | 修改: HTTP fallback 平台感知 | #3 |
| 生产: `/var/www/downloads/latest.yml` | 重新生成静态文件 (Nginx root) | #2 |
| 生产: `/var/www/downloads/latest-linux.yml` | 重新生成静态文件 (Nginx root) | #2 |
| 生产: `/root/cloud-server/server.js` | `readVersionInfo()` 增加 android 别名 | #1 |
| 生产: `/var/www/html/versions.json` | 更新 latest→1.73.87 + releaseNotes | ALL |

### 关键发现 (部署中踩坑)
1. **Nginx yml 路由**: `location ~* \.(yml)# 跨平台在线升级完整度修复

## 审计结论
经全面代码审查 + 线上验证，发现 **3 个 Bug** 需要修复：

---

## Bug #1 (Critical): 移动端 APK 下载 URL 断裂

### 问题验证
- 服务器 `/api/latest` → `files['android-apk'].url` = `/downloads/1.73.86/LingJing-1.73.86-android.apk`
- 移动端代码查找 `data.files.android` → `undefined` → fallback 到 `/downloads/lingjing-v1.73.86.apk` → **HTTP 404**

### 根因
`versions.json` 用 key `android-apk`，但移动端两个文件都用 key `android`

### 修改方案
**双端对齐** — 服务器+客户端都改：

| 文件 | 修改 |
|------|------|
| `services/update/app.js:102-104` | `/api/latest` 响应增加 `android` 别名 = `android-apk` |
| `services/update/lingjing-update-server.js:150-156` | 同上 |
| `mobile/src/services/api.ts:310-314` | 查找 key 优先级: `android-apk` → `android` |
| `mobile/src/components/UpdateChecker.tsx:41-45` | 同上 |

### 潜在风险
- **低**: 仅在 `/api/latest` 响应中新增别名，不改变现有 key，向后兼容
- **测试点**: `curl /api/latest | jq '.files.android'` 应返回有效 URL

---

## Bug #2 (Critical): 桌面端 latest.yml / latest-linux.yml 静态文件过期

### 问题验证
```
/api/latest         → "version": "1.73.86" ✅
/latest.yml         → "version: 1.73.85"  ❌ (Nginx 静态文件, Last-Modified: Jun 15)
/latest-linux.yml   → "version: 1.73.85"  ❌
```

### 根因
Nginx 直接 serve 静态文件 `/var/www/html/latest.yml`，部署 v1.73.86 时未更新这两个文件

### 修改方案
**方案 A（推荐）**: 重新生成静态 yml 文件并部署到服务器
- 无需改代码，只需执行部署操作

**方案 B**: 修改 Nginx 将 `/latest.yml` 代理到 update-server 动态生成
- 需要改 nginx 配置，涉及更多变更

**采用方案 A** — 最小改动

### 潜在风险
- **低**: 仅更新静态文件内容，不改变服务拓扑
- **测试点**: `curl /latest.yml && curl /latest-linux.yml` 均应返回 1.73.86

---

## Bug #3 (Medium): HTTP fallback 下载硬编码 win-x64 平台

### 位置
`desktop/electron/src/ipc/update-ipc.ts:876`

```typescript
const downloadUrl = files['win-x64']?.url || files['win-x64'];
```

### 问题
Linux/macOS 用户若触发 HTTP fallback 下载路径，会尝试下载 Windows exe

### 修改方案
根据 `process.platform` 选择正确的 key：

| Platform | Primary Key | Fallback |
|----------|-------------|----------|
| win32 | `win-x64_setup` | `win-x64` |
| linux | `linux-x64_appimage` | `linux-x64` |
| darwin | `mac-x64` | `mac` |

### 潜在风险
- **低**: HTTP fallback 是 electron-updater 失败后的备用路径，极少触发
- **测试点**: 模拟 Linux 环境验证 download URL 解析正确

---

## 影响文件汇总

| 文件 | 操作 | Bug |
|------|------|-----|
| `services/update/app.js` | 修改: `/api/latest` 增加 android 别名 | #1 |
| `services/update/lingjing-update-server.js` | 修改: `/api/latest` 增加 android 别名 | #1 |
| `mobile/src/services/api.ts` | 修改: download URL 兼容 android-apk key | #1 |
| `mobile/src/components/UpdateChecker.tsx` | 修改: download URL 兼容 android-apk key | #1 |
| `desktop/electron/src/ipc/update-ipc.ts` | 修改: HTTP fallback 平台感知 | #3 |
 的 root 是 `/var/www/downloads/`，不是 `/var/www/html/`
2. **cloud-server 才是 /api/latest 真正的后端**: nginx 将 `/api/` 代理到 `127.0.0.1:8000`，不是 update-server
3. **cloud-server 文件覆盖**: 需 `pm2 stop cloud-server` → `cat > file` 才能写入 (cp/scp 均 Operation not permitted)

## 部署计划 ✅ ALL DONE
1. ✅ 修改代码 → git commit (430fd16)
2. ✅ 重新生成 latest.yml / latest-linux.yml → 上传到 `/var/www/downloads/`
3. ✅ scp app.js → /opt/lingjing/update-server/ + pm2 restart
4. ✅ scp lingjing-update-server.js → /opt/lingjing-update-server/ + pm2 restart
5. ✅ 修复 cloud-server/server.js → pm2 stop/start
6. ✅ 更新 versions.json → latest=1.73.87, 同步到 3 个路径
7. ✅ 全端点验证通过
8. ✅ 版本号 bump → v1.73.87 (4 个 package.json + app.json + electron-builder.json)
9. ✅ Git push → production + ide-origin + github + build-machine
