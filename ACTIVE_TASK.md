# LingJing IDE - Task Tracker 

## Current Status: v1.46.8 Desktop

### Latest Desktop: v1.46.9
Fix: Codebase indexing stuck at 0% — probe + auto-fallback + progress fixes

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
- Windows: Setup 141MB / Portable 141MB ✅
- Linux: AppImage 174MB / deb 162MB ✅

### Git Status
- main@51af11389 (生产bare repo: ✅ | GitHub: ✅)

### Service Health 
- PM2: cloud-server + update-server 运行正常
- nginx: all endpoints 200
- /versions → 301 → /admin/versions 200 ✅

### Service Health 
- PM2: cloud-server + update-server 运行正常
- nginx: all endpoints 200
- /versions → 301 → /admin/versions 200 ✅
