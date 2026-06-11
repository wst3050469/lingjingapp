#!/bin/bash
# Post-receive hook for lingjing-ide repo
# Auto-deploys backend services on push to master

DEPLOY_BACKEND="/root/cloud-server"
TMP_DIR=$(mktemp -d)
echo "[lingjing-ide] Hook triggered..."

while read oldrev newrev ref; do
  branch=$(basename "$ref")
  if [ "$branch" != "master" ]; then
    echo "[lingjing-ide] Skipping non-master branch: $branch"
    continue
  fi

  changed=$(git diff-tree -r --name-only "$oldrev" "$newrev" 2>/dev/null | grep "^services/backend/" || true)
  if [ -n "$changed" ]; then
    echo "[lingjing-ide] Backend files changed, deploying..."
    git --work-tree="$TMP_DIR" checkout "$newrev" -- services/backend/
    cp "$TMP_DIR/services/backend/server.js" "$DEPLOY_BACKEND/server.js"
    cp "$TMP_DIR/services/backend/package.json" "$DEPLOY_BACKEND/package.json"
    for f in db.js crypto-utils.js rate-limiter.js audit-logger.js db-helpers.js scheduler.js; do
      [ -f "$TMP_DIR/services/backend/$f" ] && cp "$TMP_DIR/services/backend/$f" "$DEPLOY_BACKEND/$f"
    done
    /usr/bin/pm2 restart cloud-server
    echo "[lingjing-ide] Backend deployed + restarted."
  else
    echo "[lingjing-ide] No backend changes. Skipping."
  fi
done

rm -rf "$TMP_DIR"
echo "[lingjing-ide] Done."
