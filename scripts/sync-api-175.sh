#!/bin/bash
# Sync versions.json and restart PM2
ssh root@120.55.5.220 << 'EOF'
# Sync HTML version
cp /var/www/downloads/versions.json /var/www/html/versions.json
echo "Synced /var/www/html/versions.json"

# Restart PM2
pm2 restart cloud-server
echo "PM2 restarted"

# Verify
sleep 2
curl -s http://localhost:8900/api/latest | python3 -c "import sys,json; d=json.load(sys.stdin); print('API latest:', d.get('version','unknown'))"
EOF
