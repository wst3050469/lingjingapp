# 灵境 IDE — 任务跟踪

## 当前状态：✅ v1.44.8 已部署

### 最新版本：v1.44.8
**发布说明**: Fix — 清理 electron-builder.json 中 stale skills 引用（Linux 构建警告修复）

### 已部署的平台包
| 平台 | 文件 | 大小 | 状态 |
|:-----|:-----|:----:|:----:|
| 🪟 Windows Setup | LingJing-Setup-1.44.8-win-x64.exe | 131 MB | ✅ 生产环境 |
| 🪟 Windows Portable | LingJing-Portable-1.44.8-win-x64.exe | 131 MB | ✅ 生产环境 |
| 🐧 Linux AppImage | LingJing-1.44.8-linux-x86_64.AppImage | 172 MB | ✅ 生产环境 |
| 🐧 Linux deb | LingJing-1.44.8-linux-x86_64.deb | 105 MB | ✅ 生产环境 |

### v1.44.8 修复内容

**问题**: Linux 构建时出现 `file source doesn't exist from=skills` 警告。
`packages/electron/electron-builder.json` 中 `extraResources` 引用了不在 Git 中的 `skills/` 目录。

**修复**: 从 `extraResources` 移除 skills 条目，并删除空的 extraResources 数组。

**验证**: Windows 和 Linux 构建均无 extraResources 相关警告。

### Git 状态
- GitHub: `1b33539` ✅ (main + tag v1.44.8)
- 服务器: `1b33539` ✅
- 本地: `e3cf106c8` ✅
- 三端同步完成

### 服务健康
- PM2: 4/4 online 🟢
- API /api/latest: v1.44.8 (4 平台文件) ✅
- 磁盘: ~34% ✅
