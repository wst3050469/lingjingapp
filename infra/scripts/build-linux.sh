#!/bin/bash
set -e
VERSION=$(cat /home/liuhui/lingjing/package.json | grep '"version"' | head -1 | cut -d'"' -f4)
echo "=== Building Linux v${VERSION} ==="
cd /home/liuhui/lingjing/packages/electron
echo "Step 1: pre-package..."
node scripts/pre-package.mjs
echo "Step 2: electron-builder Linux..."
npx electron-builder build --linux --x64 --config electron-builder.json 2>&1
echo "=== Build Complete ==="
ls -lh /home/liuhui/lingjing/packages/electron/release/LingJing-*.AppImage /home/liuhui/lingjing/packages/electron/release/LingJing-*.deb 2>/dev/null
