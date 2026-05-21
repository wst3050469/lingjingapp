# LingJing IDE - Task Tracker 

## Current Status: v1.46.9 Desktop

### Latest Desktop: v1.46.9
Fix: Codebase indexing stuck at 0% — probe + auto-fallback + progress fixes

### Latest Server Fix: versions.json 同步修复
- **问题**: 版本管理页面"加载版本数据失败"
- **根因**: 4 份 versions.json 不同步，admin-api 读取到对象格式的 versions 字段
- **修复**: 
  - 统一同步 4 份 versions.json 为 Array 格式（含 v1.46.9 全平台文件）
  - admin-api.js 添加 `normalizeVersionsJson()` 自动兼容对象→数组转换

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
  - 构建完成时间: 2026-07-10 13:04 CST
  - 构建日志: /tmp/linux_build_v1469.log
- versions.json: `latest: "1.46.9"` ✅ (全平台，已同步 update-server)
- latest.yml / latest-linux.yml: ✅

### Git Status
- main@8eacba2cc (GitHub: ✅ | 生产bare: ✅ push server main)
  - v1.46.9 相关 commits: 0823a073c + 76032d66e + b05fe55b5 + 4360dfcfa + 8eacba2cc
  - 最新: fix: versions.json sync + admin-api.js normalizeVersionsJson

### Service Health 
- PM2: cloud-server + update-server 运行正常
- nginx: all endpoints 200
- /versions → 301 → /admin/versions 200 ✅
