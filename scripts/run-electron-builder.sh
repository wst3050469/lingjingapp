#!/bin/bash
set -e
cd /home/liuhui/lingjing-ide/desktop/electron

# Unset any Windows NODE_PATH that might leak through
unset NODE_PATH

echo "=== Running electron-builder ==="
./node_modules/.bin/electron-builder --win --x64 --config electron-builder.yml 2>&1

echo "=== Build complete ==="
ls -la build-out/ 2>/dev/null || echo "No build-out directory"
