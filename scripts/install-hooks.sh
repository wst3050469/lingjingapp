#!/bin/bash
# 安装git post-receive hook → 自动部署 + 隧道恢复
# 运行: sudo bash scripts/install-hooks.sh
set -e

BARE_REPO="/root/lingjing-git"
WORK_TREE="/root/lingjing"
HOOK_FILE="$BARE_REPO/hooks/post-receive"

if [ ! -d "$BARE_REPO" ]; then
    echo "ERROR: Bare repo not found at $BARE_REPO"
    echo "Usage: run this on the production server as root"
    exit 1
fi

cat > "$HOOK_FILE" << 'HOOK'
#!/bin/bash
set -e
while read oldrev newrev refname; do
    if [ "$refname" = "refs/heads/main" ]; then
        echo ">>> Deploying main branch ($newrev)..."
        unset GIT_DIR
        cd /root/lingjing || { echo "FAIL: cd /root/lingjing"; exit 1; }
        git pull 2>&1

        export PATH="/root/lingjing/node_modules/.bin:$PATH"
        npx expo export --platform web 2>&1 | tail -3

        rm -rf /root/lingjing/server/admin/
        cp -r /root/lingjing/dist /root/lingjing/server/admin/
        chmod -R 755 /root/lingjing/server/admin/

        pm2 restart enterprise-api 2>&1
        echo ">>> enterprise-api restarted"

        sleep 3

        # Reconnect SSH reverse tunnel: 120.55.5.220:8900 → 43.103.5.36:18900
        pkill -f "ssh.*-R.*18900" 2>/dev/null || true
        sleep 1
        ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no \
            -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes \
            -R 18900:localhost:8900 \
            root@43.103.5.36 -Nf 2>&1 || echo "TUNNEL WARN: reconnect failed"

        echo "=== Deploy + tunnel done ==="
    fi
done
HOOK

chmod +x "$HOOK_FILE"
echo "✅ Post-receive hook installed at $HOOK_FILE"
echo "   包含: git pull + expo export + admin copy + pm2 restart + SSH tunnel reconnect"
