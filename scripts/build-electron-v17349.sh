#!/bin/bash
set -e
cd /home/liuhui/lingjing-ide/desktop/electron
echo '=== Phase 1: Build main process ==='
node scripts/build-main.mjs
echo '=== Phase 2: electron-builder ==='
npx electron-builder --win --x64 --config electron-builder.yml
echo '=== Phase 3: Done ==='
ls -la build-out/
