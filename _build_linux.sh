#!/bin/bash
set -e
cd /home/liuhui/lingjing/desktop/electron
node scripts/build-main.mjs
node scripts/pre-package.mjs
npx electron-builder build --linux --x64
echo "BUILD_LINUX_DONE"
