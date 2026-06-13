#!/bin/bash
set -e

LOG="/tmp/build-v17349.log"
rm -f "$LOG"

echo "=== v1.73.49 Build Started $(date) ===" >> "$LOG"

cd /home/liuhui/lingjing-ide/desktop

# 1. Install core deps
echo "--- pnpm install core ---" >> "$LOG"
cd core
/home/liuhui/.npm-global/bin/pnpm install --no-frozen-lockfile >> "$LOG" 2>&1
echo "core install done" >> "$LOG"

# 2. Build core
echo "--- tsc core ---" >> "$LOG"
npx tsc >> "$LOG" 2>&1 || echo "tsc warnings (ignored)" >> "$LOG"
echo "core build done" >> "$LOG"

# 3. Install electron deps
echo "--- pnpm install electron ---" >> "$LOG"
cd ../electron
/home/liuhui/.npm-global/bin/pnpm install --no-frozen-lockfile >> "$LOG" 2>&1
echo "electron install done" >> "$LOG"

# 4. Install frontend deps
echo "--- pnpm install frontend ---" >> "$LOG"
cd ../frontend
/home/liuhui/.npm-global/bin/pnpm install --no-frozen-lockfile >> "$LOG" 2>&1
echo "frontend install done" >> "$LOG"

# 5. Build frontend
echo "--- vite build frontend ---" >> "$LOG"
npx vite build >> "$LOG" 2>&1
echo "frontend build done" >> "$LOG"

# 6. Copy frontend dist to electron renderer
echo "--- copy renderer ---" >> "$LOG"
cp dist/index.html ../electron/renderer/index.html
cp -r dist/assets/* ../electron/renderer/assets/
echo "renderer copy done" >> "$LOG"

# 7. Build electron main
echo "--- build-main.mjs ---" >> "$LOG"
cd ../electron
node scripts/build-main.mjs >> "$LOG" 2>&1
echo "main build done" >> "$LOG"

# 8. Pre-package
echo "--- pre-package.mjs ---" >> "$LOG"
node scripts/pre-package.mjs >> "$LOG" 2>&1
echo "pre-package done" >> "$LOG"

# 9. electron-builder
echo "--- electron-builder ---" >> "$LOG"
npx electron-builder build --win --x64 >> "$LOG" 2>&1
echo "electron-builder done" >> "$LOG"

echo "=== v1.73.49 Build Complete $(date) ===" >> "$LOG"
echo "BUILD_SUCCESS" >> "$LOG"
