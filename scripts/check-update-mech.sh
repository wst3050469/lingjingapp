#!/bin/bash
echo "=== CHECK LATEST-LINUX.YML ==="
ls -lh /home/liuhui/lingjing/desktop/electron/release-v17386/latest-linux.yml 2>/dev/null
cat /home/liuhui/lingjing/desktop/electron/release-v17386/latest-linux.yml 2>/dev/null

echo "=== CHECK PROD YML FILES ==="
ssh root@120.55.5.220 "ls -lh /var/www/downloads/1.73.86/*.yml /var/www/html/latest-linux.yml /var/www/html/latest.yml 2>/dev/null"

echo "=== CHECK MOBILE UPDATE ==="
ssh root@120.55.5.220 "curl -s http://localhost:3002/api/latest | head -200"

echo "=== DONE ==="
