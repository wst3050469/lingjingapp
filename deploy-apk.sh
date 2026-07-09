#!/bin/bash
# 灵境AI APK部署脚本
# 用法: ./deploy-apk.sh <apk文件路径> <版本号>
# 示例: ./deploy-apk.sh lingjing-v1.64.1.apk v1.64.1
# 注意: APK文件名必须符合 lingjing-v{版本号}.apk 格式

set -e

APK_FILE="${1:-lingjing-v1.64.1.apk}"
VERSION="${2:-v1.64.1}"

if [ ! -f "$APK_FILE" ]; then
    echo "错误: APK文件不存在: $APK_FILE"
    exit 1
fi

# 验证命名格式
if [[ ! "$APK_FILE" =~ ^lingjing-v[0-9]+\.[0-9]+\.[0-9]+\.apk$ ]]; then
    echo "警告: APK文件名不符合规范(lingjing-vX.Y.Z.apk): $APK_FILE"
fi

echo "=== 灵境AI APK 部署 ==="
echo "APK文件: $APK_FILE"
echo "版本号:  $VERSION"
echo "文件大小: $(du -h "$APK_FILE" | cut -f1)"

# 1. 部署到 nginx 静态目录
echo ""
echo "[1/4] 部署APK到Web目录..."
APK_DIR="/var/www/html/spiritrealmz/apk"
mkdir -p "$APK_DIR"
cp "$APK_FILE" "$APK_DIR/$APK_FILE"
ln -sf "$(pwd)/$APK_FILE" "$APK_DIR/latest.apk"
echo "  -> $APK_DIR/$APK_FILE"
echo "  -> $APK_DIR/latest.apk (符号链接)"

# 创建XZ压缩版
echo ""
echo "[1b/4] 创建XZ压缩版..."
xz -c "$APK_FILE" > "$APK_DIR/latest.apk.xz" 2>/dev/null && echo "  -> $APK_DIR/latest.apk.xz" || echo "  ⚠️  XZ压缩失败(跳过)"

# 2. 同步到 downloads 目录
echo ""
echo "[2/4] 同步版本文件到downloads目录..."
DOWNLOADS_DIR="/var/www/html/spiritrealmz/downloads"
mkdir -p "$DOWNLOADS_DIR"
# 复制版本配置文件
cp "$APK_DIR/../downloads/versions.json" "$DOWNLOADS_DIR/versions.json" 2>/dev/null || true
cp "$APK_DIR/../downloads/version.json" "$DOWNLOADS_DIR/version.json" 2>/dev/null || true
echo "  -> $DOWNLOADS_DIR/versions.json"
echo "  -> $DOWNLOADS_DIR/version.json"

# 3. 更新 versions.json (通过本地API)
echo ""
echo "[3/4] 更新版本信息..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

API_KEY="${API_KEY:-lingjing-cloud-key-v2-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6}"
curl -s -X POST "http://127.0.0.1:8000/api/notifications/version-update" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"version\": \"${VERSION#v}\",
    \"size\": $(stat -c%s "$APK_FILE" 2>/dev/null || stat -f%z "$APK_FILE" 2>/dev/null || echo 0),
    \"releaseNotes\": \"灵境AI移动端 $VERSION\"
  }" && echo "  ✅ 版本API更新成功" || echo "  ⚠️  版本API更新失败，请手动更新versions.json"

# 4. 验证部署
echo ""
echo "[4/4] 验证部署..."
APK_URL="https://www.spiritrealmz.com/apk/latest.apk"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APK_URL" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✅ APK可访问: $APK_URL (HTTP $HTTP_CODE)"
else
    echo "  ⚠️  APK访问检查: HTTP $HTTP_CODE (可能被WAF封锁)"
    echo "  直接IP检查..."
    IP_URL="https://43.103.5.36/apk/latest.apk"
    IP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "$IP_URL" 2>/dev/null || echo "000")
    if [ "$IP_CODE" = "200" ]; then
        echo "  ✅ 直接IP访问正常: $IP_URL (HTTP $IP_CODE)"
    fi
fi

echo ""
echo "=== 部署完成 ==="
echo "下载地址: $APK_URL"
echo "直接下载: https://43.103.5.36/apk/latest.apk"
