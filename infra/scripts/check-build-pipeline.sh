#!/bin/bash
cd /home/liuhui/lingjing

echo "=== Current state ==="
git log --oneline -3

echo ""
echo "=== Check for cloud-admin source ==="
find . -path "*/cloud-admin*" -o -path "*/admin-vue*" 2>/dev/null | head -10

echo ""
echo "=== Check if cloud-server has admin panel ==="
ls packages/ 2>/dev/null
find . -name "admin-api.js" -o -name "admin.html" 2>/dev/null | head -5

echo ""
echo "=== Check server dir ==="
ls server/ 2>/dev/null || echo "no server dir"
ls /root/cloud-server/ 2>/dev/null | head -10 || echo "no /root/cloud-server"

echo ""
echo "=== Check if npm/pnpm build available ==="
which pnpm 2>/dev/null && echo "pnpm: $(pnpm --version)" || echo "no pnpm"
which node 2>/dev/null && echo "node: $(node --version)" || echo "no node"
