# 灵境 IDE — 任务跟踪

## 当前状态：✅ v1.44.7 已部署

### 最新版本：v1.44.7
**发布说明**: Fix — 清理 electron-builder.json 中 stale prompts 引用（Linux 构建警告修复）

### 已部署的平台包
| 平台 | 文件 | 大小 | 状态 |
|:-----|:-----|:----:|:----:|
| 🪟 Windows Setup | LingJing-Setup-1.44.7-win-x64.exe | 131 MB | ✅ 生产环境 |
| 🪟 Windows Portable | LingJing-Portable-1.44.7-win-x64.exe | 131 MB | ✅ 生产环境 |
| 🐧 Linux AppImage | LingJing-1.44.7-linux-x86_64.AppImage | 172 MB | ✅ 生产环境 |
| 🐧 Linux deb | LingJing-1.44.7-linux-x86_64.deb | 105 MB | ✅ 生产环境 |

### v1.44.7 修复内容

**问题**: Linux 构建时出现 `file source doesn't exist from=prompts` 警告。
`packages/electron/electron-builder.json` 中 `files` 数组和 `extraResources` 引用了不存在的 `prompts/` 目录。

**修复**:
1. 从 `files` 数组移除 `"prompts/**/*"`
2. 从 `extraResources` 移除 prompts 条目
3. skills 目录保留不动（存在于 git 仓库中）

**验证**: Windows 和 Linux 构建均无 prompts 相关警告。

### Git 状态
- GitHub: `84abeb8` ✅ (main + tag v1.44.7 已推送)
- 服务器: `84abeb8` ✅
- 三端同步完成

### 服务健康
- PM2: 4/4 online 🟢
- API /api/latest: v1.44.7 (4 平台文件) ✅
- 磁盘: ~34% ✅
