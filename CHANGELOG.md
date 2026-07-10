# CHANGELOG

## v1.73.190 (2026-07-10)

### Changed
- **超管后台精简**: 移除 7 个业务模块，聚焦平台核心运维
- **删除 14 个前端文件**: 7 页面 + 7 Store（合同/供应商/客户/发票/财务/样本/配方）
- **后端精简**: admin.py 删除 29 个业务路由 (-722行)，8 个业务 API 全部返回 404
- **仪表盘增强**: 新增会话总数/版本总数/在线设备 3 张运维卡片，共 7 张
- **依赖清理**: 移除 echarts/vue-echarts（-51KB）
- **cloud-admin v1.1.1**: 9 页面 + 8 Store + 10 API 模块

### Fixed
- **租户成员 500**: tenant_users 表 joined_at 列不存在 → created_at AS joined_at
- **systemd 崩溃循环**: lingjing-cloud.service 端口冲突 → 停用，保留手动进程
- **自动更新 404**: versions.json desktop.latest 指向不存在的 1.76.40 → 1.76.21
- **Git 远程**: HTTPS 推送超时 → 改用 SSH (git@github.com)
- **11 个核心 API 全部 200**, 7 个已删 API 全部 404

### Security
- **系统安全更新**: curl + libcurl + tzdata 安全补丁已应用
- **全平台版本统一**: 8 模块 v1.73.190 一致

## v1.73.188 (2026-07-06)

### Fixed
- **TypeScript 编译**: 81→0 errors (Electron 52→0, Renderer 29→0, Mobile 0)
- **域名全面清理**: `ide.zhejiangjinmo.com` → `www.spiritrealmz.com` (25文件, 54处→0)
- **Lucide 图标类型冲突**: `@types/react` 统一锁定 18.3.28 (pnpm.overrides)
- **Electron IPC**: 6个模块缺失 `@codepilot/core` 导出，补充类型桩
- **Voice 模块**: 完整类型声明 (ASREngineType 含 websocket)
- **TriggerManager**: 8个缺失方法声明
- **WebSocket 重连**: 固定5s → 指数退避 1s~60s
- **Null 类型**: ChatPanel/ChatSidebar/QuestConversation 的 null vs undefined
- **APP 版本检测**: `checkForUpdates()` URL 修正 + versions.json 更新至 v1.73.188
- **electron-builder**: 发布 URL 改为 spiritrealmz.com

### Added
- **Cloud Server 部署到HK**: Node.js v20 + systemd + nginx /cloud/ 反向代理
- **Expo Web 面板**: `spiritrealmz.com/app/` 浏览器可直接访问灵境AI
- **APK v1.73.188**: 84MB, CDN 在线, MD5 验证通过

### Changed
- **磁盘清理**: 释放 322MB 旧 Electron 构建产物
- **网站结构**: 首页恢复落地页, Expo Web → /app/, Cloud API → /cloud/
- **MCP 包**: packages/electron/mcp-packages/ 纳入 git 追踪
- **.gitignore**: 新增 release/ admin/ uvicorn.log

### Security
- 确认: WAF已绕过(DNS直连), SSL双域名有效至2026-10-03
- 支付回调URL: 全部使用 spiritrealmz.com

---

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
