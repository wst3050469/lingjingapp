#!/bin/bash
# 灵境 cloud-server 自动部署脚本
# 从 git bare repo (/root/lingjing-git) 同步 /root/cloud-server/
GIT_REPO="/root/lingjing-git"
DEPLOY_DIR="/root/cloud-server"
TMP_DIR="/tmp/cloud-deploy-$$"

echo "[$(date)] Starting cloud-server deploy..."
git clone --depth 1 "$GIT_REPO" "$TMP_DIR" 2>/dev/null
if [ $? -ne 0 ]; then
  echo "ERROR: git clone failed"
  exit 1
fi

# Sync server.js and package.json
cp "$TMP_DIR/cloud-server/server.js" "$DEPLOY_DIR/server.js"
cp "$TMP_DIR/cloud-server/package.json" "$DEPLOY_DIR/package.json"
# Sync other essential files
for f in db.js crypto-utils.js rate-limiter.js audit-logger.js db-helpers.js notification-deduplicator.js push-fallback-handler.js apns-provider.js fcm-provider.js log-stream.js scheduler.js; do
  [ -f "$TMP_DIR/cloud-server/$f" ] && cp "$TMP_DIR/cloud-server/$f" "$DEPLOY_DIR/$f"
done

rm -rf "$TMP_DIR"

# Restart
pm2 restart cloud-server
echo "[$(date)] Deploy complete. cloud-server restarted."
