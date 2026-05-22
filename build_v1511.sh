#!/bin/bash
set -e
echo "=== Step 1: Update versions ==="
cd /home/liuhui/lingjing

# Update electron version
sed -i 's/"version": "1.51.0"/"version": "1.51.1"/' packages/electron/package.json
# Update core version
sed -i 's/"version": "1.50.0"/"version": "1.51.1"/' packages/core/package.json
# Update renderer version
sed -i 's/"version": "1.50.0"/"version": "1.51.1"/' packages/renderer/package.json
# Update electron-builder output dir
sed -i 's/release-v1510/release-v1511/g' packages/electron/electron-builder.json

echo "Versions updated:"
grep '"version"' packages/electron/package.json packages/core/package.json packages/renderer/package.json app.json
echo "Builder output:"
grep output packages/electron/electron-builder.json

echo ""
echo "=== Step 2: Build main process (esbuild) ==="
cd packages/electron
node scripts/build-main.mjs 2>&1
echo "Build main process done."

echo ""
echo "=== Step 3: Prepackage ==="
node scripts/pre-package.mjs 2>&1
echo "Prepackage done."

echo ""
echo "=== Step 4: Commit version bump ==="
cd /home/liuhui/lingjing
git add -A
git commit -m "v1.51.1: bump version for desktop build" 2>/dev/null || echo "Nothing to commit"
echo "Version bump committed."
echo ""
echo "=== BUILD READY ==="
echo "Run this to build Linux:"
echo "  cd /home/liuhui/lingjing/packages/electron && npx electron-builder build --linux --x64 2>&1"
echo ""
echo "Run this to build Windows (via Wine):"
echo "  cd /home/liuhui/lingjing/packages/electron && npx electron-builder build --win --x64 2>&1"
