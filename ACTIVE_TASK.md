# ACTIVE_TASK

## 当前状态：✅ 空闲 — 服务运行正常

### 服务状态
| 组件 | 状态 | 版本 |
|:-----|:----:|:----:|
| 🖥️ Server API (localhost:8900) | ✅ active | v1.64.3 |
| 🖥️ Server API (43.103.5.36:8900) | ✅ active | v1.64.3 |
| ☁️ Cloud API (ide.zhejiangjinmo.com) | ✅ active | - |
| 🎤 STT (faster-whisper tiny) | ✅ 正常运行 | 推理 <0.5s/5s音频 |
| 🗣️ TTS (warmup cache) | ✅ 6/6 已预热 | 本地+生产均正常 |
| 📡 WebSocket 通知 | ✅ 运行中 | - |
| 🗄️ PostgreSQL (生产) | ✅ active | 已配置授权 |
| 📱 移动端API层 | ✅ 完整实现 | v1.64.10 |

### Git
- 最新: `v1.64.10` — 移动端API缺失方法修复 + 响应格式转换
- ✅ 已推送到 prod 远程仓库 (prod/main)

### 最近完成
- **v1.64.10**: 移动端API完整修复
  - 新增 `login()` / `signup()` / `cloudLogout()` / `cloudUser`
  - 新增 `getPayments()` / `upgrade()` / `downgrade()`
  - 修复 `getSubscription()` 路径: `/subscription` → `/subscriptions/mine`
  - 响应格式转换: camelCase→snake_case, bool→0/1, flat→嵌套usage
- v1.64.9: 前端版本号更新
- v1.64.8: 文件变更行为设置修复
- Phase 14: 移动端订阅集成完毕
