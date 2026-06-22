#!/bin/bash
set -e
cd /home/liuhui/lingjing

echo "[1/4] Installing systeminformation..."
cd packages/electron
npx pnpm add systeminformation
cd /home/liuhui/lingjing

echo "[2/4] Building renderer..."
cd packages/renderer
npx vite build
cd /home/liuhui/lingjing

echo "[3/4] Building electron main..."
cd packages/electron
node scripts/build-main.mjs
cd /home/liuhui/lingjing

echo "[4/4] Building Linux AppImage + deb..."
cd packages/electron
npx electron-builder build --linux --x64 --c.directories.output=release-v173159

echo "=== Build complete ==="
ls -lh release-v173159/
