# ACTIVE_TASK — v1.43.9 全平台构建部署完成

## 当前状态: ✅ 生产运行正常

### 部署状态 (v1.43.9)

| 平台 | 文件 | 大小 | 状态 |
|:-----|:-----|:----:|:----:|
| 🪟 Windows Setup | `LingJing-Setup-1.43.9-win-x64.exe` | 131 MB | ✅ 已部署 |
| 🪟 Windows Portable | `LingJing-Portable-1.43.9-win-x64.exe` | 131 MB | ✅ 已部署 |
| 🐧 Linux AppImage | `LingJing-1.43.9-linux-x86_64.AppImage` | 171 MB | ✅ 已部署 |
| 🐧 Linux deb | `LingJing-1.43.9-linux-x86_64.deb` | 104 MB | ✅ 已部署 |

### API 状态
- `/api/latest` → v1.43.9 ✅
- `latest.yml` / `latest-linux.yml` → v1.43.9 ✅
- `versions.json` → latest: 1.43.9 ✅

### 服务器
- cloud-server:8000 ✅ (30s 缓存已启用) | update-server:3000 ✅ | nginx 80/443 ✅
- 💾 磁盘: 148GB (已用 30GB, 21%)

### Git
- GitHub: `67f771f` — v1.43.9 + vitest 配置修复 ✅
- 本地: 已同步至 origin/main ✅

---

## v1.43系列已知问题修复一览

| 版本 | 问题 | 修复 |
|:----|:-----|:-----|
| v1.43.5 | IPC 注册依赖 mainWindow | Phase A/B 分离 |
| v1.43.6 | loadConfig10 is not a function | core/dist/index.js 重写 |
| v1.43.7 | toolToSchema export missing | types.js 添加函数 |
| v1.43.8 | ConversationManager 导出名不匹配 | 修正为 Conversation |
| v1.43.9 | loadRulesFromDirectory 幽灵导出 | 删除无效导出 + 构建 |
