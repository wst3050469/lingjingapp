#!/bin/bash
# Fix cloud-server: either move .env to cwd or change PM2 cwd
echo "=== CHECK DOTENV ==="
grep -n "dotenv\|\.env\|require.*env" /root/cloud-server/server.js | head -5

echo "=== FIX: copy .env to cwd (/root) ==="
cp /root/cloud-server/.env /root/.env 2>/dev/null && echo "Copied to /root/.env" || echo "FAILED"

echo "=== RESTART with update-env ==="
# Set env vars in current shell for PM2 to pick up
export $(cat /root/cloud-server/.env | grep -v '^#' | xargs)
pm2 restart cloud-server --update-env 2>&1

sleep 2
echo "=== CHECK LOGS ==="
pm2 logs cloud-server --nostream --lines 5 --err 2>&1

echo "=== DONE ==="
