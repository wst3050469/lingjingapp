#!/bin/bash
set -e
cd /root/lingjing

echo "=== Step 1: Update package.json files ==="
cp /tmp/pkg-update/electron-package.json /root/lingjing/packages/electron/package.json
cp /tmp/pkg-update/renderer-package.json /root/lingjing/packages/renderer/package.json
cp /tmp/pkg-update/core-package.json /root/lingjing/packages/core/package.json
echo "Package.json files updated"
grep '"version"' /root/lingjing/packages/electron/package.json

echo "=== Step 2: Install deps ==="
pnpm install 2>&1 | tail -5

echo "=== Step 3: Build renderer ==="
cd /root/lingjing/packages/renderer
pnpm run build 2>&1 | tail -10

echo "=== Step 4: Rebuild Linux ==="
cd /root/lingjing/packages/electron
rm -rf release-v1646
pnpm run dist:linux 2>&1 | tail -30

echo "=== FINAL OUTPUT ==="
ls -lh /root/lingjing/packages/electron/release-v1646/
