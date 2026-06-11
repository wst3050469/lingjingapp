#!/bin/bash
echo "=== Files in production but NOT in git ==="
for f in /root/cloud-server/*.js /root/cloud-server/*.mjs /root/cloud-server/*.json /root/cloud-server/*.yml /root/cloud-server/*.py; do
  base=$(basename "$f")
  if [ ! -f "/root/lingjing-git/cloud-server/$base" ]; then
    echo "MISSING: $base"
  fi
done
echo "---"
echo "=== Checking for secrets ==="
for f in package.json db.js payment-gateway.js fcm-provider.js apns-provider.js; do
  if [ -f "/root/cloud-server/$f" ]; then
    has_secret=$(grep -c "key\|secret\|password\|token\|cert\|private" "/root/cloud-server/$f" 2>/dev/null || echo 0)
    echo "$f: $has_secret secret-like references"
  fi
done
