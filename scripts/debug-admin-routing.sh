#!/bin/bash
echo "=== Direct Express test ==="
echo "GET /admin/versions-v2.html (via Express):"
curl -sk http://127.0.0.1:8000/admin/versions-v2.html | head -c 100

echo ""
echo ""
echo "=== Via Nginx ==="
echo "GET /admin/versions-v2.html (via Nginx HTTPS):"
curl -sk https://lingjing.zhejiangjinmo.com/admin/versions-v2.html | head -c 100

echo ""
echo ""
echo "=== Check Nginx /admin config ==="
grep -A6 'location /admin' /etc/nginx/sites-enabled/lingjing.zhejiangjinmo.com.conf | head -20
