# ACTIVE_TASK

## 当前状态：✅ 空闲 — 管理员快捷方式收藏夹已实现

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
- **管理员快捷方式收藏夹**: 登录面板新增书签保存/一键登录/管理功能
- **桌面文件整理**: 将 `lingjing.desktop` 移入 `~/Desktop/灵境/` 文件夹
- **Agent超时修复**: quest:resume Agent构造添加turnTimeout + 传递配置到IPC
- **maxTurns配置修复**: 最小限制500→1，UI默认500→50
