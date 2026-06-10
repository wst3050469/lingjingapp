#!/bin/bash
# MCP 内置包安装脚本
# 在构建 Electron 应用前运行，将 MCP 服务器包预装到 mcp-packages/ 目录
# 构建时通过 electron-builder extraResources 打包到应用内
# 运行时位于: resources/mcp-packages/
#
# 用法: bash scripts/install-mcp-packages.sh [--all]
#   --all: 安装全部12个MCP包 (较大)
#   默认: 仅安装4个零配置自动连接包

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MCP_DIR="$ROOT_DIR/packages/electron/mcp-packages"

echo "=== MCP 内置包安装 ==="
echo "目标目录: $MCP_DIR"

# 清理旧包
rm -rf "$MCP_DIR"
mkdir -p "$MCP_DIR"
cd "$MCP_DIR"

# 初始化 package.json
cat > package.json << 'PKGJSON'
{
  "name": "lingjing-mcp-packages",
  "private": true,
  "description": "MCP server packages bundled with 灵境AI"
}
PKGJSON

# 核心包 — 零配置自动连接 (启动时自动激活)
CORE_PACKAGES=(
  "@modelcontextprotocol/server-filesystem"
  "@h1deya/mcp-server-weather"
  "@modelcontextprotocol/server-memory"
  "@modelcontextprotocol/server-sequential-thinking"
)

# 扩展包 — 按需连接
EXTRA_PACKAGES=(
  "@modelcontextprotocol/server-github"
  "@modelcontextprotocol/server-brave-search"
  "@playwright/mcp"
  "@upstash/context7-mcp"
  "@modelcontextprotocol/server-postgres"
  "@modelcontextprotocol/server-redis"
  "@modelcontextprotocol/server-slack"
  "@modelcontextprotocol/server-gdrive"
)

if [ "$1" = "--all" ]; then
  echo "安装全部 12 个 MCP 包..."
  PACKAGES=("${CORE_PACKAGES[@]}" "${EXTRA_PACKAGES[@]}")
else
  echo "安装 4 个核心零配置包..."
  PACKAGES=("${CORE_PACKAGES[@]}")
fi

# 写依赖到 package.json（防止逐个安装互相覆盖）
cat > package.json << PKGJSON
{
  "name": "lingjing-mcp-packages",
  "private": true,
  "dependencies": {
PKGJSON
for pkg in "${PACKAGES[@]}"; do
  echo "    \"$pkg\": \"*\"," >> package.json
done
sed -i '$ s/,$//' package.json
echo '  }' >> package.json
echo '}' >> package.json

echo -n "安装中..."
if npm install --omit=dev --ignore-scripts 2>/dev/null; then
  echo " ✅"
else
  echo " ❌ (部分包可能不可用)"
fi

rm -f "$MCP_DIR/package-lock.json"

echo ""
echo "=== 完成 ==="
echo "mcp-packages 大小: $(du -sh "$MCP_DIR" | cut -f1)"
