# 灵境 IDE — 任务跟踪

## 当前状态：✅ 全部完成，系统健康

### 最新版本：v1.44.5
发布说明：修复 5 个 Bug（索引 100K 限制、云登录超时、loadPrompts 缺失、构建产物不完整、require ESM 崩溃）+ 构建配置优化

### 已部署的平台包
| 平台 | 文件 | 大小 | 状态 |
|:-----|:-----|:----:|:----:|
| 🪟 Windows Setup | LingJing-Setup-1.44.5-win-x64.exe | 98.6 MB | ✅ 生产环境 |
| 🪟 Windows Portable | LingJing-Portable-1.44.5-win-x64.exe | ~98 MB | ✅ 生产环境 |
| 🐧 Linux AppImage | LingJing-1.44.5-linux-x86_64.AppImage | 134 MB | ✅ 生产环境 |
| 🐧 Linux deb | LingJing-1.44.5-linux-x86_64.deb | 108 MB | ✅ 生产环境 |

### Git 三端同步
- GitHub: `d8ff704e6` ✅（已推送）
- Tag `v1.44.5`: `d8ff704e6` ✅
- 本地: `d8ff704e6` ✅

### v1.44.5 修复清单
1. ✅ Bug 2: 索引 100K 限制 → 500K，支持 `DEFAULT_MAX_INDEX_FILES` 配置化
2. ✅ Bug 3: 云登录 Failed to fetch → 添加 15s AbortController 超时 + 中文友好提示
3. ✅ Bug 5: loadPrompts 导出缺失 → dist/index.js + src/index.ts 添加 13 个缺失导出
4. ✅ 构建修复: 从 external 移除 `@codepilot/core` + resolveCorePlugin 避免 ESM require 崩溃
5. ✅ Windows/Linux 全平台构建部署
6. ✅ 3 个积压 commit 推送至 GitHub

### 服务健康
- PM2: 4/4 online 🟢（cloud-server, scms-server, scms-web, update-server）
- API /health: `{"status":"ok"}` ✅
- API /latest: v1.44.5 ✅（4个平台文件全）
- 磁盘: 28%（103G 可用, 148G 总容量）✅

_如需新任务请直接提出需求_
