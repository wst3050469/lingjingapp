# CHANGELOG

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
