#!/bin/bash
cd /home/liuhui/lingjing-ide
git checkout master -f
git reset --hard refs/heads/master

echo "=== Building core ==="
cd desktop/core
npx tsc 2>&1 || echo "tsc failed but continuing"

echo "=== Building electron ==="
cd ../electron
node scripts/build-main.mjs 2>&1 || { echo "build-main failed"; exit 1; }

echo "=== Electron-builder win ==="
npx electron-builder --win --x64 --publish never 2>&1 || { echo "electron-builder failed"; exit 1; }

echo "=== Done ==="
ls -la release-v17373/
