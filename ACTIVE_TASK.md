# ACTIVE_TASK

## 当前状态：✅ 空闲 — 桌面文件已整理 + 全部服务运行正常

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
| 📱 移动端 | ✅ 字号放大200% | v1.64.11 |
| 💳 支付网关 | ✅ 可用 | test/alipay/wechat 三种通道 |
| 🗂️ 数据库种子数据 | ✅ 3个套餐 | free ¥0 / personal ¥29 / pro ¥99 |

### 最近完成
- **桌面文件整理**: 将 `lingjing.desktop` 移入 `~/Desktop/灵境/` 文件夹，其他非项目文件不动
- **日志规范化**: 创建 `logs/DEVLOG.md`，整合历史开发日志
- **Git冲突修复**: `update-server/data/versions.json` 冲突已解决并提交
- **全局字号缩放**: v1.64.11 — 统一字号管理，FONT_SCALE=2.0
- **Agent超时修复**: quest:resume Agent构造添加turnTimeout + 传递配置到IPC
- **maxTurns配置修复**: 最小限制500→1，UI默认500→50
- **云服务器升级**: 新增auth/login/signup/plans/subscriptions/payments共29个端点
- **数据库修复**: 新增payments/offline_payments/invoices表; 修复users表缺少列
- **支付网关**: 新建payment-gateway.js，支持test/alipay/wechat
- **安全修复**: CloudSyncTab API Key移除 + voice_asr/hardware_voice 错误泄露修复
- **清理**: useFileMentions完全清除 + android keystore清理
