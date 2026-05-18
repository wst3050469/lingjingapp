## Phase 14: 移动端订阅集成 (2026-05-14)

### 任务
为 lingjing-mobile 添加订阅管理功能，包括查看当前订阅、浏览套餐、购买订阅、查看用量配额。

### 架构
- 新增 `SubscriptionScreen.tsx` — 订阅管理页面
- 扩展 `api.ts` — 添加订阅/套餐/支付 API 方法
- 扩展 `app-store.ts` — 添加订阅状态管理
- 在 SettingsScreen 中添加"订阅管理"入口

### 实现步骤
1. 扩展 `app-store.ts` 添加订阅/套餐类型定义和状态
2. 扩展 `api.ts` 添加 5 个订阅相关 API 方法
3. 创建 `SubscriptionScreen.tsx` — 显示当前订阅 + 套餐列表
4. 修改 `SettingsScreen.tsx` — 添加"订阅管理"入口按钮
5. 修改 `App.tsx` — 注册导航栈

### API端点（已存在）
- GET /api/subscription — 当前订阅信息
- GET /api/plans — 套餐列表
- POST /api/payments/create — 创建支付订单
- POST /api/payments/confirm/:orderId — 确认支付（test模式）

### 文件修改
- `lingjing-mobile/src/stores/app-store.ts` — +Subscription类型 + 状态
- `lingjing-mobile/src/services/api.ts` — +5个订阅API方法
- `lingjing-mobile/src/screens/SubscriptionScreen.tsx` — 新建
- `lingjing-mobile/src/screens/SettingsScreen.tsx` — +订阅入口
- `lingjing-mobile/App.tsx` — +导航栈注册

### 验证
- TypeScript 类型检查通过
- 组件渲染不崩溃
- 订阅页面显示套餐并可通过 API 拉取数据
