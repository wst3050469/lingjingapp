# ACTIVE_TASK — v1.42.9 全平台构建与部署

## 当前状态: ✅ 生产运行正常

### 部署状态 (v1.42.9)

| 平台 | 文件 | 大小 | 状态 |
|:-----|:-----|:----:|:----:|
| 🪟 Windows Setup | `灵境 Setup 1.42.9.exe` | 131 MB | ✅ 已部署 |
| 🪟 Windows Portable | `LingJing-Portable-1.42.9-win-x64.exe` | 131 MB | ✅ 已部署 |
| 🐧 Linux AppImage | `LingJing-1.42.9-linux-x86_64.AppImage` | 171 MB | ✅ 已部署 |
| 🐧 Linux deb | `LingJing-1.42.9-linux-x86_64.deb` | 168 MB | ✅ 已部署 |
| 🤖 Android | `lingjing-mobile-v1.40.1.apk` | 78 MB | ✅ 已部署 |

### API 状态
- `/api/latest` → `{"version":"1.42.9","status":"published"}` ✅
- `/api/versions` (update-server:3001) → v1.42.9 ✅
- latest.yml / latest-linux.yml / versions.json 全部同步 ✅

### v1.42.9 新增内容
- **MCP 模块**: `packages/core/src/mcp/` — client.ts, index.ts, sse-client.ts, types.ts, manager.ts
- **Workflow 引擎**: `packages/core/src/workflow/` — workflow-engine.ts, index.ts, types.ts
- **部署脚本**: `scripts/deploy-linux.sh`
- **配置同步**: tsconfig.json, electron-builder.json, .gitignore 同步

### 生产服务器
- cloud-server:8000 ✅ online | update-server:3001 ✅ online
- nginx: 安全头 + gzip + 缓存 + 关闭目录列表 ✅
- 磁盘: / 75% (9.4G可用) | /data 16% (32G可用)

### 测试覆盖 — 29 文件, 434 测试, ✅ 全部通过

| 模块 | 文件数 | 测试数 |
|:-----|:-----:|:-----:|
| OpenSpace 集成 | 7 | 125 |
| Fusion 核心模块 | 17 | 253 |
| 工具/适配器 | 2 | 12 |
| MCP/Workflow 类型与引擎 | 2 | 25 |
| Vector/Logger 等 | 1 | 19 |
| **总计** | **29** | **434** |

### 构建能力
- 🐧 Linux: 服务器 `/root/lingjing-git` 完整构建 (`bash scripts/deploy-linux.sh`)
- 🪟 Windows: 本地构建 (Node.js v24.14.0, pnpm 11.1.2, electron-builder 25.1.8)

### Git
- `main@347173c` — 全部 commit 已推送至 GitHub
- 包含: MCP 模块、Workflow 引擎、构建部署脚本、nginx /downloads/ 修复、Setup ASCII 文件名
