#!/bin/bash
echo "=== 3001 latest ==="
curl -s http://localhost:3001/api/versions | python3 -c "import sys,json; d=json.load(sys.stdin); print('3001 latest:', d.get('latest','?'))"

echo ""
echo "=== 3002 latest ==="
curl -s http://localhost:3002/api/versions | python3 -c "import sys,json; d=json.load(sys.stdin); print('3002 latest:', d.get('latest','?'))"

echo ""
echo "=== Sync other update data dirs ==="
cp /var/www/downloads/versions.json /root/lingjing/update-server/data/versions.json 2>/dev/null && echo "synced /root/lingjing/update-server/"
cp /var/www/downloads/versions.json /root/lingjing-update/data/versions.json 2>/dev/null && echo "synced /root/lingjing-update/"
cp /var/www/downloads/versions.json /root/lingjing-build/update-server/data/versions.json 2>/dev/null && echo "synced /root/lingjing-build/update-server/"
