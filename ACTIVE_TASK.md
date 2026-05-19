# ACTIVE_TASK — v1.43.6 全平台构建部署完成

## 当前状态: ✅ 生产运行正常

### 部署状态 (v1.43.6)

| 平台 | 文件 | 大小 | 状态 |
|:-----|:-----|:----:|:----:|
| 🪟 Windows Setup | `LingJing-Setup-1.43.6-win-x64.exe` | 131 MB | ✅ 已部署 |
| 🪟 Windows Portable | `LingJing-Portable-1.43.6-win-x64.exe` | 131 MB | ✅ 已部署 |
| 🐧 Linux AppImage | `LingJing-1.43.6-linux-x86_64.AppImage` | 171 MB | ✅ 已部署 |
| 🐧 Linux deb | `LingJing-1.43.6-linux-x86_64.deb` | 104 MB | ✅ 已部署 |

### API 状态
- `/api/latest` → `{"version":"1.43.6","hasUpdate":true}` ✅
- `latest.yml` / `latest-linux.yml` → v1.43.6 ✅
- `versions.json` → latest: 1.43.6 ✅

### 生产服务器
- cloud-server:8000 ✅ online
- update-server:3000 ✅ online
- nginx: 80/443 正常

### Git
- GitHub: `c0fd98e` — v1.43.6 文档日志更新
- Push: 通过服务器代理 (Token) ✅
- 本地直连 ❌ GFW 拦截

---

## v1.43.6 修复内容

### 问题 1：`config:set` No handler（IPC 注册依赖 mainWindow）
- **根因**：所有 IPC handler 嵌套在 `if (mainWindow)` 块内，`createWindow()` 异常时整个 IPC 注册跳过
- **修复**：拆分为 Phase A（不依赖窗口，第702-725行）+ Phase B（需要窗口，第735行以下）
- **涉及文件**：`packages/electron/src/main.ts`

### 问题 2：`loadConfig10 is not a function`
- **根因**：`packages/core/dist/index.js` 仅 78 字节，缺少 26+ 核心导出
- **修复**：重写 `dist/index.js` 添加所有命名导出（loadConfig, getModelContextWindow, getDefaultConfig, mergeConfig, createChatCompletion 等）
- **涉及文件**：`packages/core/dist/index.js`, `packages/core/src/index.ts`, `packages/electron/node_modules/@codepilot/core/dist/index.js`
