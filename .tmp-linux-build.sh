#!/bin/bash
set -e
echo "=== Pulling latest v1.73.71 changes ==="
cd /home/liuhui/lingjing-ide
git pull build-machine master

echo ""
echo "=== Checking environment ==="
node --version
pnpm --version
cd desktop/electron
grep version package.json
