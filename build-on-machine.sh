#!/bin/bash
set -e
cd /home/liuhui/lingjing-ide

echo "=== Applying bundle ==="
git fetch /home/liuhui/lingjing-ide/build-bundle.bundle master:latest-bundle
git reset --hard latest-bundle
echo "CODE_SYNCED"

echo "=== Building ==="
cd desktop
pnpm install --no-frozen-lockfile
pnpm run dist
echo "BUILD_DONE"
