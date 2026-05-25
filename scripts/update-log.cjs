const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, '..', '日志.md');
let log = fs.readFileSync(logPath, 'utf8');

const newEntry = `
---

### v1.58.1 — 修复云同步连接事件监听器注册顺序，确保渲染进程收到连接状态 ✅

**2026-05-25**
- **任务**: 修复"云同步仍然无法连接"问题（v1.58.0 后仍无效）
- **根因分析**:
  1. **事件监听器注册顺序错误** (cloud-ipc.ts): 转发到渲染进程的 'connected' 事件监听器在 `Promise.race` 之后才注册，但 WebSocket 的初始连接事件在 `connectWebSocket()` 调用时立即触发。临时 race 监听器消费了初始事件，转发监听器永远收不到，导致渲染进程 UI 始终显示"未连接"。
  2. **cloud:set-user-token** 同样问题：监听器在 `connectWebSocket()` 之后注册。
  3. **autoConnectCloud** 同样问题：监听器在 `connectWebSocket()` 之后注册。
- **修改文件 (1个)**:
  1. `packages/electron/src/ipc/cloud-ipc.ts`: ✅ 三个函数中将事件转发监听器移到 `connectWebSocket()` 之前注册
     - `cloud:connect` handler: 监听器 → connectWebSocket → Promise.race
     - `cloud:set-user-token` handler: 监听器 → connectWebSocket → Promise.race  
     - `autoConnectCloud`: 监听器 → connectWebSocket → 健康检查
- **验证方法**: TypeScript 零错误编译
- **潜在风险**: 无，仅调整事件监听器注册顺序，不改变业务逻辑
- **部署状态**: 需构建安装包并上传到生产服务器
`;

log += newEntry;
fs.writeFileSync(logPath, log, 'utf8');
console.log('Log updated');
