#!/bin/bash
set -e
echo "=== 灵境IDE Linux桌面构建 v1.73.34 ==="
cd /home/liuhui/lingjing/packages/electron

export ELECTRON_CUSTOM_VERSION=39.0.0

# Step 1: Build main process
echo "[1/3] Building main process..."
node scripts/build-main.mjs 2>&1 | tail -5 || echo "build-main skipped (pre-built)"

# Step 2: Pre-package  
echo "[2/3] Pre-packaging..."
node scripts/pre-package.mjs 2>&1 | tail -5 || echo "pre-package skipped"

# Step 3: electron-builder
echo "[3/3] Building Linux packages..."
npx electron-builder build --linux --x64 --config electron-builder.json --publish never 2>&1 | tail -30

echo ""
echo "=== Build Complete ==="
ls -lh release/LingJing-* 2>/dev/null || echo "No release files found"
