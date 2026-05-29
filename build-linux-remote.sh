#!/bin/bash
set -e
cd /home/liuhui/lingjing/packages/renderer
echo "=== Building renderer ==="
npx vite build 2>&1
echo "=== Build renderer complete ==="
cd /home/liuhui/lingjing/packages/electron
echo "=== Building main process ==="
node scripts/build-main.mjs 2>&1
echo "=== Build main process complete ==="
echo "=== Building Linux packages ==="
npx electron-builder build --linux --x64 --config electron-builder.json 2>&1
echo "=== Build Linux complete ==="
ls -lh /home/liuhui/lingjing/packages/electron/release/LingJing-*.AppImage 2>/dev/null
ls -lh /home/liuhui/lingjing/packages/electron/release/LingJing-*.deb 2>/dev/null
