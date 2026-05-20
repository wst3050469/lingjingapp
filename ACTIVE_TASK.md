# 灵境 IDE — 任务跟踪

## 当前状态：✅ v1.44.6 已部署

### 最新版本：v1.44.6
发布说明：Critical fix — ESM/CJS module mismatch (require is not defined)

### 已部署的平台包
| 平台 | 文件 | 大小 | 状态 |
|:-----|:-----|:----:|:----:|
| 🪟 Windows Setup | LingJing-Setup-1.44.6-win-x64.exe | 131 MB | ✅ 生产环境 |
| 🪟 Windows Portable | LingJing-Portable-1.44.6-win-x64.exe | 130 MB | ✅ 生产环境 |
| 🐧 Linux AppImage | LingJing-1.44.6-linux-x86_64.AppImage | 178 MB | ✅ 生产环境 |
| 🐧 Linux deb | LingJing-1.44.6-linux-x86_64.deb | 108 MB | ✅ 生产环境 |

### v1.44.6 修复内容

**Bug**: `ReferenceError: require is not defined in ES module scope`
用户在安装版灵境启动时遇到此错误，崩溃无法使用。

**双根因分析：**

1. **`packages/electron/package.json` 含 `"type": "module"`** 
   - 这个文件在早期版本中被错误地替换成了 `@codepilot/core` 的 package.json 副本
   - ASAR 根目录 package.json 声明了 ESM 模块类型
   - Node.js/Electron 尝试将 CJS 格式的 `main.js` 作为 ESM 加载
   - 所有 `require()` 调用因 `require is not defined` 而崩溃

2. **3 个子路径保持 external**
   - `checkpoint`、`rules`、`utils` 在 `build-main.cjs` 中被标记为 external
   - 运行时 `require('@codepilot/core/checkpoint')` 加载 ESM 文件 → CJS/ESM 不兼容

**修复方案：**
- **Fix 1**: 恢复 `packages/electron/package.json` 的正确格式（`name: lingjing-ide`，无 `type:module`，正确依赖列表）
- **Fix 2**: 从 `build-main.cjs` 的 external 列表中移除 checkpoint/rules/utils，全部 bundle 进 main.js
- 验证：main.js 中 0 个 external `@codepilot/core` require，CheckpointManager 等已内联打包

### Git 三端同步
- GitHub: `cab3109` ✅（通过服务器中转推送）
- Tag `v1.44.6`: `cab3109` ✅
- 服务器: `cab3109` ✅

### 服务健康
- PM2: 4/4 online 🟢
- API /api/latest: v1.44.6 (4 平台文件) ✅
- 磁盘: ~29% ✅
