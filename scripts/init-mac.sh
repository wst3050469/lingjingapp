#!/bin/bash
# =============================================
#  灵境 IDE — Mac 一键初始化脚本
#  用法: chmod +x scripts/init-mac.sh && ./scripts/init-mac.sh
# =============================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  灵境 IDE — Mac 构建环境初始化${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# ── 1. 检查 Node.js ──
echo -n "🔍 Checking Node.js... "
if command -v node &>/dev/null; then
    NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 20 ]; then
        echo -e "${RED}❌ Node.js $(node -v) is too old (>=20 required)${NC}"
        echo "   请安装 Node.js 20+: https://nodejs.org/"
        exit 1
    fi
    echo -e "${GREEN}✅ $(node -v)${NC}"
else
    echo -e "${RED}❌ Node.js not found${NC}"
    echo "   请通过以下方式安装:"
    echo "   1. 官网: https://nodejs.org/ (下载 LTS 版本)"
    echo "   2. brew install node@20"
    echo "   3. nvm install 20"
    exit 1
fi

# ── 2. 检查 pnpm ──
echo -n "🔍 Checking pnpm... "
if command -v pnpm &>/dev/null; then
    echo -e "${GREEN}✅ $(pnpm -v)${NC}"
else
    echo -e "${YELLOW}⚠️  pnpm not found. Installing via corepack...${NC}"
    corepack enable
    corepack prepare pnpm@latest --activate
    if command -v pnpm &>/dev/null; then
        echo -e "${GREEN}✅ pnpm $(pnpm -v) installed${NC}"
    else
        echo -e "${RED}❌ Failed to install pnpm${NC}"
        echo "   请手动安装: npm install -g pnpm"
        exit 1
    fi
fi

# ── 3. 检查项目文件 ──
echo -n "🔍 Checking project files... "
if [ ! -f "pnpm-workspace.yaml" ]; then
    echo -e "${RED}❌ Not in project root (pnpm-workspace.yaml not found)${NC}"
    echo "   请在灵境项目根目录运行此脚本"
    exit 1
fi
echo -e "${GREEN}✅${NC}"

# ── 4. 设置 Electron 镜像 (中国大陆加速) ──
if [ -z "$ELECTRON_MIRROR" ]; then
    echo -e "${YELLOW}💡 自动设置 ELECTRON_MIRROR=npmmirror.com (中国大陆加速)${NC}"
    export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    echo "   ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
else
    echo -e "${GREEN}✅ ELECTRON_MIRROR already set: ${ELECTRON_MIRROR}${NC}"
fi

# ── 5. 安装依赖 ──
if [ ! -d "node_modules" ]; then
    echo ""
    echo -e "${YELLOW}📥 node_modules 不存在，正在安装依赖...${NC}"
    pnpm install
else
    echo -n "📦 node_modules exists, checking integrity... "
    pnpm install --frozen-lockfile 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Lockfile mismatch, running pnpm install...${NC}"
        pnpm install
    }
    echo -e "${GREEN}✅${NC}"
fi

# ── 6. 清理旧的 dist 目录（源码包可能包含构建残留）──
echo ""
echo -e "${YELLOW}🧹 Cleaning old dist directories...${NC}"
rm -rf packages/core/dist packages/renderer/dist 2>/dev/null
echo -e "${GREEN}✅ Cleaned${NC}"

# ── 7. 构建 @codepilot/core ──
echo ""
echo -e "${BLUE}🔨 Building @codepilot/core...${NC}"
pnpm --filter @codepilot/core build
echo -e "${GREEN}✅ @codepilot/core built${NC}"

# ── 8. 构建 @codepilot/renderer ──
echo ""
echo -e "${BLUE}🎨 Building @codepilot/renderer (Vite)...${NC}"
pnpm --filter @codepilot/renderer build
echo -e "${GREEN}✅ @codepilot/renderer built${NC}"

# ── 9. 构建 Electron macOS 安装包 ──
echo ""
echo -e "${BLUE}🍎 Building macOS Electron app...${NC}"
echo "   目标: macOS x64 + arm64 (zip)"
echo "   ELECTRON_MIRROR=${ELECTRON_MIRROR}"
echo ""

pnpm --filter lingjing-ide dist:mac

# ── 10. 显示输出 ──
echo ""
echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}  ✅ 构建完成!${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# 查找输出的 macOS zip
MAC_OUTPUT=$(find packages/electron/release-* -maxdepth 1 -name "LingJing-*-mac-*.zip" 2>/dev/null | head -5)
if [ -n "$MAC_OUTPUT" ]; then
    echo "📦 构建产物:"
    while IFS= read -r f; do
        echo "   $(basename "$f") — $(ls -lh "$f" | awk '{print $5}')"
    done <<< "$MAC_OUTPUT"
    echo ""
    echo "💡 产物在 packages/electron/release-*/ 目录"
else
    echo -e "${YELLOW}⚠️  未找到 macOS zip 文件${NC}"
    echo "   请检查 packages/electron/release-*/ 目录"
fi

echo ""
echo -e "${GREEN}🎉 灵境 IDE Mac 构建完成!${NC}"
echo ""
