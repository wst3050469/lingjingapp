#!/bin/bash
set -e
cd /home/liuhui/lingjing-ide/desktop/electron

echo "=== build-main ==="
node scripts/build-main.mjs 2>&1

echo "=== electron-builder linux==="
# Remove old output dir to ensure clean build
rm -rf release-v17373 2>/dev/null || true
npx electron-builder --linux --x64 --publish never 2>&1

echo "=== Done ==="
ls -lh release-v17373/ 2>/dev/null || echo "No release dir"
