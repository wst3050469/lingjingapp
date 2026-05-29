#!/bin/bash
cd /home/liuhui/lingjing/packages/electron
echo "Step 1: Renderer build..."
cd /home/liuhui/lingjing/packages/renderer && npx vite build
echo "Step 2: build-main.mjs..."
cd /home/liuhui/lingjing/packages/electron && node scripts/build-main.mjs
echo "Step 3: electron-builder Linux..."
npx electron-builder build --linux --x64 --config electron-builder.json
echo "=== Build Complete ==="
ls -lh /home/liuhui/lingjing/packages/electron/release/LingJing-*.AppImage /home/liuhui/lingjing/packages/electron/release/LingJing-*.deb 2>/dev/null
