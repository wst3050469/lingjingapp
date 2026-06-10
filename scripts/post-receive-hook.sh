#!/bin/bash
# Post-receive hook — auto-deploy + SSH tunnel recovery + HK sync
# This script lives inside the git repo and self-updates the bare repo hook.
set -e

SELF="/root/lingjing/scripts/post-receive-hook.sh"
BARE_HOOK="/root/lingjing-git/hooks/post-receive"

# Self-update: copy this script to the bare repo hook location
if [ -f "$SELF" ] && [ "$(readlink -f "$0")" != "$(readlink -f "$BARE_HOOK")" ]; then
    cp "$SELF" "$BARE_HOOK"
    chmod +x "$BARE_HOOK"
fi

while read oldrev newrev refname; do
    if [ "$refname" = "refs/heads/main" ]; then
        echo ">>> [$(date)] Deploying main ($newrev)..."

        unset GIT_DIR
        cd /root/lingjing || { echo "FAIL: cd"; exit 1; }

        # 1. Pull latest code
        git pull 2>&1
        echo ">>> git pull done"

        # 2. Export web
        export PATH="/root/lingjing/node_modules/.bin:$PATH"
        npx expo export --platform web 2>&1 | tail -3 || echo ">>> web export SKIPPED"
        echo ">>> web export done"

        # 3. Copy admin
        rm -rf /root/lingjing/server/admin/ 2>/dev/null || true
        cp -r /root/lingjing/dist /root/lingjing/server/admin/ 2>/dev/null || true
        chmod -R 755 /root/lingjing/server/admin/ 2>/dev/null || true
        echo ">>> admin copy done"

        # 4. Restart enterprise-api
        pm2 restart enterprise-api 2>&1 || echo ">>> pm2 restart FAILED"
        echo ">>> enterprise-api restarted"

        sleep 3

        # 5. Reconnect SSH reverse tunnel (120.55.5.220:8900 → 43.103.5.36:18900)
        echo ">>> checking SSH tunnel..."
        pkill -f "ssh.*-R.*18900" 2>/dev/null || true
        sleep 1
        ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no \
            -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes \
            -R 18900:localhost:8900 \
            root@43.103.5.36 -Nf 2>&1 || echo ">>> TUNNEL WARN"

        # 6. Sync server code to HK (43.103.5.36)
        echo ">>> syncing server code to HK..."
        rsync -avz --delete \
            --exclude 'venv' --exclude '__pycache__' --exclude '*.pyc' \
            --exclude 'uploads' --exclude 'tts_cache' --exclude '.env' \
            /root/lingjing/server/ root@43.103.5.36:/home/lingjing-server/ 2>&1 | tail -5

        # 7. Run DB migration on HK
        echo ">>> running DB migration on HK..."
        ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@43.103.5.36 \
            "cd /home/lingjing-server && source venv/bin/activate && python3 -c 'import asyncio; from app.db import migrate_existing_tables; print(\"migrate:\", asyncio.run(migrate_existing_tables()))'" 2>&1

        # 8. Restart enterprise-api on HK
        echo ">>> restarting enterprise-api on HK..."
        ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@43.103.5.36 \
            "systemctl restart lingjing-enterprise-api" 2>&1
        sleep 3
        ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@43.103.5.36 \
            "systemctl is-active lingjing-enterprise-api" 2>&1

        echo "=== [$(date)] Deploy complete ==="
    fi
done
