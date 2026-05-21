# LingJing IDE - Task Tracker 

## Current Status: v1.46.9 (draft - 待审核)

### Latest Desktop: v1.46.9
Fix: Codebase indexing stuck at 0% — probe + auto-fallback + progress fixes

### Latest Server Fixes
1. **versions.json 同步修复** - 4 份文件统一，admin-api 加固 ✅
2. **版本管理乱码 & 审核流程修复** ✅
   - 问题：v1.46.9 直接 published 跳过审核流程，GBK编码导致乱码
   - 修复：重编码为 UTF-8，v1.46.9 改为 draft 待审核，latest.yml 回退到 v1.46.8

### Latest Mobile: v1.33.1 
Fix: ErrorBoundary, route safety, WebSocket heartbeat 

### Changes in v1.46.9 Desktop
- **索引卡在0%修复**：
  - `embedding-service.ts`: 添加 `probeEmbeddingService()` 快速探活(5s)，失败自动降级TF-IDF
  - `embedding-service.ts`: EMBED_TIMEOUT 60s→30s, OLLAMA_TIMEOUT 30s→15s
  - `indexing-pipeline.ts`: 修复 processedChunks 计数逻辑（嵌入失败不累加）
  - `indexing-pipeline.ts`: 所有文件失败时发送明确错误消息
  - `indexing-pipeline.ts`: 记录嵌入服务类型到日志
  - `indexing-ipc.ts`: 保留 'done' 状态5秒后被清除，让UI有时间展示结果

### 部署平台
- Windows: Setup 135MB / Portable 135MB ✅ (已部署到生产)
- Linux: AppImage 174MB / deb 162MB ✅ (已部署到生产)
- **latest.yml / latest-linux.yml**: ✅ 已回退到 v1.46.8（等待审核通过后发布）
- **versions.json**: `latest: "1.46.8"`, v1.46.9 为 `draft`（需 admin 审核）
- **编码**: UTF-8 修复 ✅（之前为 GBK 导致乱码）

### 后续操作 (需 admin)
1. 登录管理后台 → 版本管理 → 找到 v1.46.9
2. 点击"提交审核" → 状态变为 `pending_review`
3. 点击"发布" → 状态变为 `published`，客户端收到升级通知

### Git Status
- main@8eacba2cc (GitHub: ✅ | 生产bare: ✅ push server main)
  - 待提交：版本管理乱码 & 审核流程修复

### Service Health 
- PM2: cloud-server + update-server 运行正常
- nginx: all endpoints 200
- /versions → 301 → /admin/versions 200 ✅
