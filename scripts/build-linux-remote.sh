#!/bin/bash
cd /root/lingjing/packages/electron
cp /root/lingjing/electron-builder.json ./
echo "=== Building Linux AppImage + DEB ==="
pnpm run dist:linux 2>&1
echo "=== Build complete ==="
ls -lh release-v1646/ 2>/dev/null || ls -lh release-v*/ 2>/dev/null
