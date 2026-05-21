# LingJing IDE - Task Tracker 

## Current Status: v1.46.6 Desktop | v1.33.1 Mobile 

### Latest Desktop: v1.46.6 
Fix: SSH tools local fallback when not connected

### Latest Mobile: v1.33.1 
Fix: ErrorBoundary, route safety, WebSocket heartbeat 

### Changes in v1.46.6 Desktop
- **SSH远程执行bug修复**：SSH工具内部实现本地回退
  - ssh-bash/ssh-file-tools/ssh-list-dir：未连接时回退到本地执行
  - agent-ipc/quest-ipc：始终使用SSH包装器，运行时动态判断

### Changes in v1.33.1 Mobile 
- **ErrorBoundary**: New src/components/ErrorBoundary.tsx wrapping entire app 
- **ChatDetailScreen**: route?.params safety + Alert on send failure 
- **WebSocket Heartbeat**: 30s ping in api.ts (same pattern as desktop) 
- **App.tsx**: Outer ErrorBoundary wrapping SafeAreaProvider 

### Admin Fix (server-side, no version bump)
- **Admin白屏修复**：cloud-server 添加 express.static 中间件

### Git Status 
- main@bba6955c1 (local: pending push to production/GitHub)

### Service Health 
- PM2: 4/4 online 
- nginx: all endpoints 200 
