#!/bin/bash
set -e
echo "=== Copy cloud-admin to temp ==="
rm -rf /tmp/cloud-admin-build
cp -r /home/liuhui/lingjing/cloud-admin /tmp/cloud-admin-build

echo "=== Install deps ==="
cd /tmp/cloud-admin-build
npm install --legacy-peer-deps 2>&1

echo "=== Build ==="
npm run build 2>&1

echo "=== Check dist ==="
ls -la dist/ 2>/dev/null | head -10
echo ""
echo "=== Deploy to prod ==="
if [ -d dist ]; then
  ssh root@120.55.5.220 "rm -rf /var/www/admin/*"
  scp -r dist/* root@120.55.5.220:/var/www/admin/
  ssh root@120.55.5.220 "chown -R www-data:www-data /var/www/admin/"
  echo "Deployed!"
else
  echo "ERROR: dist/ not found"
fi
