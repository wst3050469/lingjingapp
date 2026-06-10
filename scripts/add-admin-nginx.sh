#!/bin/bash
# Add /admin location to Nginx for lingjing.zhejiangjinmo.com
# This proxies /admin to the cloud-server on port 8000

CONF="/etc/nginx/sites-enabled/lingjing.zhejiangjinmo.com.conf"

# Check if /admin location already exists
if grep -q "location /admin" "$CONF"; then
  echo "admin location already exists"
  exit 0
fi

# Insert before the /downloads/ location
sed -i '/location \/downloads\/ {/i\
    # Admin management panel (cloud-server)\
    location /admin {\
        proxy_pass http://127.0.0.1:8000;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
    }\
' "$CONF"

echo "Added /admin location"
nginx -t && systemctl reload nginx && echo "Nginx reloaded OK"
