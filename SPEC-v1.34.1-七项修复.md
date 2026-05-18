# v1.34.1 七项修复 — 云同步/订阅降级/用户页面/Wiki/索引进度

## 根因分析

### 问题1: 云管理 → 云平台 ✅ 当前已正确
CloudDeviceTab.tsx 已改为引导页，指向 `https://ide.zhejiangjinmo.com/admin`。无需修改。

### 问题2: 云同步自动同步 ⚠️ 单向推+无记忆同步
**根因**: `triggerAutoSync` 只推送 sessions（且只推送前5条），不推送 memories，也不从云端拉取。双向同步才是有意义的自动同步。

**修复方案**:
- 改为双向同步：自动推送本地 sessions+memories 到云端，同时也自动拉取云端 sessions+memories 到本地
- 添加自动同步状态指示器（绿色圆点 + "自动同步运行中"标签）
- 添加同步统计计数（上次同步时间、已同步数量）

### 问题3: 订阅降级错误 ⚠️ 服务端缺少独立降级端点
**根因**: 
- 服务端只有通用的 `POST /api/subscriptions`，客户端所有套餐变更(升级/降级)都走此端点
- 但客户端 subscription-ipc.ts 注册了 `cloud:subscription:downgrade` IPC 调用 `POST /api/subscriptions/downgrade` — **此端点服务端不存在！**
- 用户通过 SubscriptionTab.tsx 点击降级时，调用的是 `subscribe({ planId })`（正确路径），但错误信息中的"缺少套餐ID(planId)"说明 planId 在请求中未传递

**修复方案**:
- 服务端增加 `POST /api/subscriptions/downgrade` 和 `POST /api/subscriptions/upgrade` 端点
- 增强客户端 subscribe IPC 的日志，明确输出请求体
- 修复 base-service.ts 中 handleError 的错误字段提取（服务端返回字段名为 `message` 和 `code`，handleError 已支持）

### 问题4: 代码库索引 ✅ 代码正确
IndexingTab.tsx 和 indexing-store.ts 已正确实现索引构建、进度展示、自动索引开关、忽略文件管理等功能。

### 问题5: Repo Wiki ⚠️ 缺少自动更新触发 + TOC 加载问题
**根因**:
- WikiPanel.tsx 在挂载时调用 `detectChanges()`，但**没有定时器**定期检查变更
- `changedModules` 为空数组时，WikiToolbar 不显示"更新"按钮 → 用户看不到变更提示
- 手动刷新 (`handleRefresh`) 调用 `loadStatus()` + `loadToc()` + `detectChanges()` 路径正确

**修复方案**:
- WikiPanel 添加 30s 定时器定期调用 `detectChanges()`
- 添加 change detection watch dog：每 60s 检测变更并自动触发更新
- 修复 WikiToolbar 的 `handleRefresh` 返回结果后的状态刷新

### 问题6: /users 用户管理页面 ⚠️ Nginx 无路由
**根因**: `https://ide.zhejiangjinmo.com/users` 在 nginx 中没有任何 location 配置，直接返回 404。
cloud-admin SPA 实际运行在 `/admin/` 路径下，用户管理页面在 `/admin/users`。

**修复方案**:
- 在 nginx 中添加 `/users` 到 `/admin/users` 的 301 重定向
- 或者添加 `/users` location 直接代理到 SPA

### 问题7: 代码库索引进度条 ⚠️ 进度事件未触发
**根因**: IndexingTab 依赖 `liveProgress`（来自 indexing-store）来渲染进度条。如果索引构建 IPC 没有正确发送 onProgress 事件，进度条就不会显示。需要检查：
1. 索引构建 IPC 是否正确发出进度事件
2. `initIndexingProgressListener()` 是否在 app 启动时调用了

## 修改方案与影响范围

### 修改文件清单

| 文件 | 修改内容 | 影响范围 |
|------|----------|----------|
| `packages/renderer/src/components/settings/tabs/CloudSyncTab.tsx` | 双向自动同步 + 状态指示器 | 渲染层 |
| `cloud-server/server.js` | 新增 `/api/subscriptions/downgrade` 和 `/api/subscriptions/upgrade` 端点 | 服务端 API |
| `nginx config (服务器)` | 新增 `/users` → `/admin/users` 301 重定向 | 生产部署 |
| `packages/renderer/src/components/wiki/WikiPanel.tsx` | 添加定期 change detection 定时器 | 渲染层 |
| `packages/renderer/src/components/wiki/WikiToolbar.tsx` | 修复刷新后状态同步 | 渲染层 |
| `packages/renderer/src/stores/wiki-store.ts` | 增强 detectChanges 自动触发更新 | 状态层 |
| `packages/electron/src/ipc/cloud-management/subscription-ipc.ts` | 增强日志 | IPC 层 |
| `packages/renderer/src/components/settings/tabs/IndexingTab.tsx` | 检查索引进度事件触发 | 渲染层 |
| `packages/electron/src/services/cloud-management/subscription-service.ts` | 新增 downgrade/upgrade API 调用 | 服务层 |

### 实现步骤

1. **步骤1**: 修复云端自动同步（双向同步 + 记忆同步 + 指示器）
2. **步骤2**: 修复订阅降级（服务端新增端点 + 客户端日志增强）
3. **步骤3**: 修复 nginx /users 路由（配置服务器）
4. **步骤4**: 修复 Repo Wiki 自动更新（定时器 + 变更检测看门狗）
5. **步骤5**: 验证代码库索引进度条
6. **步骤6**: 构建 + 部署 + 推送 v1.34.1
