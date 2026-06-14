#!/bin/bash
echo "=== Step 0: Environment ==="
node --version
pnpm --version
which npx
echo ""

echo "=== Step 1: pnpm install ==="
cd /home/liuhui/lingjing-ide/desktop/electron
pnpm install --frozen-lockfile 2>&1
echo "pnpm install exit: $?"
echo ""

echo "=== Step 2: Build main.js ==="
node scripts/build-main.mjs 2>&1
echo "build-main exit: $?"
echo ""

echo "=== Step 3: electron-builder --linux --x64 ==="
rm -rf release-v17371
npx electron-builder --linux --x64 2>&1
echo "electron-builder exit: $?"
echo ""

echo "=== Step 4: Artifacts ==="
ls -lh release-v17371/ 2>&1
echo "=== DONE ==="
