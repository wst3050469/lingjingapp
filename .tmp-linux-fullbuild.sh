#!/bin/bash
set -e
echo "=== Step 1: Install deps (if needed) ==="
cd /home/liuhui/lingjing-ide/desktop/electron
if [ ! -d "node_modules/.pnpm" ]; then
  echo "Installing pnpm dependencies..."
  pnpm install --frozen-lockfile
else
  echo "node_modules already present"
fi

echo ""
echo "=== Step 2: Build main.js ==="
node scripts/build-main.mjs 2>&1

echo ""
echo "=== Step 3: Build Linux packages ==="
rm -rf release-v17371
npx electron-builder --linux --x64 2>&1

echo ""
echo "=== Step 4: List artifacts ==="
ls -lh release-v17371/
