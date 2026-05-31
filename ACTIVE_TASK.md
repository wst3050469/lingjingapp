# ACTIVE_TASK

## 当前状态：✅ 已完成 — v1.64.13 角色动态仪表盘

### 服务状态
| 组件 | 状态 | 版本/详情 |
|:-----|:----:|:----------|
| 🖥️ Server API (localhost:8900) | ✅ active | Python 企业管理系统 |
| 🖥️ Server API (43.103.5.36:8900) | ✅ active | 生产语音服务 |
| ☁️ Cloud API (localhost:8000) | ✅ active | 升级到最新 v3 (2503行, 100+API) |
| ☁️ Cloud API (ide.zhejiangjinmo.com) | ✅ active | 通过公网访问 |
| 🎤 STT (faster-whisper tiny) | ✅ 正常运行 | 推理 <0.5s/5s音频 |
| 🗣️ TTS (warmup cache) | ✅ 6/6 已预热 | 本地+生产均正常 |
| 📡 WebSocket 通知 | ✅ 运行中 | - |
| 🗄️ PostgreSQL (生产) | ✅ active | 已配置授权 |
| 📱 移动端 | ✅ 字号放大200% | v1.64.12 |
| 💳 支付网关 | ✅ 可用 | test/alipay/wechat 三种通道 |
| 🗂️ 数据库种子数据 | ✅ 3个套餐 | free ¥0 / personal ¥29 / pro ¥99 |

### 最近完成
- **v1.64.13 — 角色动态仪表盘**: AdminPanel 新增「业务仪表盘」tab，根据 tenant_role 动态展示不同模块：
  - 🏢 租户管理员: 项目/资金/客户/团队/发票/合同
  - 📊 项目经理: 进度/质量/耗材/支出/考勤/供应商
  - 🔧 工人: 打卡/考勤/工资/备用金/项目/报工
- **Server**: `/login` API 新增 `tenant_role` 返回字段
- **版本升级**: v1.64.12 → v1.64.13
