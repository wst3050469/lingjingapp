#!/bin/bash
export NODE_ENV=production
export JWT_SECRET=acac023ba9b42d5b2b77c6bfdce7f22b7c2ae910da3d26c5c6f47174e0630958
pm2 restart cloud-server --update-env
echo "Done. Checking status..."
sleep 2
pm2 list
curl -s -o /dev/null -w "API HTTP: %{http_code}\n" http://127.0.0.1:8000/api/latest
