#!/bin/bash
set -e
echo "=== Git remote ==="
cd /home/liuhui/lingjing-ide
git remote -v
echo ""
echo "=== Pulling ==="
git pull ssh://liuhui@192.168.1.9/home/liuhui/lingjing-ide master
echo ""
echo "=== Environment ==="
node --version
pnpm --version
cd desktop/electron
grep version package.json
echo "OK"
