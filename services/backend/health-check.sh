#!/bin/bash
# 灵境 v1.71.0 健康检查脚本
# 用法: bash deploy/health-check.sh

set -e
PASS=0; FAIL=0
check() { if eval "$2"; then echo "  [PASS] $1"; PASS=$((PASS+1)); else echo "  [FAIL] $1"; FAIL=$((FAIL+1)); fi }

echo "=== 灵境 v1.71.0 健康检查 ==="
echo ""

# 1. Nginx 运行
check "Nginx 运行中" "systemctl is-active nginx 2>/dev/null | grep -q active"

# 2. cloud-server 运行 (PM2)
check "cloud-server (PM2)" "pm2 list 2>/dev/null | grep cloud-server | grep -q online"

# 3. Landing 页面 (HTTP 200)
check "Landing 首页" "curl -sI -H 'Host: lingjing.zhejiangjinmo.com' http://127.0.0.1/ 2>/dev/null | head -1 | grep -q '200\|301'"

# 4. Admin API 健康
check "/api/health" "curl -s http://127.0.0.1:8000/api/health 2>/dev/null | grep -q ok"

# 5. 磁盘空间 (≥5GB)
check "磁盘 ≥5GB" "[ \$(df / --output=avail | tail -1) -gt 5000000 ]"

# 6. 内存可用 (≥100MB)
check "内存 ≥100MB" "[ \$(free -m | awk '/Mem:/{print \$7}') -gt 100 ]"

echo ""
echo "=== 结果: ${PASS} 通过 / ${FAIL} 失败 ==="
[ $FAIL -eq 0 ] && exit 0 || exit 1
