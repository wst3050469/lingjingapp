#!/bin/bash
set -e
VERSION=1.63.0
echo "=== Building Linux v${VERSION} ==="
cd /home/liuhui/lingjing/packages/electron
echo "Step 1: Build core dist..."
cd /home/liuhui/lingjing/packages/core && npx tsc
echo "Step 2: Build renderer..."
cd /home/liuhui/lingjing/packages/renderer && npx vite build
echo "Step 3: build-main.mjs..."
cd /home/liuhui/lingjing/packages/electron && node scripts/build-main.mjs
echo "Step 4: electron-builder Linux..."
npx electron-builder build --linux --x64 --config electron-builder.json
echo "=== Build Complete ==="
ls -lh /home/liuhui/lingjing/packages/electron/release/LingJing-*.AppImage /home/liuhui/lingjing/packages/electron/release/LingJing-*.deb 2>/dev/null
