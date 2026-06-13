#!/bin/bash
set -e
cd /home/liuhui/lingjing-ide
git fetch /tmp/build-bundle.bundle HEAD:refs/heads/master
echo "Git updated"

# Build core
cd /home/liuhui/lingjing-ide/desktop/core
npx tsc 2>&1
echo "Core built"

# Build electron main
cd /home/liuhui/lingjing-ide/desktop/electron
node scripts/build-main.mjs 2>&1
echo "Electron main built"

# Build frontend
cd /home/liuhui/lingjing-ide/desktop/frontend
npx vite build 2>&1
echo "Frontend built"

# Build Windows installers
cd /home/liuhui/lingjing-ide/desktop/electron
node scripts/pre-package.mjs
npx electron-builder build --win --x64 2>&1
echo "Windows build complete"
ls -la release-v17229/*.exe 2>/dev/null || echo "No exe found in release-v17229"
