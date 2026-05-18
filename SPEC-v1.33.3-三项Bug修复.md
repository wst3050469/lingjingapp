# v1.33.3 三项Bug修复 — Spec

## 概述
修复三个生产环境Bug：订阅API报400错误、支付记录跨设备泄露、云同步需手动连接。

---

## Bug 1: `cloud:subscription:subscribe` HTTP 400

### 根因
1. **`base-service.ts` 硬编码 API Key** (`5379dcbe873b356430d84f3fc4b58974aa6f7e001cc8d047`) 可能不匹配生产服务器的 `API_KEY` 环境变量
2. **订阅服务缺少用户JWT令牌** — 所有订阅请求使用全局 API Key 认证（`req.userId='api-key-user'`），而非当前登录用户的 JWT
3. **服务端 `POST /api/subscriptions`** 将 `user_id='api-key-user'` 写入数据库，导致订阅记录关联到错误的用户
4. 客户端 `SubscriptionTab.tsx` 的 `catch` 处理只显示 `err.message`，缺少原始错误响应细节（status code、body）

### 修复方案

**A. 客户端增强 (client-side)**
1. `SubscriptionTab.tsx` `handleSubscribe` — 添加详细错误日志，显示HTTP状态码和响应体
2. `subscription-service.ts` `subscribe()` — 添加日志输出请求参数

**B. 服务端增强 (server-side)**
3. `server.js` `POST /api/subscriptions` — 添加 JSON 响应包装，400 错误时包含 `code` 字段
4. 确保认证方式一致性（回顾 auth 中间件逻辑）

### 修改文件
| 文件 | 修改内容 |
|------|----------|
| `packages/renderer/src/components/settings/tabs/SubscriptionTab.tsx` | 错误处理增强：显示HTTP状态码+响应体 |
| `packages/electron/src/services/cloud-management/subscription-service.ts` | 添加请求参数日志 |
| `cloud-server/server.js` | POST /api/subscriptions 错误响应增强 |

---

## Bug 2: 支付记录跨设备泄露

### 根因
1. `payments` 表没有 `device_id` 字段
2. `POST /api/subscriptions` 创建支付记录时不记录设备信息
3. `GET /api/payments` 按 `user_id` 过滤，同一用户的多个设备共享所有支付记录
4. 客户端 `getPayments()` 不传设备标识

### 修复方案

**A. 数据库 Schema (server-side)**
1. `db.js` — `payments` 表添加 `device_id TEXT` 列（ALTER TABLE + 新表创建）

**B. 服务端 API (server-side)**
2. `server.js` `POST /api/subscriptions` — 创建支付记录时传入 `deviceId`（从请求体或 auth 中间件获取）
3. `server.js` `GET /api/payments` — 添加可选的 `deviceId` 查询参数过滤

**C. 客户端 (client-side)**
4. `subscription-service.ts` `getPayments()` — 添加 `deviceId` 参数
5. `SubscriptionTab.tsx` `getPayments()` 调用 — 传入当前设备ID

### 修改文件
| 文件 | 修改内容 |
|------|----------|
| `cloud-server/db.js` | payments表添加device_id列（安全迁移） |
| `cloud-server/server.js` | POST /api/subscriptions 记录deviceId；GET /api/payments 支持deviceId过滤 |
| `packages/electron/src/services/cloud-management/subscription-service.ts` | getPayments 添加 deviceId 参数 |
| `packages/electron/src/ipc/cloud-management/subscription-ipc.ts` | getPayments IPC 透传 deviceId |
| `packages/electron/src/preload.ts` | getPayments 接口更新 |
| `packages/renderer/src/components/settings/tabs/SubscriptionTab.tsx` | 调用 getPayments 时传入 deviceId |

---

## Bug 3: 灵境云同步自动连接

### 根因
1. `autoConnectCloud()` 在 `main.ts` 第802行启动时无条件调用，但**不使用用户配置的 URL 和 API Key**
2. 用户在 `CloudSyncTab` 填写的 URL/API Key **没有持久化**到本地存储
3. `autoConnectCloud()` 创建的 `new CloudSyncClient()` 使用默认参数，无法连接用户自定义的云服务器
4. 应用重启后，用户之前配置的连接信息丢失，需要手动重新点击"连接"

### 修复方案

**A. 配置持久化 (client-side)**
1. `CloudSyncTab.tsx` — 连接成功后将 URL + API Key 保存到 `localStorage`
2. 添加 IPC 通道 `cloud:save-config` / `cloud:get-config` 用于持久化

**B. 自动连接增强 (main process)**
3. `cloud-ipc.ts` `autoConnectCloud()` — 启动时从持久化存储读取 URL + API Key
4. 如果持久化配置存在，使用用户配置的 URL/Key 初始化 `CloudSyncClient`
5. 如果持久化配置不存在，执行默认的 auto-connect 逻辑

**C. 配置变更触发同步**
6. `cloud-ipc.ts` 添加 `cloud:onConfigChanged` 事件，配置变更后自动触发重新连接

### 修改文件
| 文件 | 修改内容 |
|------|----------|
| `packages/electron/src/ipc/cloud-ipc.ts` | autoConnectCloud 读取持久化配置；添加 save-config/get-config IPC |
| `packages/electron/src/main.ts` | autoConnectCloud 调用时机不变，但行为增强 |
| `packages/renderer/src/components/settings/tabs/CloudSyncTab.tsx` | 连接成功后保存配置到 localStorage；启动时读取 |

---

## 实现步骤

1. **Bug 1**: 增强订阅错误处理 + 服务端日志改进
2. **Bug 2**: DB schema 迁移 + 服务端 API 改进 + 客户端 deviceId 传递
3. **Bug 3**: 配置持久化 + autoConnectCloud 增强 + 配置变更触发同步
4. 版本升级 v1.33.2 → v1.33.3
5. 构建 + 部署

## 影响范围
- **数据库**: payments 表需要迁移（新增 device_id 列）
- **API 契约**: GET /api/payments 新增可选 deviceId 参数
- **IPC 通道**: 新增 cloud:save-config / cloud:get-config
- **客户端**: subscription-service 接口签名变化

## 验证计划
1. ✅ Bug 1: 调用 subscribe 应返回明确错误信息而非"HTTP 400"
2. ✅ Bug 2: 设备A的支付记录不会出现在设备B
3. ✅ Bug 2: 同一用户且同一设备的支付记录正常显示
4. ✅ Bug 3: 配置 URL/Key 后重启应用，云状态显示"已连接"
5. ✅ Bug 3: 配置更改后自动触发重新连接
6. ✅ 全部现有 API 端点回归测试
