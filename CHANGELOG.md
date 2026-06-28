# CHANGELOG

## v1.73.132 (2026-06-20)

### Changed
- **OpenSpace 清理**: 移除 OpenSpace 宇宙功能所有代码引用（主进程 IPC、UI Store、数据库迁移、Core 融合层、cloud-server API、测试文件等），tsc 编译通过无错误

## v1.73.131 (2026-06-20)

### Fixed
- **下载页 stuck on v1.73.120**: `downloads.js` 中 `macX64Url`/`macArm64Url` 未声明导致 ReferenceError，JS 崩溃后触发硬编码 v1.73.120 fallback。修复: 添加 macOS 变量声明 + fallback 版本号更新

## v1.73.130 (2026-06-20)

### Added
- **RemoteFolderPicker 上传/下载**: 远程文件夹选择器新增文件列表、下载按钮、上传按钮、刷新功能
- **cloud-server 自动备份**: versions.json 每6小时自动备份 + 启动时自动恢复（版本数<5触发）

### Fixed
- **Windows 安装包修复**: 解决 app-builder-bin@5.0.0-alpha.10 文件锁定 bug，Windows 安装包现为真正 v1.73.130
- **versions.json 历史恢复**: 从备份恢复 12 个版本历史（曾被截断到2条）

### Changed
- 6 平台完整部署: Windows Setup + Portable + Blockmap + Linux AppImage + DEB + Android

### Fixed (Hotfix)
- **下载页 v1.73.120**: `downloads.js` 中 `macX64Url`/`macArm64Url` 未声明导致 ReferenceError，JS 崩溃后触发硬编码 fallback。修复: 添加 macOS 变量声明 + fallback 版本号更新至 v1.73.130

---

## v1.73.129 (2026-06-20)

### Fixed
- **工作区持久化**: `loadWorkspaceFromConfig()` 提前到 `createWindow()` 之前，修复重启后工作区丢失
- **技能详情 404**: `fetchSkillDetail` 添加 `encodeURIComponent`
- **GitHub 导入退出**: `spawn('git',...)` stderr 累计匹配 + 中文 Git 输出正则 + 超时竞态修复

### Added
- `PRAGMA integrity_check` + `quick_check` 防 SQLite 损坏

---

## v1.73.127 (2026-06-19)

### Fixed
- 技能市场: skills.sh API 401 → cloud-server 代理
- GitHub 一键生成: `spawn` 替代 `exec` + 分步进度事件
- 远程文件夹: 支持上传下载文件

---

## v1.73.120 (2026-06-19)

### Fixed
- **Black Screen Crash**: 移除 `schema.js` 中不完全的 `quest.github` Zod 定义，修复 Linux AppImage 打开黑屏问题
- **GitHub Token 持久化**: `integrations` Zod 对象添加 `.passthrough()`，修复 GitHub/Supabase 连接状态保存后丢失的问题

### Added
- **Windows EXE** (Setup 134MB + Portable 134MB) v1.73.120 全量重新编译

### Changed
- Linux AppImage (180MB) + DEB (326MB) 全量重编译部署
- Windows EXE 沿用 v1.73.119（Schema 兼容，无黑屏风险）

---

## v1.73.119 (2026-06-19)

### Fixed
- **Black Screen Hotfix**: schema.js 回退至 v1.73.118 版本，紧急修复 Linux AppImage 黑屏
- **GitHub Token Persistence**: IntegrationsTab 添加 mount 时恢复 GitHub 连接状态的安全网

### Changed
- Windows Setup/Portable EXE 重新构建 (140MB)
- Linux AppImage 热修复重新编译

---

## v1.73.118 (2026-06-19)

### Fixed
- Audit Completion: FC05/06/10/18 全部修复 (36/36)
- 华为设备崩溃修复
- 全平台构建部署 (Windows Setup + Portable + Linux AppImage + DEB)

---

## v1.73.117 (2026-06-18)

### Fixed
- ERR_MODULE_NOT_FOUND for react in patch-renderer.tsx
- 全平台版本同步

---

## v1.73.116 (2026-06-17)

### Changed
- Full build and deploy: Setup + Portable + AppImage + DEB + Blockmap
- 版本同步机制优化

---

## v1.73.115 - v1.73.101 (2026-06-17)

### Fixed
- v9.6 always-refresh unpacked + diagnostic log buffer
- v9.5 repair — __copyRecursive returns boolean, __verifyModule after repair

---

## 更早版本

详见 Git 提交记录: `git log --oneline`
