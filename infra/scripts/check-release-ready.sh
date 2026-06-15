#!/bin/bash
# ============================================================
# check-release-ready.sh — 灵境版本发布就绪验证脚本
# ============================================================
# 用途：在发布新版本到生产环境后运行，验证所有安装包和API端点
# 用法：bash check-release-ready.sh [version]
#   version: 可选，默认为 1.73.79
#
# 检查项：
#   1. /api/latest 返回正确版本且状态为 published
#   2. latest.yml 存在且指向正确的安装包
#   3. 所有平台安装包可达 (HTTP 200/HEAD)
#   4. 安装包文件大小合理 (>1MB)
#   5. versions.json 版本一致性
# ============================================================

set -e

VERSION="${1:-1.73.79}"
BASE_URL="${BASE_URL:-https://ide.zhejiangjinmo.com}"
BASE_DIR="/var/www/downloads"
VERSION_DIR="${BASE_DIR}/${VERSION}"
HTML_DIR="/var/www/html"
PASS=0
FAIL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { echo -e "  ${GREEN}✓ PASS${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗ FAIL${NC} $1 — $2"; FAIL=$((FAIL + 1)); }
warn() { echo -e "  ${YELLOW}⚠ WARN${NC} $1 — $2"; }

echo "========================================"
echo " 灵境 Release Readiness Check"
echo " Version: v${VERSION}"
echo " Time:    $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================"
echo ""

# ── 1. /api/latest endpoint ──
echo "[1] /api/latest endpoint"
API_RESP=$(curl -s --max-time 10 "${BASE_URL}/api/latest" 2>&1) || true
API_VERSION=$(echo "$API_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('version',''))" 2>/dev/null) || true
API_STATUS=$(echo "$API_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null) || true

if [ "$API_VERSION" = "$VERSION" ]; then
  pass "/api/latest version = ${API_VERSION}"
else
  fail "/api/latest version" "expected ${VERSION}, got ${API_VERSION}"
fi

if [ "$API_STATUS" = "published" ]; then
  pass "/api/latest status = published"
else
  fail "/api/latest status" "expected published, got ${API_STATUS}"
fi
echo ""

# ── 2. latest.yml ──
echo "[2] latest.yml"
YML_URL="${BASE_URL}/downloads/latest.yml"
YML_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$YML_URL" 2>&1) || true
if [ "$YML_HTTP" = "200" ]; then
  YML_VERSION=$(curl -s --max-time 10 "$YML_URL" | grep "^version:" | awk '{print $2}')
  if [ "$YML_VERSION" = "$VERSION" ]; then
    pass "latest.yml version = ${YML_VERSION}"
  else
    fail "latest.yml version" "expected ${VERSION}, got ${YML_VERSION}"
  fi
else
  fail "latest.yml HTTP" "status ${YML_HTTP}"
fi
echo ""

# ── 3. File availability ──
echo "[3] Installation package availability"

declare -A FILES=(
  ["win-portable"]="${VERSION_DIR}/LingJing-Portable-${VERSION}-win-x64.exe"
  ["win-setup"]="${VERSION_DIR}/灵境 Setup ${VERSION}.exe"
  ["linux-appimage"]="${VERSION_DIR}/LingJing-${VERSION}-linux-x86_64.AppImage"
  ["linux-deb"]="${VERSION_DIR}/LingJing-${VERSION}-linux-x86_64.deb"
  ["android-apk"]="${VERSION_DIR}/lingjing-mobile-${VERSION}.apk"
)

for platform in win-portable win-setup linux-appimage linux-deb android-apk; do
  local_path="${FILES[$platform]}"
  # Construct URL from local path
  url_path="${local_path#/var/www/downloads/}"
  url="${BASE_URL}/downloads/${url_path}"

  if [ -f "$local_path" ]; then
    size=$(stat -c%s "$local_path" 2>/dev/null || echo 0)
    size_mb=$((size / 1048576))

    # HEAD check
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$url" 2>&1) || true

    if [ "$http_code" = "200" ] && [ "$size" -gt 1048576 ]; then
      pass "${platform} (${size_mb}MB, HTTP ${http_code})"
    elif [ "$http_code" = "200" ]; then
      warn "${platform}" "file too small: ${size} bytes"
    else
      fail "${platform} URL" "HTTP ${http_code}, file size=${size_mb}MB"
    fi
  else
    # File doesn't exist locally — check if URL still works (e.g. mobile APK may be only on remote)
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$url" 2>&1) || true
    if [ "$http_code" = "200" ]; then
      warn "${platform}" "local file missing but URL returns 200"
    else
      fail "${platform}" "file not found locally and URL returns ${http_code}"
    fi
  fi
done
echo ""

# ── 4. versions.json consistency ──
echo "[4] versions.json consistency"
if [ -f "${HTML_DIR}/versions.json" ]; then
  VJ_LATEST=$(python3 -c "import json; d=json.load(open('${HTML_DIR}/versions.json')); print(d.get('latest',''))" 2>/dev/null) || true
  if [ "$VJ_LATEST" = "$VERSION" ]; then
    pass "versions.json latest = ${VJ_LATEST}"
  else
    fail "versions.json latest" "expected ${VERSION}, got ${VJ_LATEST}"
  fi
else
  fail "versions.json" "file not found at ${HTML_DIR}/versions.json"
fi
echo ""

# ── 5. Services health ──
echo "[5] Service health"
# Check port 8000 (cloud-server)
HTTP_8000=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:8000/health" 2>&1) || true
if [ "$HTTP_8000" = "200" ]; then
  pass "cloud-server (:8000) health OK"
else
  fail "cloud-server (:8000)" "HTTP ${HTTP_8000}"
fi

# Check port 3002 (lingjing-update-server)
HTTP_3002=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:3002/health" 2>&1) || true
if [ "$HTTP_3002" = "200" ]; then
  pass "lingjing-update-server (:3002) health OK"
else
  fail "lingjing-update-server (:3002)" "HTTP ${HTTP_3002}"
fi
echo ""

# ── Summary ──
echo "========================================"
echo " Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}✗ RELEASE NOT READY — ${FAIL} check(s) failed${NC}"
  exit 1
else
  echo -e "${GREEN}✓ RELEASE READY — all checks passed${NC}"
  exit 0
fi
