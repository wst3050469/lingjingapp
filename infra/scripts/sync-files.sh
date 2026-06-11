#!/bin/bash
cd /root/cloud-server
for f in apns-provider.js audit-logger.js crypto-utils.js db-helpers.js fcm-provider.js log-stream.js notification-deduplicator.js payment-gateway.js push-fallback-handler.js rate-limiter.js scheduler.js slack-bot.js wecom.js ci-integration.js cloud-management-api.js add-activation.mjs add-payment-endpoints.mjs fix-signup.mjs init-admin-password.mjs package-lock.json payment-config.example.json webhooks.json ci-cd.yml docker-compose.yml fix_devices.py update_db.py; do
  if [ -f "$f" ]; then
    echo "Copying $f..."
    scp -o StrictHostKeyChecking=no /root/cloud-server/$f liuhui@192.168.1.9:/tmp/cloud-sync/ 2>/dev/null
  fi
done
echo "Done. Now scp from build machine to Windows"
