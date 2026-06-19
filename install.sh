#!/bin/bash
cd /home/liuhui/lingjingapp
echo "=== find pnpm ==="
command -v pnpm || echo "pnpm not in PATH"
ls /home/liuhui/.local/share/pnpm/pnpm 2>/dev/null && echo "pnpm found in .local" || echo "not in .local"
export PATH="$HOME/.local/share/pnpm:$PATH"
command -v pnpm && pnpm --version
echo "=== node ==="
node --version
echo "=== start pnpm install ==="
pnpm install --frozen-lockfile
echo "=== pnpm install done, exit=$? ==="
ls packages/electron/node_modules/.package-lock.json 2>/dev/null && echo "electron node_modules OK" || echo "electron node_modules MISSING"