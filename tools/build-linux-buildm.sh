#!/bin/bash
set -e
cd /home/liuhui/lingjing/packages/electron
echo "=== Linux Build v1.71.1 ==="
echo "Node: $(node --version)"
echo "Dir: $(pwd)"

echo "--- Build main ---"
node scripts/build-main.mjs

echo "--- Pre-package ---"
node scripts/pre-package.mjs

echo "--- electron-builder --linux --x64 ---"
NODE_OPTIONS="--max-old-space-size=2048" npx electron-builder build --linux --x64 --config electron-builder.yml
echo "=== Done ==="
ls -lh release-v1711/*.AppImage release-v1711/*.deb 2>/dev/null || echo "Checking output..."
ls /home/liuhui/lingjing/packages/electron/release-v1711/ 2>/dev/null || echo "No release-v1711 dir"
ls /home/liuhui/lingjing/release-v1711/ 2>/dev/null || echo "No root release-v1711 dir"
