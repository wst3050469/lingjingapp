# 灵境IDE

AI 驱动的智能开发平台。包含桌面 IDE、移动端、云服务与基础设施，采用 monorepo 组织。

## 技术栈

| 组件 | 技术 |
|------|------|
| 桌面主进程 | Electron 39 + esbuild + electron-builder + electron-updater |
| 桌面渲染层 | React 18 + Vite 8 + Monaco Editor + Zustand + dnd-kit |
| 桌面核心包 | TypeScript（`@codepilot/core`，被 electron 打包） |
| 移动端 | Expo SDK 55 + React Native 0.83 + React 19 + React Navigation |
| 主云服务 | Node + Express + ws + better-sqlite3 |
| 企业后端 | Python FastAPI + uvicorn + asyncpg + pgvector |
| 更新服务 | Node + Express |
| 后台管理 / 落地页 | 已构建的静态产物（`dist/`） |
| 包管理 | pnpm workspace（桌面端）/ npm（移动端、各服务） |

---

## 项目结构

```
├── desktop/              # 桌面 IDE(pnpm monorepo,工作区根在此)
│   ├── electron/         # 主进程 (lingjing-ide)
│   ├── frontend/         # 渲染层 UI (@codepilot/renderer)
│   ├── core/             # 核心逻辑包 (@codepilot/core,被 electron 打包)
│   ├── release/          # 构建产物输出 (win-unpacked 等)
│   ├── pnpm-workspace.yaml
│   ├── pnpm-lock.yaml
│   └── tsconfig.base.json
├── mobile/               # RN/Expo 移动端 (iOS/Android/Web)
│   ├── App.tsx           # 入口
│   ├── src/              # 组件/页面/服务/状态
│   ├── assets/           # 图标与静态资源
│   ├── android/          # Android 原生工程
│   ├── app.json          # Expo 配置(权威版本号)
│   └── package.json      # Expo 应用清单
├── services/             # 各后端服务
│   ├── backend/          # 主云服务 Node (Express + ws + sqlite)
│   ├── python/           # FastAPI 企业后端 (routers/services/ai)
│   ├── admin/            # 后台管理(已构建产物 dist/)
│   ├── landing/          # 落地页 + 下载中心(dist/ + public/)
│   └── update/           # 更新服务 (Express)
├── plugins/              # 插件【规划中,暂无源码】
│   ├── idea/             # IDEA 插件
│   └── vscode/           # VSCode 插件
├── infra/                # 基础设施
│   ├── scripts/          # 构建/发版/同步/版本脚本
│   ├── deploy/           # 部署编排(blue-green/canary/compose)
│   └── docker/           # Docker(实际 Dockerfile 随各服务)
└── docs/                 # 文档(结构说明、生命周期、开发日志)
```

> 说明:`services/admin`、`services/landing` 仅包含部署用的构建产物(`dist/`),其前端源码不在本仓库内。

---

## 快速开始

### 环境要求

- Node.js ≥ 18
- pnpm（桌面端 monorepo）
- Expo CLI / Android SDK（移动端构建）
- Python 3 + uvicorn（企业后端 services/python）

### 桌面 IDE

```bash
cd desktop
pnpm install                               # 安装工作区依赖
```

**本地开发**(需两个终端,主进程未打包时会自动连 Vite dev server `localhost:5173`):

```bash
# 终端 1:启动渲染层 dev server (端口 5173,带热更新)
pnpm --filter @codepilot/renderer dev

# 终端 2:编译并启动主进程 (改主进程代码后需重跑本段)
pnpm --filter lingjing-ide build
pnpm --filter lingjing-ide exec electron .
```

> 自定义端口:`RENDERER_PORT=xxxx npx electron .`,并相应调整 dev server 端口。

**构建打包**:

```bash
pnpm --filter @codepilot/renderer build    # 构建渲染层 → frontend/dist
pnpm --filter lingjing-ide build           # 构建主进程
pnpm --filter lingjing-ide dist:linux      # 打包(或 dist / dist:mac)
```

打包脚本会把 `frontend/dist` 同步到 `electron/renderer/` 后再交给 electron-builder。

### 移动端

```bash
cd mobile
npm install
npm start            # Expo 开发服务器(本地开发,扫码/模拟器)
npm run android      # 运行到 Android
npm run ios          # 运行到 iOS
npm run web          # Web 预览
```

### 云服务

```bash
# 主云服务 (Node)
cd services/backend
npm install
npm start            # node server.js

# 更新服务 (Node)
cd services/update
npm install
npm start            # node app.js

# 企业后端 (Python FastAPI)
cd services/python
pip install -r requirements.txt
uvicorn app.main:app --reload    # 本地开发(热重载)
```

### 版本管理

统一改版本号:

```bash
python infra/scripts/bump.py <version> <versionCode>
# 例: python infra/scripts/bump.py 1.72.30 65
```

会同步更新 `mobile/{package.json,app.json}` 与 `desktop/{electron,frontend,core}/package.json`。

---

## 文档

- [项目结构与生命周期](docs/PROJECT_STRUCTURE.md) — 各模块职责、构建产物流向、版本/发布流程
- [开发日志](docs/DEVLOG.md) — 版本变更记录
- [迁移说明](docs/REORG.md) — 本次目录重组的映射与注意事项

---

## 许可证

见 [LICENSE](LICENSE)。
