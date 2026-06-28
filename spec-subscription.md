## Phase 14: 移动端订阅集成 ✅ 已完成 (v1.73.142, 2026-06-21)

### 任务
为 lingjing-mobile 添加订阅管理功能，包括查看当前订阅、浏览套餐、购买订阅、查看用量配额。

### 架构
- 新增 `SubscriptionScreen.tsx` — 订阅管理页面
- 扩展 `api.ts` — 添加订阅/套餐/支付 API 方法
- 扩展 `app-store.ts` — 添加订阅状态管理
- 在 SettingsScreen 中添加"订阅管理"入口

### 实现步骤
1. ✅ 扩展 `app-store.ts` 添加订阅/套餐类型定义和状态
2. ✅ 扩展 `api.ts` 添加 8 个订阅相关 API 方法
3. ✅ 创建 `SubscriptionScreen.tsx` — 显示当前订阅 + 套餐列表 (542行)
4. ✅ 修改 `SettingsScreen.tsx` — 添加"订阅管理"入口按钮
5. ✅ 修改 `App.tsx` — 注册 Settings + Subscription 导航栈 (v1.73.142)

### 导航链
ChatList → [⚙️] → Settings → [订阅管理] → Subscription

### 部署
- APK: v1.73.142 (35MB), versionCode 69
- versions.json: 3处同步 (downloads/, html/, cloud-server/)
- PM2: 6/6 online
