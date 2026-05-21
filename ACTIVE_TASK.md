# LingJing IDE - Task Tracker 

## Current Status: v1.46.8 Desktop

### Latest Desktop: v1.46.8 
Fix: All SSH handlers moved to Phase A (resolve ssh:connect race) + @codepilot/core missing exports (loadPrompts etc.) + remove setLogLevel phantom export

### Latest Mobile: v1.33.1 
Fix: ErrorBoundary, route safety, WebSocket heartbeat 

### Changes in v1.46.8 Desktop
- **SSH handlers Phase A提前注册**：全部14个handler（list-connections, connect, disconnect, read-dir, read-file, write-file, stat, mkdir, delete, rename, exec等）在Phase A注册
- **@codepilot/core导出修复**：补齐loadPrompts, createDefaultRegistry, getTodoList等30+个缺失导出
- **setLogLevel phantom export移除**：从dist/index.js, dist/index.d.ts, src/index.ts移除
- **nginx /versions 404修复**：添加 `location = /versions { return 301 /admin/versions; }`

### 部署平台
- Windows: Setup 141MB / Portable 141MB ✅
- Linux: AppImage 174MB ✅ (deb待修复：系统tar兼容性问题)

### Git Status
- main@51af11389 (生产bare repo: ✅ | GitHub: ✅)

### Service Health 
- PM2: cloud-server + update-server 运行正常
- nginx: all endpoints 200
- /versions → 301 → /admin/versions 200 ✅
