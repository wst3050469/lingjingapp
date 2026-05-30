# 移动端 API 缺失方法修复

## 概述
修复 `src/services/api.ts` 中缺失的 API 方法，这些方法被 `LoginScreen`、`SettingsScreen` 和 `SubscriptionScreen` 调用但尚未实现，同时修复服务端响应格式与客户端期望之间的不匹配。

## 问题清单

### 缺失的方法 (api.ts)
1. `login(username, password)` → `POST /api/auth/login`
2. `signup(username, password, email?)` → `POST /api/auth/signup`
3. `cloudUser` getter → 存储最近登录用户信息
4. `cloudLogout()` → 清除本地登录状态
5. `getPayments()` → `GET /api/payments`
6. `upgrade(planId)` → `POST /api/subscriptions/upgrade`
7. `downgrade(planId)` → `POST /api/subscriptions/downgrade`

### 响应格式不匹配
1. `getSubscription()` → 路径应为 `/subscriptions/mine`，当前为 `/subscription`
2. `getPlans2()` → 服务端返回纯数组，客户端期望 `{plans: [...]}` 
3. `getSubscription()` → 服务端返回直接对象，客户端期望 `{subscription: {...}}`

## 修改文件
- `src/services/api.ts` — 添加7个新方法 + 修复3个响应格式不匹配

## 验证
- TypeScript 类型检查通过
- API 路径与服务端一致
- 响应格式转换正确
