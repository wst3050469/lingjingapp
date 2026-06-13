#!/bin/bash
set -e
cd /home/liuhui/lingjing-ide/desktop/electron

# Install deps if needed
pnpm install --frozen-lockfile 2>&1 | tail -1

# Build core
cd /home/liuhui/lingjing-ide/desktop/core
npx tsc 2>&1 | tail -3
echo "Core compiled"

# Build frontend
cd /home/liuhui/lingjing-ide/desktop/frontend
npx vite build 2>&1 | tail -5
echo "Frontend built"

# Build electron main
cd /home/liuhui/lingjing-ide/desktop/electron
node scripts/build-main.mjs 2>&1 | tail -5
echo "Electron main built"

# Build Windows installers
node scripts/pre-package.mjs
npx electron-builder build --win --x64 2>&1 | tail -20
echo "=== BUILD COMPLETE ==="
ls -lh release-v17229/*.exe 2>/dev/null
ls -lh release-v17229/*.yml 2>/dev/null
