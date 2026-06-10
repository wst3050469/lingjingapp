#!/bin/bash
set -e
cd /root/lingjing
echo "=== Linux Build v1.71.1 ==="
echo "Node: $(node --version)"
echo "Dir: $(pwd)"

echo "--- Git pull ---"
git pull origin main

echo "--- pnpm install ---"
pnpm install --frozen-lockfile 2>&1 | tail -3

echo "--- Build main + pre-package ---"
cd /root/lingjing/packages/electron
node scripts/build-main.mjs
node scripts/pre-package.mjs

echo "--- electron-builder --linux --x64 ---"
NODE_OPTIONS="--max-old-space-size=2048" npx electron-builder build --linux --x64 --publish=never

echo "=== Result ==="
ls -lh /root/lingjing/release-v1711/*.AppImage /root/lingjing/release-v1711/*.deb 2>/dev/null
