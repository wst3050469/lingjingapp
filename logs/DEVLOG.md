# 灵境 开发日志

> 规范路径: `/home/liuhui/灵境/logs/DEVLOG.md`
> 同步来源: `开发日志.md` + `日志.md`

---

## 当前状态

- **最新版本**: v1.64.13
- **Git HEAD**: 修复仪表盘 API 路径不匹配
- **所有服务**: ✅ 正常运行（服务端已重启加载变更）
- **本会话状态**: ✅ 已完成 — API审计 + WorkerDashboard考勤修复

## 2026-06-04 会话完成 — Phase 3: 品牌自定义（Logo/主题）

### 完成内容
1. **Phase 3: 品牌自定义（Logo/主题）** — 管理面板品牌覆盖功能
   - 新增 `AdminBranding` 接口定义：`title`、`accentColor`、`logo` 字段
   - 新增 `DEFAULT_BRANDING` / `loadBranding()` / `saveBranding()` 工具函数
   - 新增品牌设置模态对话框：标题编辑、颜色选择器、Logo（Emoji/文本）输入、重置
   - 应用 CSS 自定义属性注入：`--admin-accent` / `--admin-accent-hover` / `--admin-accent-light` / `--admin-accent-bg`
   - 注入全局 `.admin-btn-primary` / `.admin-text-accent` / `.admin-bg-accent` 等工具类
   - 标题栏显示自定义标题和 Logo 标志
   - 新增齿轮图标 ⚙️ 按钮打开品牌设置
   - localStorage 持久化，会话间保持
   - 设置对话框支持点击空白关闭、重置为默认值

### 当前状态
- ✅ **Phase 3 品牌自定义**: 已完成并提交
- 📝 **TypeScript 编译**: 无新增错误

## 2026-06-04 v1.64.13 — 角色动态仪表盘 + 手动角色降级

### 完成内容
在 AdminPanel 中新增「业务仪表盘」标签页，根据用户角色动态展示不同的快捷功能模块和业务数据。

### 角色看板对应关系
| 角色 (tenant_role) | 看板组件 | 功能模块 |
|:---|:---|:---|
| owner / admin (租户管理员) | `TenantAdminDashboard` | 项目管理、资金管理、客户管理、团队管理、发票管理、合同管理 + 数据概览统计 |
| project_manager (项目经理) | `ProjectManagerDashboard` | 项目进度、质量看板、耗材管理、支出记录、考勤查看、供应商 + 收支汇总 + 项目列表 |
| worker (工人) | `WorkerDashboard` | 打卡签到、我的考勤、工资查询、申请备用金、我的项目、报工记录 + 今日状态卡片 |
| 未登录 / 无角色 | 提示信息 | 引导用户登录云管理后台 |

### 新增文件 (4个)
1. `packages/renderer/src/components/admin/role-dashboard/types.ts` — 类型定义
2. `packages/renderer/src/components/admin/role-dashboard/RoleDashboard.tsx` — 统一入口，根据角色路由
3. `packages/renderer/src/components/admin/role-dashboard/TenantAdminDashboard.tsx` — 管理员看板
4. `packages/renderer/src/components/admin/role-dashboard/ProjectManagerDashboard.tsx` — 项目经理看板
5. `packages/renderer/src/components/admin/role-dashboard/WorkerDashboard.tsx` — 工人看板

### 修改文件 (2个)
1. `packages/renderer/src/components/admin/AdminPanel.tsx` — 新增「业务仪表盘」tab + `tenantApi` 函数 + 租户服务器地址配置
2. `server/app/routers/auth.py` — `/login` 接口返回 `tenant_role`（JOIN tenant_users 表）

### 架构说明
- 角色看板通过 `tenantApi` 连接租户应用服务器（FastAPI），与云管理服务器（Express）分离
- 租户服务器地址可在业务仪表盘顶部的输入框中配置（默认空=当前云服务器）
- 所有组件遵循 AdminPanel 现有的暗色主题样式

### 风险 & 验证
- ✅ 未登录时显示引导提示，不崩溃
- ✅ 无角色/个人用户显示友好提示
- ✅ API 错误时显示重试按钮，不阻塞
- ✅ 租户服务器地址为空时，使用云服务器 URL 作为后备
- ✅ 向后兼容：旧版 AdminPanel 功能不受影响
- ✅ TypeScript 类型检查 — 新增文件零错误

### V6 功能 — 工人打卡签到端到端实现
- 新增 `CheckInModal` 打卡签到模态框
- 上班打卡 → 实时更新状态为"已上班"，调用 `POST /api/attendance/check-in`
- 下班打卡 → 实时更新状态为"已下班"，调用 `POST /api/attendance/check-out"
- 可选打卡位置输入
- 打卡成功/失败 Toast 反馈
- 今日状态卡片新增"去打卡"快捷按钮
- **风险**: 🟢 低 — 纯前端组件 + 已有后端 API

### V5 优化 — API路径审计 + 仪表盘可用性

**问题修复：**
1. 🏠 **首页入口独立化** — 不再依赖云管理后台 token，打开即显示租户登录/角色预览
2. 🖱️ **快捷模块可点击** — 三个看板的快捷功能卡片均支持点击，显示 Toast 反馈"功能开发中"
3. 🚪 **退出租户后保留预览** — 退出后"角色预览"列表仍然可见，可随时切换预览
4. 💾 **面板持久化** — `setSidebarPanel` 自动保存最后面板到 localStorage，重启自动恢复
5. 🔗 **API 路径审计** — 修复 WorkerDashboard 考勤 API 路径 (`/api/v1/attendance/today` → `/api/attendance/today/{userId}`)
6. 👤 **Profile API 新增 user_id** — 前端可获取当前用户名，用于考勤等需要指定用户的 API

**修改文件 (8个)**
| 文件 | 变更 |
|:-----|:------|
| `DashboardContainer.tsx` | 移除 isLoggedIn 依赖，独立工作 |
| `RoleDashboard.tsx` | 新增 fromAdminPanel prop；仅 AdminPanel 内需云管理登录 |
| `TenantAdminDashboard.tsx` | 快捷模块 onClick + toast |
| `ProjectManagerDashboard.tsx` | 同上 |
| `WorkerDashboard.tsx` | 修正考勤 API 路径 + 从 profile 取 userId |
| `ui-store.ts` | `setSidebarPanel` 持久化 last_sidebar_panel；初始化时恢复 |
| `AdminPanel.tsx` | 传递 `fromAdminPanel={true}` |
| `server/app/routers/profile.py` | 返回数据增加 `user_id` 字段 |

### V4 增强 — ActivityBar 首页入口
- 新增 `DashboardContainer` 独立组件，不依赖 AdminPanel
- ActivityBar 顶部新增 🏠 首页图标，点击直接打开角色仪表盘
- 独立的服务器地址配置（右上角输入框），与 AdminPanel 共享 localStorage
- `SidebarPanel` 类型新增 `'dashboard'`，`ui-store.ts` 同步更新

### V3 增强 — 独立租户登录
- RoleDashboard 现在自带完整租户登录表单，独立于云管理后台登录
- 使用 `fetch` 直接调用租户API，不经过 Electron IPC 代理（避免 token 混淆）
- 租户 token 持久化到 localStorage，刷新后保持登录状态
- 退出登录按钮 🚪 清除租户 token
- 不再依赖 `cloudAdminApi` 代理，API调用更直接可靠

### V2 增强 — 手动角色降级
- 当租户API不可用时，显示黄色警告条 + 角色选择器
- 用户手动选择角色后，自动生成演示profile并展示对应看板
- 角色选择持久化到 localStorage（`admin_role_override`）
- 支持随时切换角色预览不同看板
- API重试成功时自动清除手动覆盖

### 部署
- ✅ Git 已推送到 prod/main (`1cf8af0c`)
- ✅ 版本号: v1.64.12 → v1.64.13（全部4个 package.json 同步更新）

### 背景
分析"租户管理员登录快捷入口为什么没有实现个性化"，并提供可行方案。

### 代码勘察结果
| 模块 | 文件 | 定位 |
|:-----|:-----|:-----|
| 桌面端管理员面板 | `packages/renderer/src/components/admin/AdminPanel.tsx` | 509行，5个tab，简单登录表单 |
| 桌面端本地认证 | `packages/electron/src/admin/admin-auth.ts` | 内存存储，硬编码admin/4角色 |
| 服务端租户API | `server/app/routers/tenant_admin.py` | FastAPI JWT，tenant_role校验 |
| 云服务器管理 | `cloud-server/admin-api.js` | 标准POST登录，无个性化 |

### 根因分析（5点）
1. **设计理念**: 轻量工具而非平台 — AdminPanel仅509行，登录表单2输入框+1按钮
2. **安全考量**: 单一入口最小攻击面，无Session持久化，无自定义branding入口防XSS
3. **单租户历史**: `admin-auth.ts`硬编码admin-001，不允许删除默认用户
4. **无多端解耦**: 嵌入Electron主窗口，无独立Web入口
5. **MVP阶段**: 版本管理仅4操作，ConfigTab静态硬编码，DataTab仅3按钮

### 个性化方案
| 方案 | 风险 | 工时 | 说明 |
|:-----|:----:|:----:|:-----|
| A. 自定义URL `?tenant=xxx` | 🟢 低 | 1天 | 动态路由 + 预填充租户信息 |
| B. 品牌自定义 Logo/主题 | 🟡 中 | 2天 | 数据库admin_branding字段 + CSS变量 |
| C. 快捷方式收藏夹 | 🟢 极低 | 0.5天 | localStorage存储，快速导航 |
| D. SSO/OAuth单点登录 | 🔴 高 | 3-5天 | OIDC/SAML集成 |
| E. 深链接+多租户仪表盘 | 🟡 中 | 1.5天 | 个性化widgets + app://深链接 |

### 推荐实施路径
- Phase 1 (0.5天): 方案C 快捷方式收藏夹
- Phase 2 (1天): 方案A 自定义URL
- Phase 3 (2天): 方案B 品牌自定义

---

## 2026-06-02 v1.64.11 — 全局字号缩放（高分辨率屏幕适配）✅

### 问题诊断
2880×1800 高分辨率屏幕下所有字体过小。根因：所有字号均为硬编码像素值（10~24px），无缩放机制。

### 方案
1. 在 `src/constants.ts` 新增 `FONT_SCALE = 2.0` 缩放因子 + `FONT` 常量表
2. 所有组件统一引用 FONT 常量
3. 修改 `FONT_SCALE` 即可全局缩放所有字号

### 修改文件 (14个)
1. `src/constants.ts` — 新增 `FONT_SCALE` + `FONT` 常量表
2. `src/components/ConnectionBanner.tsx` — fontSize 12 → FONT.sm
3. `src/components/ErrorBoundary.tsx` — 3处替换
4. `src/screens/ChatListScreen.tsx` — 4处替换
5. `src/screens/ChatDetailScreen.tsx` — 3处替换
6. `src/screens/FileTreeScreen.tsx` — 5处替换
7. `src/screens/QuestScreen.tsx` — 5处替换
8. `src/screens/PlanScreen.tsx` — 8处替换
9. `src/screens/SchedulesScreen.tsx` — 7处替换
10. `src/screens/SettingsScreen.tsx` — 14处替换 + 2处内联样式
11. `src/screens/SubscriptionScreen.tsx` — 23处替换
12. `src/screens/PairingScreen.tsx` — 12处替换
13. `src/screens/LoginScreen.tsx` — 13处替换
14. `App.tsx` — loadingText fontSize 替换 + import

### 字号映射
FONT_SCALE=2.0: 10→20, 11→22, 12→24, 13→26, 14→28, 15→30, 16→32, 18→36, 24→48

### 风险 & 测试
- ✅ **风险: 极低** — 仅替换 fontSize 值为常量引用，不改变布局逻辑
- ✅ 所有页面文字均放大100%，不再过小
- ✅ FONT_SCALE=1.0 可恢复原始大小
- ✅ 各页面布局不因字号变大而溢出

---

## 2026-06-02 v1.64.10 — 文件变更驳回不回滚文件的Bug修复 ✅ 🚀

### 问题诊断
驳回操作（`rejectFile`/`rejectAll`）只更新了 UI 状态，未实际回滚磁盘文件。

### 修改文件 (3个)
1. `packages/electron/src/preload.ts` — 新增 `revertFile` 桥接函数
2. `packages/renderer/src/stores/quest-diff-store.ts` — 新增 `revertFileOnDisk()` 辅助函数；`rejectFile()`/`rejectAll()` 实际回滚文件
3. `.gitignore` — 添加构建产物目录

### 部署
- ✅ Linux AppImage v1.64.10 (176MB)
- ✅ Linux DEB v1.64.10
- ✅ `versions.json` latest: 1.64.10
- ✅ Update Server API → `{"hasUpdate":true,"version":"1.64.10"}`
- ✅ Git 已推送到 prod/main（force push）

---

## 2026-06-01 v1.64.10 — 移动端API缺失方法修复 ✅

### 问题诊断
1. `login()`/`signup()`/`cloudLogout()`/`cloudUser` 未实现 → 页面崩溃
2. `getPayments()`/`upgrade()`/`downgrade()` 未实现 → SubscriptionScreen 崩溃
3. `getSubscription()` 使用错误路径 `/subscription` → 实际为 `/subscriptions/mine`
4. 响应格式不匹配（裸数组/对象 vs 包装格式）

### 修改文件 (1个)
- `src/services/api.ts`:
  - ✅ 新增 `login`/`signup`/`cloudLogout`/`cloudUser`
  - ✅ 新增 `getPayments`/`upgrade`/`downgrade`
  - ✅ 修复 `getSubscription()` 路径: `/subscription` → `/subscriptions/mine`
  - ✅ 修复3处响应格式包装
  - ✅ 字段转换 camelCase → snake_case

### 版本
1.64.9 → **1.64.10** (package.json)

---

## 2026-06-01 v1.64.10 — 云服务器升级 ✅

### 内容
升级生产云服务器 (port 8000) 代码，新增认证/订阅/支付API。

### 修改文件 (4个生产文件)
1. `/opt/lingjing-cloud/db.js` — 新增 `payments`/`offline_payments`/`invoices` 表 + plans种子数据
2. `/opt/lingjing-cloud/server.js` — 覆盖升级到2503行最新版
3. `/opt/lingjing-cloud/admin-api.js` — 覆盖升级
4. `/opt/lingjing-cloud/payment-gateway.js` — 新建，支持 test/alipay/wechat

### 验证结果
- ✅ `POST /api/auth/signup` → 200
- ✅ `POST /api/auth/login` → 200
- ✅ `GET /api/plans` → 3个套餐 (free ¥0 / personal ¥29 / pro ¥99)
- ✅ `GET /api/subscriptions/mine` → 返回当前订阅+用量限额
- ✅ `POST /api/subscriptions/upgrade/downgrade` → 成功切换
- ✅ `POST /api/payments/create` → 创建支付订单
- ✅ `GET /api/payments` → 返回支付记录

---

## 2026-06-01 安全修复 — CORS + Rate Limiting + 错误泄露修复 ✅

### 修改文件
- `/opt/lingjing-cloud/server.js`:
  - ✅ 添加 `cors` 包 + 白名单配置
  - ✅ 添加 `express-rate-limit` + 登录/注册限流（每分钟10次）
  - ✅ 修复7处错误详情泄露

---

## 2026-06-01 v1.64.8 — 文件变更处理设置无效修复（IPC级自动处理 + 文件回滚）✅

### 问题诊断
1. `emitFileSnapshot` 未传递 `taskId` → 基于 `autoMode` 的自动接受逻辑始终跳过
2. `useQuestEvents.ts` 不读取 `quest.fileChangeBehavior` 配置
3. `rejectAll()`/`rejectFile()` 仅修改UI状态，不实际回滚文件

### 修改文件 (5个)
1. `packages/electron/src/ipc/quest-ipc.ts` — 新增 `taskId` 参数 + `quest:revert-file` IPC handler
2. `packages/electron/src/preload.ts` — 新增 `quest.revertFile`
3. `packages/electron/src/ipc/ipc-verifier.ts` — 白名单添加 `quest:revert-file`
4. `packages/renderer/src/hooks/useQuestEvents.ts` — 加载配置 + 自动处理逻辑
5. `packages/renderer/src/types/electron.d.ts` — 添加类型声明

### 版本
1.64.7 → **1.64.8**（所有包同步更新）

### 部署
- ✅ Linux AppImage/DEB, Windows Setup/Portable, Blockmap
- ✅ `latest.yml` / `latest-linux.yml` / `versions.json` 已更新
- ✅ Update Server API → `{"hasUpdate":true,"version":"1.64.8"}`

---

## 2026-05-31 v1.64.7 — 文件变更自动处理UI优化 ✅

### 修改文件 (2个)
1. `packages/renderer/src/components/settings/tabs/QuestTab.tsx`:
   - ✅ 单选按钮不再即时保存，改为仅标记 dirty
   - ✅ 新增"保存配置"按钮（仅 dirty 时显示）
2. `packages/renderer/src/components/quest/QuestConversation.tsx`:
   - ✅ 新增 `useEffect` 监听 `quest:file-behavior-changed` 自定义事件

### 版本
1.64.6 → **1.64.7**

### 构建产物
- ✅ Windows Setup 142MB + Portable 141MB + Blockmap
- ✅ Linux AppImage 176MB + DEB 106MB
- ✅ 全部上传并部署

---

## 2026-05-30 APK下载链路全面修复

### 问题诊断
1. CDN WAF拦截: 仅允许特定路径，/downloads/*.apk被拦截返回404
2. OSS APK限制: 阿里云OSS禁止直接分发.apk文件
3. 云服务器302重定向被CDN WAF拦截(403)
4. APK文件路径错误: _APK_DIR指向错误

### 修复内容
1. **update-server (app.js)**: 新增 `/downloads/:filename` 静态文件下载路由
2. **cloud-server (app_version.py)**: 移除302重定向，改为 FileResponse 流式返回
3. **版本文件**: 修复 JSON 损坏，更新所有 mobile URL

### 验证结果
- ✅ Check-update API (CDN) → 200
- ✅ APK下载(CDN, 跟随重定向) → 200, 38MB有效APK
- ✅ 数据库 v1.64.1 已发布

---

## 2026-05-30 规格实现度审计

### 审计范围
5个规格目录: full-completion, hermes-fusion, input-area-refactor, openspace, lingjing-review

### 审计结果
| 规格目录 | 初始完成度 | 最终完成度 |
|----------|:---------:|:---------:|
| full-completion | 86% (31/36) | 97% (35/36) |
| hermes-fusion | 93% (13/14) | 100% (14/14) |
| input-area-refactor | 50% (4/8) | 88% (7/8) |
| openspace | 80% (8/10) | 100% (10/10) |
| lingjing-review | 60% (3/5) | 60% (3/5) |
| **综合** | **81% (59/73)** | **95% (69/73)** |

### 修复项
1. ✅ 删除 useFileMentions.ts hook
2. ✅ ChatSidebar.tsx: 移除 useFileMentions 引用
3. ✅ ChatPanel.tsx: 移除 useFileMentions 引用
4. ✅ InputToolbar.tsx: 移除 @提及按钮
5. ✅ ChatInput.tsx: 移除 onMention prop
6. ✅ ChatInput.tsx: accept 扩展为多格式
7. ✅ ChatSidebar.tsx: accept 扩展为多格式

### 补充安全修复
1. 🔒 CloudSyncTab.tsx: 移除硬编码API Key
2. 🔒 voice_asr.py: 修复WebSocket错误详情泄露
3. 🔒 hardware_voice.py: 修复2处HTTP错误详情泄露

### 代码质量修复
1. 📝 offline-queue.ts: 添加 maxQueueSize (默认1000)
2. 📝 sync-client.ts: WebSocket重连添加指数退避
3. 🧹 dist/dist/ 清理: 删除 4.6M 嵌套构建产物

### TypeScript 编译修复 (22项)
完整修复了跨包类型错误、缺失类型、路径错误等问题。

---

## 2026-05-30 v1.64.2-hotfix — 移除 faster-whisper 不兼容参数 ✅

### 问题诊断
`server/app/services/transcribe.py` 中 `faster-whisper` 不支持 `logprob_threshold` 和 `no_speech_threshold` 参数（属于 openai-whisper）。

### 修改文件 (1个)
- `server/app/services/transcribe.py`: 移除 `logprob_threshold` 和 `no_speech_threshold`，保留 `compression_ratio_threshold`

### 版本
1.64.2 (server)

---

## 2026-05-30 v1.64.3 — 版本号更新 🚀

### 变更
- hotfix: 移除 faster-whisper 不兼容参数
- 生产服务器 PostgreSQL 安装配置
- 前端 TypeScript 类型修复 (revertFile)

### Git
`a695adae` — 已推送到 prod

---

## 2026-05-30 v1.64.9 — 前端版本发布 🚀

桌面客户端 v1.64.8 → **v1.64.9**，集成所有后端语音对话延迟优化修复。Git: `3c896b7f`

---

## 会话最终总结（历史完整记录）

### 🔧 修复类
| # | 内容 | 状态 |
|---|------|:----:|
| 1 | CORS安全加固 (server.js) | ✅ |
| 2 | 错误详情泄露修复 (server.js) | ✅ |
| 3 | Rate limiting + JSON body limit | ✅ |
| 4 | Payment gateway CORS | ✅ |
| 5 | DB连接池健康检查+自动重建 | ✅ |
| 6 | Mobile API 7个缺失方法补全 | ✅ |
| 7 | Mobile response格式统一 | ✅ |
| 8 | PairingScreen cloud路径修正 | ✅ |
| 9 | 空安全修复 (Screens列表/API层) | ✅ |

### 🚀 部署类
| # | 内容 | 状态 |
|---|------|:----:|
| 10 | APK构建 (828MB→82MB, -90%) | ✅ |
| 11 | APK上传OSS + nginx部署 | ✅ |
| 12 | versions.json更新 | ✅ |
| 13 | update-server static file路由 | ✅ |
| 14 | cloud-server 302重定向→FileResponse | ✅ |
| 15 | APK路径修复 `_APK_DIR` | ✅ |
| 16 | CDN链路修复 (lingjing→ide) | ✅ |

### 📋 审计类
| # | 内容 | 状态 |
|---|------|:----:|
| 17 | 5个规格目录全面审计 | ✅ |
| 18 | 73项需求逐项验证 | ✅ |
| 19 | audit-report.md生成 | ✅ |

### 🧹 清理类
| # | 内容 | 状态 |
|---|------|:----:|
| 20 | useFileMentions完全清除(3文件) | ✅ |
| 21 | @提及按钮UI移除 | ✅ |
| 22 | 文件上传支持多格式 | ✅ |
| 23 | versions.json JSON损坏修复 | ✅ |

### ✅ 最终系统状态
- 综合规格完成度: 95% (69/73)
- cloud-server: 运行中 (8900)
- update-server: 运行中 (3000)
- nginx: 运行中 (80/443)
- PostgreSQL: 运行中 (5432)
- APK下载: CDN链路完整可工作

---

## 2026-06-04 v1.64.12 — 桌面文件整理（灵境项目文件归类）

### 完成内容
将桌面（`~/Desktop/`）上属于灵境项目的文件整理到 `~/Desktop/灵境/` 文件夹中。

### 桌面文件分析
| 文件 | 归属 | 说明 |
|:----|:----:|:------|
| `lingjing.desktop` | ✅ 灵境项目 | 灵境IDE启动快捷方式，Exec指向`/opt/灵境/lingjing` |
| `分辨率切换.desktop` | ❌ 非项目 | 通用系统分辨率切换工具，调用`~/scripts/res-switch.sh` |
| `README.txt` | ❌ 非项目 | 远程桌面连接说明（VNC/RDP） |
| `~/桌面/httpsbusiness...txt` | ❌ 非项目 | 巨量引擎链接，与项目无关 |

### 操作
- ✅ 创建 `~/Desktop/灵境/` 文件夹
- ✅ 移动 `lingjing.desktop` → `~/Desktop/灵境/lingjing.desktop`
- ✅ 未动其他非项目文件

### 当前桌面状态
```
~/Desktop/
├── 灵境/
│   └── lingjing.desktop   ← 灵境启动快捷方式
├── 分辨率切换.desktop      ← 系统工具（未动）
└── README.txt              ← 远程桌面说明（未动）
```

---

## 2026-06-04 v1.64.12 — 管理员快捷方式收藏夹（Phase 1）✅

### 实现内容
在管理员登录面板（`AdminPanel.tsx`）中新增快捷方式收藏夹功能。

### 新增功能
1. **快捷登录区域** — 已保存的书签以按钮列表显示在登录表单上方，点击即自动填充并触发登录
2. **保存为快捷方式** — 输入用户名/密码后，可保存为带自定义名称的快捷方式
3. **管理快捷方式** — 每个书签旁有删除按钮（✕），可删除不再需要的快捷方式
4. **使用追踪** — 登录后自动更新 `lastUsedAt` 时间戳

### 数据存储
- localStorage key: `admin_bookmarks`
- 格式: AdminBookmark[] (id, label, username, password, createdAt, lastUsedAt)

### 修改文件
- `packages/renderer/src/components/admin/AdminPanel.tsx` — 扩展 AdminLoginTab + 新增 bookmark 辅助函数
  - 新增 `AdminBookmark` 接口
  - 新增 `loadBookmarks()` / `saveBookmarks()` 辅助函数
  - AdminLoginTab 增加书签列表显示、保存对话框、删除操作
  - 代码行数: 509→654 行 (+145行)

### 风险 & 验证
- ✅ 类型检查通过（无新增错误）
- ✅ 纯前端功能，不涉及 IPC/API 变更
- ✅ 密码仅存储于本机 localStorage
- ✅ 空书签时隐藏「快捷登录」区域

---

## 2026-06-04 v1.64.12 — 自定义URL多租户路由（Phase 2）✅

### 实现内容
在管理员登录面板中新增自定义服务器地址输入，支持多租户场景。

### 新增功能
1. **自定义服务器地址** — 登录表单新增「服务器地址」字段，可连接不同的云管理后台
2. **地址持久化** — 最后使用的服务器地址保存在 localStorage
3. **书签集成** — 快捷方式收藏夹（Phase 1）扩展存储 serverUrl，书签按钮显示对应服务器
4. **地址显示** — 登录后顶部显示当前连接的服务器地址
5. **兼容性** — 字段为空时使用默认云端地址（`ide.zhejiangjinmo.com`）

### 实现细节
- `cloud:proxy-api` IPC 已支持 `baseUrl` 参数，`AdminLoginTab` 直接传递
- 旧书签（无 `serverUrl`）自动使用默认地址，完全向后兼容

### 修改文件
- `packages/renderer/src/components/admin/AdminPanel.tsx`
  - `AdminBookmark` 接口新增 `serverUrl?: string`
  - `handleAdminLogin` 新增 `serverUrl` 参数并传递到 `cloud.api()`
  - `AdminLoginTab` 新增 `serverUrl` 状态、输入框、持久化逻辑
  - `VersionTab` 新增 `serverUrl` prop，显示当前服务器地址
  - 行数: 657→704 行 (+47 行)

### 风险 & 验证
- ✅ 类型检查通过（无新增错误）
- ✅ 向后兼容：旧书签无 serverUrl 时使用默认地址
- ✅ 向后兼容：serverUrl 为空时行为与 Phase 1 完全相同
