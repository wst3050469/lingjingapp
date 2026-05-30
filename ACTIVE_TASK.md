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
- `0eb2d7c7` — v1.64.10: 移动端API缺失方法修复
- ✅ 已推送到 prod 远程仓库 (prod/main)

### 版本历史
| 版本 | 状态 | 主要内容 |
|:----|:----:|:---------|
| **v1.64.10** | ✅ 已发布 | 移动端API缺失方法修复（7个新方法+3个响应格式修复） |
| v1.64.9 | ✅ 已发布 | 桌面客户端版本号更新+构建产物清理 |
| v1.64.8 | ✅ 已发布 | 文件变更处理设置无效修复 |
| v1.64.7 | ✅ 已发布 | 文件变更自动处理UI优化 |
| v1.64.3 | ✅ 已发布 | hotfix: 移除faster-whisper不兼容参数 |
| v1.64.2 | ✅ 已发布 | 语音对话延迟优化 |

### 最近完成
- **v1.64.10**: 移动端API缺失方法修复
  - 新增 `login()` / `signup()` / `cloudLogout()` / `cloudUser`
  - 新增 `getPayments()` / `upgrade()` / `downgrade()`
  - 修复 `getSubscription()` 路径: `/subscription` → `/subscriptions/mine`
  - 修复 `getPlans2()` / `getSubscription()` / `getPayments()` 响应格式包装
- v1.64.9: 前端版本号更新
- v1.64.8: 文件变更行为设置不生效修复
- v1.64.7: 文件变更自动处理UI优化
- Phase 14: 移动端订阅集成（全部实现）
