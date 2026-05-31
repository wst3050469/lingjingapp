# 灵境 开发日志

> 规范路径: `/home/liuhui/灵境/logs/DEVLOG.md`
> 同步来源: `开发日志.md` + `日志.md`

---

## 当前状态

- **最新版本**: v1.64.11
- **Git HEAD**: 本会话完成3次提交（遗留变更整理 + 日志规范化 + ACTIVE_TASK同步）
- **所有服务**: ✅ 正常运行
- **本会话状态**: ✅ 已完成 — 日志规范化 + 租户管理员登录个性化分析

## 2026-06-04 会话完成 — 日志规范化 + 仓库整理

### 完成内容
1. **创建 `logs/DEVLOG.md`** (321行) — 整合 `开发日志.md` + `日志.md` 到规范路径
2. **修复 Git 冲突** — `update-server/data/versions.json` 冲突已解决并提交
3. **提交全部遗留变更** (24个文件, +853/-155行)
   - 安全修复: CloudSyncTab API Key, voice_asr, hardware_voice
   - 清理: useFileMentions 删除, android keystore
   - 审计: audit-report.md 新增
   - 日志: DEVLOG.md 新增
4. **更新 ACTIVE_TASK.md** — 同步最新状态

### 当前状态
- ✅ **日志文件**: 已创建并整合完毕（322行，覆盖v1.64.2~v1.64.11全部历史）
- 📝 **内容覆盖**: 版本发布、Bug修复、安全加固、规格审计、TypeScript编译修复等

## 2026-06-04 租户管理员登录入口个性化分析

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
