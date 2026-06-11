#!/bin/bash
cd /home/liuhui/lingjing
echo "=== electron-builder.yml version ==="
grep -E "version|Version" packages/electron/electron-builder.yml | head -5
echo ""
echo "=== app.json version ==="
grep version app.json
echo ""
echo "=== Full diff stat ==="
git diff --stat
