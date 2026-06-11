# 项目结构与生命周期

本文档说明灵境IDE各模块的职责、依赖关系、构建产物流向,以及版本与发布流程。

## 一、模块总览

| 模块 | 路径 | 包名 | 角色 |
|------|------|------|------|
| 桌面主进程 | `desktop/electron` | `lingjing-ide` | Electron 主进程,打包入口 |
| 桌面渲染层 | `desktop/frontend` | `@codepilot/renderer` | Vite 构建的 UI,产物注入 electron |
| 桌面核心包 | `desktop/core` | `@codepilot/core` | 业务核心逻辑,被 electron 依赖 |
| 桌面产物 | `desktop/release` | — | electron-builder 输出目录 |
| 桌面技能包 | `desktop/electron/skills` | — | kicad/openscad/wokwi,打包为 extraResources |
| 移动端 | `mobile` | `lingjing-ide` (expo) | Expo / React Native 应用 |
| 主云服务 | `services/backend` | `lingjing-cloud-server` | Express + ws + sqlite |
| 企业后端 | `services/python` | — | Python FastAPI(routers/services/ai/tests) |
| 更新服务 | `services/update` | `@codepilot/update-server` | 版本检查与下载分发 |
| 后台管理 | `services/admin` | — | 部署产物(`dist/`),源码在外 |
| 落地页 | `services/landing` | — | 部署产物 + 下载中心(`public/`) |
| 基础设施 | `infra` | — | scripts(脚本)、deploy(编排)、docker |

## 二、桌面端依赖关系

```
@codepilot/core ──(workspace:*)──▶ lingjing-ide (electron)
@codepilot/renderer ──(vite build → dist)──▶ electron/renderer/ ──▶ ASAR
```

- `desktop/` 是 pnpm 工作区根(`pnpm-workspace.yaml` 列出 electron / frontend / core)。
- `electron` 通过 `workspace:*` 依赖 `@codepilot/core`,构建时 `scripts/build-main.mjs` 会把 core 的 `dist` 同步进 electron 本地 `node_modules`。
- 渲染层产物流向:`frontend/dist` → 由 `build-main.mjs` 的 Phase 0.5 复制到 `electron/renderer/` → electron-builder 按 `files: ["renderer/**/*"]` 打进 ASAR。

> 重要:`frontend` 目录原名 `renderer`,重组后改名;`build-main.mjs` 中 `RENDERER_SRC` 已相应指向 `../frontend/dist`。包名仍为 `@codepilot/renderer`,工作区按名解析,故改名安全。

## 三、构建产物流向

| 产物 | 来源 | 流向 |
|------|------|------|
| Windows 安装包 / 便携版 | `desktop/electron` `dist:` 脚本 | electron-builder → `release/` |
| Linux AppImage / deb | 同上 (`dist:linux`) | 同上 |
| macOS zip | 同上 (`dist:mac`) | 同上 |
| Android APK | `mobile/android` Gradle | Expo / RN 构建 |
| 渲染层资源 | `desktop/frontend` Vite | `frontend/dist` → `electron/renderer/` |

桌面打包脚本(`desktop/electron/package.json`):

- `build` → 编译主进程
- `prepackage` → 预打包准备
- `dist` / `dist:linux` / `dist:mac` → 全流程打包

## 四、版本与发布流程

1. **改版本号**:`python infra/scripts/bump.py <version> <versionCode>`
   - 同步:`mobile/{package.json,app.json}`、`desktop/{electron,frontend,core}/package.json`
   - `mobile/app.json` 的 `expo.version` 是移动端权威版本号
2. **构建**:按上表分平台构建(桌面在构建机,移动端在 Android SDK 环境)
3. **分发**:产物上传至下载中心(`ide.zhejiangjinmo.com/downloads/`),由 `services/update` 提供版本检查
4. **部署服务**:`infra/scripts/sync-*.sh` 同步 `services/backend` 等到生产服务器
   - 注意:这些脚本中的路径(`/root/cloud-server`、`/home/liuhui/lingjing`、`192.168.1.9`)是**生产/构建服务器**的布局,与本地重组后的目录无关,保持原样。

## 五、注意事项

- **iCloud 同步风险**:本项目位于 `~/Documents`(iCloud 同步),iCloud 会驱逐/删除文件,曾导致 `.git` 目录丢失。建议长期迁出 iCloud 路径;在此目录内不要依赖 git 作为唯一备份。
- **admin / landing 无源码**:这两个服务目录只含部署用 `dist/`,前端源码不在本仓库。
- **包管理混用**:桌面端用 pnpm 工作区,移动端与各 Node 服务用各自的 npm。
- **部署脚本面向远端**:`infra/scripts` 下的 sync/build 脚本多数针对生产或构建服务器的固定路径,本地运行需自行调整。
