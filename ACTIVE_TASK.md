# 当前活跃任务状态

> 本文件记录灵境开发的当前状态，供新会话快速衔接上下文
> 最后更新: 2026-05-18 (v1.42.0 — Hermes Fusion ✅)

## 状态: v1.42.0 ✅

**当前版本**: 桌面端 v1.42.0, 移动端 v1.39.1

### 全平台构建产物

| 平台 | 文件 | 大小 | 状态 |
|:-----|:-----|:----:|:----:|
| 🐧 Linux (AppImage) | `LingJing-1.42.0-linux-x86_64.AppImage` | 183 MB | ✅ 已部署 (新服务器 120.55.5.220) |
| 🐧 Linux (deb) | `LingJing-1.42.0-linux-x86_64.deb` | 111 MB | ✅ 已部署 (新服务器 120.55.5.220) |
| 🪟 Windows (Setup) | `灵境 Setup 1.42.0.exe` | 131 MB | ✅ 已部署 |
| 🪟 Windows (Portable) | `LingJing-Portable-1.42.0-win-x64.exe` | 131 MB | ✅ 已部署 |
| 🤖 Android (APK) | `lingjing-mobile-v1.39.1.apk` | 78 MB | ✅ 已部署 (旧服务器) |

### v1.42.0 — Hermes Fusion 集成增强

14 项 Hermes Agent 特性融合：
- EventBus 事件总线 + HookRegistry 回调机制
- 滑动窗口/向量记忆、审查引擎、技能安全
- DAG编排、多Agent并行、模型路由
- NL Cron调度、用户建模、消息网关
- 全新 Admin 面板 + Wiki 自动更新

### 构建环境 (新服务器 120.55.5.220)

| 组件 | 版本 |
|:-----|:----:|
| OS | Ubuntu 24.04 |
| Node.js | v20.20.2 |
| pnpm | 10.30.3 |
| electron | 35.7.5 |
| electron-builder | 25.1.8 |

### 待办
- [x] ~~构建 Windows 安装包 (Setup + Portable)~~
- [x] ~~同步 versions.json 多源~~
- [ ] 移动端 v1.40.0 部署
