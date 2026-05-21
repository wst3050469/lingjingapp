# LingJing IDE - Task Tracker 

## Current Status: v1.46.9 (已发布)

### Latest Desktop: v1.46.9 ✅
Fix: Codebase indexing stuck at 0% — probe + auto-fallback + progress fixes

### Latest Server Fixes
1. **versions.json 同步修复** - 4 份文件统一，admin-api 加固 ✅
2. **版本管理乱码 & 审核流程修复** ✅
3. **latest.yml/latest-linux.yml 同步修复** ✅ — 2026-07-10 完成，更新到 v1.46.9

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
- **latest.yml / latest-linux.yml**: ✅ v1.46.9（已更新）
- **versions.json**: `latest: "1.46.9"`, v1.46.9 为 `published` ✅（全4路径同步）
- **编码**: UTF-8 ✅

### Git Status
- main@8eacba2cc (GitHub: ✅ | 生产bare: ✅ push server main)

### Service Health 
- PM2: cloud-server + update-server 运行正常
- nginx: all endpoints 200
- /api/latest → v1.46.9 published ✅
- /versions → 301 → /admin/versions 200 ✅
- /downloads/latest.yml → v1.46.9 ✅
- /downloads/latest-linux.yml → v1.46.9 ✅
