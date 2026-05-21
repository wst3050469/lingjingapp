#!/bin/bash
echo "=== 步骤 1: 构建 @codepilot/core ==="
cd packages/core
pnpm run build || exit 1
cd ../..

echo "=== 步骤 2: 构建 renderer ==="
cd packages/renderer
pnpm run build || exit 1
cd ../..

echo "=== 步骤 3: 构建 Electron 主进程 ==="
cd packages/electron
node scripts/build-main.mjs || exit 1

echo "=== 步骤 4: 打包 Windows ==="
npx electron-builder build --win --x64 || exit 1

echo "=== 完成 ==="
ls -lh release/LingJing-Setup-1.46.3-win-x64.exe release/LingJing-Portable-1.46.3-win-x64.exe 2>/dev/null
