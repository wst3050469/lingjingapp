#!/bin/bash
set -e
echo "=== Building Windows v1.52.12 (via Linux cross-compile) ==="
cd /home/liuhui/lingjing/packages/electron
echo "Step 1: pre-package..."
node scripts/pre-package.mjs
echo "Step 2: electron-builder Windows (cross-compile)..."
export WINEDLLOVERRIDES="winemenubuilder.exe=d"
npx electron-builder build --win --x64 --config electron-builder.json 2>&1
echo "=== Build Complete ==="
ls -lh release/LingJing-Setup-1.52.12-win-x64.exe release/LingJing-Portable-1.52.12-win-x64.exe 2>/dev/null
