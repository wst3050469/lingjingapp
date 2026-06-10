# 灵境 IDE — Mac 编译指南

> **版本**: v1.72.20+ | **更新**: 2026-06-10

---

## 📋 前置条件

| 工具 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | >= 20 | [下载](https://nodejs.org/) 或 `brew install node@20` |
| pnpm | >= 9 | 通过 `corepack enable` 自动安装 |
| macOS | 11+ (Big Sur+) | 支持 Intel (x64) 和 Apple Silicon (arm64) |
| Xcode CLI | 最新 | `xcode-select --install`（如未安装） |
| 磁盘空间 | >= 3GB | 含 node_modules + Electron 二进制 + 产物 |

---

## 🚀 一键构建

```bash
# 1. 获取源码
# 方式 A: 解压源码包
curl -O https://ide.zhejiangjinmo.com/downloads/lingjing-source-1.72.20.tar.gz
tar xzf lingjing-source-1.72.20.tar.gz
cd lingjing

# 方式 B: 克隆 Git 仓库
git clone https://github.com/your-org/lingjing.git
cd lingjing

# 2. 执行一键初始化脚本
chmod +x scripts/init-mac.sh
./scripts/init-mac.sh
```

脚本会自动完成: 环境检查 → 安装依赖 → 构建 core → 构建 renderer → 打包 macOS zip

---

## 🔧 手动构建步骤

如果一键脚本不可用，也可以手动执行:

```bash
# 0. 设置 Electron 镜像 (中国大陆必须！)
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

# 1. 安装依赖
pnpm install

# 2. 构建核心模块
pnpm --filter @codepilot/core build

# 3. 构建渲染层 (Vite + React)
pnpm --filter @codepilot/renderer build

# 4. 打包 macOS 应用
pnpm --filter lingjing-ide dist:mac
```

构建产物位于: `packages/electron/release-*/LingJing-*-mac-*.zip`

---

## 📦 构建产物

| 产物 | 架构 | 说明 |
|------|------|------|
| `LingJing-1.x-mac-x64.zip` | Intel Mac | x86_64 架构 |
| `LingJing-1.x-mac-arm64.zip` | Apple Silicon | M1/M2/M3 原生 |

解压后直接双击 `灵境.app` 运行。

---

## 🐛 常见问题

### 1. "已损坏，无法打开" / 无法验证开发者

这是 macOS Gatekeeper 安全提示，因为应用未经过 Apple 公证签名。

**解决方法**:
```bash
# 移除隔离属性
xattr -cr /path/to/灵境.app
# 或在系统设置 → 隐私与安全性 → 点击"仍要打开"
```

我们已经配置 `hardenedRuntime=false` + `gatekeeperAssess=false` 以尽量减少此类问题。

### 2. Electron 下载失败 (中国大陆)

```bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
pnpm install
```

### 3. node-pty 编译失败

确保 Xcode Command Line Tools 已安装:
```bash
xcode-select --install
```

如果仍然失败，检查 Python 和 make 是否可用:
```bash
which python3 && which make
```

### 4. pnpm 权限错误

```bash
# 清理缓存后重试
pnpm store prune
rm -rf node_modules
pnpm install
```

### 5. 构建的 app 启动后空白页

通常是因为 renderer 没有正确打包。检查:
```bash
ls packages/electron/renderer/
# 应该有 assets/ 目录和 index.html
```

如果不是，重新构建 renderer:
```bash
pnpm --filter @codepilot/renderer build
```

### 6. Apple Silicon Mac 运行 x64 版本

arm64 构建天然支持 M 系列芯片。如果运行 x64 版本，系统会通过 Rosetta 2 转译。
构建时会同时产出两个架构的 zip，M 系列 Mac 推荐使用 arm64 版本。

---

## 🏗️ 项目架构

```
lingjing/
├── packages/
│   ├── core/          # @codepilot/core — AI 核心引擎 (TypeScript)
│   ├── renderer/      # @codepilot/renderer — React UI (Vite)
│   ├── electron/      # lingjing-ide — Electron 主进程 + 打包
│   ├── cli/           # CLI 工具
│   └── vscode-extension/  # VS Code 扩展
├── cloud-server/      # 云同步服务 (Node.js)
├── cloud-admin/       # 管理后台 (Vue 3)
├── scripts/           # 构建/部署脚本
│   └── init-mac.sh    # Mac 一键初始化 ✨
└── docs/              # 文档
    └── mac-build-guide.md  # 本文档
```

**关键依赖**:
- `@codepilot/core` → `@codepilot/renderer` → `lingjing-ide` (构建链)
- Electron 39, React 18, Expo 55 (移动端)

---

## 🔄 版本升级

当新版本发布时:

```bash
# 1. 拉取最新代码
git pull

# 2. 更新依赖
pnpm install

# 3. 重新构建
./scripts/init-mac.sh
```

升级文件 (latest-mac.yml) 会自动通知用户更新:
```
https://ide.zhejiangjinmo.com/downloads/latest-mac.yml
```

---

## 🆘 获取帮助

- 下载页: https://ide.zhejiangjinmo.com/downloads/
- 版本文件: https://ide.zhejiangjinmo.com/downloads/versions.json
- 源码包: https://ide.zhejiangjinmo.com/downloads/lingjing-source-1.72.20.tar.gz
