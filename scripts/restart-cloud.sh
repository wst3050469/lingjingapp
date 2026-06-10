#!/bin/bash
pm2 stop cloud-server
sleep 2
pm2 start cloud-server
sleep 3
pm2 status
echo "---"
curl -sk http://127.0.0.1:8000/admin | python3 -c "import sys; print('Response size:', len(sys.stdin.read()), 'bytes')"
