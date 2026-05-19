# ACTIVE_TASK — v1.43.7 全平台构建部署完成

## 当前状态: ✅ 生产运行正常

### 部署状态 (v1.43.7)

| 平台 | 文件 | 大小 | 状态 |
|:-----|:-----|:----:|:----:|
| 🪟 Windows Setup | `LingJing-Setup-1.43.7-win-x64.exe` | 131 MB | ✅ 已部署 |
| 🪟 Windows Portable | `LingJing-Portable-1.43.7-win-x64.exe` | 131 MB | ✅ 已部署 |
| 🐧 Linux AppImage | `LingJing-1.43.7-linux-x86_64.AppImage` | 171 MB | ✅ 已部署 |
| 🐧 Linux deb | `LingJing-1.43.7-linux-x86_64.deb` | 104 MB | ✅ 已部署 |

### API 状态
- `/api/latest` → `{"version":"1.43.7","hasUpdate":true}` ✅
- `latest.yml` / `latest-linux.yml` → v1.43.7 ✅
- `versions.json` → latest: 1.43.7 ✅

### 生产服务器
- cloud-server:8000 ✅ online
- update-server:3000 ✅ online
- nginx: 80/443 正常

### Git
- GitHub: `09c241c` — v1.43.7 已推送 ✅
- 本地仓库落后远程（GFW 阻断）

---

## v1.43.7 修复内容

### 问题：`./types.js` does not provide an export named 'toolToSchema'
- **错误信息**：`SyntaxError: The requested module './types.js' does not provide an export named 'toolToSchema'`
- **根因**：`packages/core/dist/tools/types.js` 仅含 `export {};`，缺少 `toolToSchema` 函数实现
- **触发路径**：`registry.js` → `import { toolToSchema } from './types.js'` → `ToolRegistry.getSchemas()` 调用
- **修复**：在 `src/tools/types.ts` 和 `dist/tools/types.js` 中添加 `toolToSchema` 函数，将 Tool 对象转换为 MCP 兼容 schema 格式（name, description, inputSchema）
- **涉及文件**：
  - `packages/core/src/tools/types.ts`
  - `packages/core/dist/tools/types.js`
  - `packages/core/dist/tools/types.d.ts`
  - `packages/electron/node_modules/@codepilot/core/dist/tools/types.js`
