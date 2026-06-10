#!/bin/bash
# v1.64.46 部署脚本
set -e

echo "=== 灵境 v1.64.46 部署开始 ==="

# 1. 查找并更新 Python API 服务器 main.py
MAIN_FILES=$(find / -name 'main.py' -path '*/server/app/*' -type f 2>/dev/null)
if [ -n "$MAIN_FILES" ]; then
    for f in $MAIN_FILES; do
        echo "找到 main.py: $f"
        cp /tmp/lingjing-update/main.py "$f"
        echo "已更新: $f"
    done
else
    echo "未找到 server/app/main.py (企业API可能不在本机)"
fi

# 2. Docker 文件部署 (如果 /root/lingjing 存在)
if [ -d /root/lingjing ]; then
    cp /tmp/lingjing-update/docker-compose.yml /root/lingjing/
    mkdir -p /root/lingjing/docker /root/lingjing/scripts
    cp /tmp/lingjing-update/Dockerfile.win /root/lingjing/docker/
    cp /tmp/lingjing-update/docker-build.sh /root/lingjing/scripts/
    echo "Docker 文件已部署到 /root/lingjing/"
fi

# 3. 重启 PM2 服务
pm2 list 2>/dev/null | grep -E 'cloud-server|enterprise' && echo "重启 PM2 服务..."
pm2 restart cloud-server 2>/dev/null || echo "cloud-server 不在 PM2 管理中"
pm2 restart enterprise-api 2>/dev/null || echo "enterprise-api 不在 PM2 管理中"

# 4. 验证版本
echo "=== 版本验证 ==="
curl -s http://127.0.0.1:8000/ 2>/dev/null | head -c 200 || echo "8000 端口无响应"
echo ""
curl -s http://127.0.0.1:8900/ 2>/dev/null | head -c 200 || echo "8900 端口无响应"
echo ""

echo "=== v1.64.46 部署完成 ==="
