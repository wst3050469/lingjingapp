#!/bin/bash
set -e
echo "=== Installing dependencies ==="
cd /root/lingjing-v17369
pnpm install 2>&1
echo "=== Dependencies installed ==="
echo "=== Fixing @codepilot/core ==="
mkdir -p desktop/electron/node_modules/@codepilot
cp -r desktop/core/dist desktop/electron/node_modules/@codepilot/core/dist
cp desktop/core/package.json desktop/electron/node_modules/@codepilot/core/package.json
echo "=== Build main ==="
cd desktop/electron
node scripts/build-main.mjs 2>&1
echo "=== Build Linux ==="
npx electron-builder --linux --x64 2>&1
echo "=== Output ==="
ls -lh release-v17369/*.AppImage release-v17369/*.deb 2>/dev/null || find . -name "*1.73.69*" -type f
echo "DONE"
