# ACTIVE_TASK -- v1.52.10 综合修复完成

## 状态：✅ 全部完成

## 当前交付

| 项目 | 版本 | 大小 | 状态 |
|:-----|:----:|:----:|:----:|
| 🪟 Windows Setup | v1.52.9 | 142 MB | ✅ 未变（仅Linux+Android更新） |
| 🪟 Windows Portable | v1.52.9 | 142 MB | ✅ 未变 |
| 🐧 Linux AppImage | v1.52.10 | 173 MB | ✅ 已部署 |
| 🐧 Linux deb | v1.52.10 | 105 MB | ✅ 已部署 |
| 📱 Android APK | v1.52.10 | 78 MB | ✅ 已部署 |

## 本轮变更（4个Bug修复）

### Bug1: Linux窗口缩放
- `main.ts`: minWidth/minHeight 动态适配 + Linux zoomFactor
- 构建: AppImage 173MB + Deb 105MB

### Bug2: 后台版本管理路径
- `admin-api.js`: 新增3个versions.json搜索路径
- 解决: 后台只读到v1.52.5旧文件的问题

### Bug3/4: APP连接链+配对自动连接
- `App.tsx`: 重写initConnection()连接链（云账号JWT→LAN→FRP→配对页）
- `PairingScreen.tsx`: FRP通道改用需认证的`/api/sessions`端点
- `ConnectionBanner.tsx`: 明确显示"FRP 中转"模式
- `server.js` (cloud): 新增`/api/status`无认证诊断端点

## 影响文件(6)
- `main.ts` | `admin-api.js` | `server.js` | `App.tsx` | `PairingScreen.tsx` | `ConnectionBanner.tsx`

## Git 同步
- GitHub: ✅ `dbdd165cd`
- 生产 bare repo (120.55.5.220): ✅ `dbdd165cd`
- 构建服务器 (192.168.1.9): ✅ 文件已同步

## 生产服务器状态
- API `/api/latest` → v1.52.10 ✅
- API `/api/versions` → 14个版本 ✅
- API `/api/status` → 正常 ✅
- 8个 versions.json 全部一致 ✅
- Nginx online ✅ (APK fallback → v1.52.10)
- update-server (3001): online ✅ (version: 1.52.10)
- lingjing-update-server (3002): online ✅
- cloud-server (8000): online ✅

## 版本号
- packages/electron/package.json: **1.52.10**
- package.json: **1.52.10**
- app.json (mobile): **1.52.10**
