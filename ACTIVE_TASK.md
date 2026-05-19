# ACTIVE_TASK — v1.43.8 全平台构建部署完成

## 当前状态: ✅ 生产运行正常

### 部署状态 (v1.43.8)

| 平台 | 文件 | 大小 | 状态 |
|:-----|:-----|:----:|:----:|
| 🪟 Windows Setup | `LingJing-Setup-1.43.8-win-x64.exe` | 131 MB | ✅ 已部署 |
| 🪟 Windows Portable | `LingJing-Portable-1.43.8-win-x64.exe` | 131 MB | ✅ 已部署 |
| 🐧 Linux AppImage | `LingJing-1.43.8-linux-x86_64.AppImage` | 171 MB | ✅ 已部署 |
| 🐧 Linux deb | `LingJing-1.43.8-linux-x86_64.deb` | 104 MB | ✅ 已部署 |

### API 状态
- `/api/latest` → `{"version":"1.43.8","hasUpdate":true}` ✅
- `latest.yml` / `latest-linux.yml` → v1.43.8 ✅
- `versions.json` → latest: 1.43.8 ✅

### 生产服务器
- cloud-server:8000 ✅ | update-server:3000 ✅ | nginx 80/443 ✅
- 磁盘: 40G (已用 29G, 可用 8.3G) ✅
- 旧版本文件已清理 ✅

### Git
- GitHub: `bcc4b41` — v1.43.8 ✅
- 本地仓库落后远程（GFW 阻断）

---

## v1.43.8 修复内容

### 问题：`./agent/conversation.js` does not provide an export named 'ConversationManager'
- **根因**：`packages/core/dist/index.js` 中 `export { ConversationManager } from './agent/conversation.js'` 但 `conversation.js` 导出的是 `Conversation` 类
- **修复**：将 `index.js` 和 `src/index.ts` 中导出名改为 `Conversation`
- **同步**：electron node_modules 同步更新

## 已知问题记录

### R1: config:set No handler (v1.43.5) → ✅ Phase A/B IPC 分离
### R2: loadConfig10 is not a function (v1.43.6) → ✅ core/dist/index.js 重写
### R3: toolToSchema export missing (v1.43.7) → ✅ types.js 添加 toolToSchema
### R4: ConversationManager export mismatch (v1.43.8) → ✅ 修正导出名
