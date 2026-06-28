#!/bin/bash
HOST="root@120.55.5.220"
echo "=== latest.yml ==="
ssh $HOST grep version /var/www/downloads/latest.yml
echo "=== latest-linux.yml ==="
ssh $HOST grep version /var/www/downloads/latest-linux.yml
echo "=== versions.json ==="
ssh $HOST python3 -c "import json; d=json.load(open('/var/www/downloads/versions.json')); print('latest:', d['latest'])"
echo "=== New files ==="
ssh $HOST ls -la /var/www/downloads/LingJing*1.73.175*
