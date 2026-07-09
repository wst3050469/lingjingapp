#!/bin/bash
# 灵境AI APK部署脚本
# 用法: ./deploy-apk.sh <apk文件路径> <版本号>
# 示例: ./deploy-apk.sh LingJing-Mobile-v1.73.190.apk v1.73.190

set -e

APK_FILE="${1:-LingJing-Mobile-v1.73.190.apk}"
VERSION="${2:-v1.73.190}"

if [ ! -f "$APK_FILE" ]; then
    echo "错误: APK文件不存在: $APK_FILE"
    exit 1
fi

echo "=== 灵境AI APK 部署 ==="
echo "APK文件: $APK_FILE"
echo "版本号:  $VERSION"
echo "文件大小: $(du -h "$APK_FILE" | cut -f1)"

# 1. 部署到 nginx 静态目录
echo ""
echo "[1/4] 复制APK到Web目录..."
APK_DIR="/var/www/html/apk"
mkdir -p "$APK_DIR"
cp "$APK_FILE" "$APK_DIR/latest.apk"
cp "$APK_FILE" "$APK_DIR/LingJing-Mobile-${VERSION#v}.apk"
echo "  -> $APK_DIR/latest.apk"
echo "  -> $APK_DIR/LingJing-Mobile-${VERSION#v}.apk"

# 2. 同步到 downloads 目录
echo ""
echo "[2/4] 同步到downloads目录..."
DOWNLOADS_DIR="/var/www/downloads"
mkdir -p "$DOWNLOADS_DIR"
cp "$APK_FILE" "$DOWNLOADS_DIR/LingJing-Mobile-${VERSION#v}.apk"
echo "  -> $DOWNLOADS_DIR/LingJing-Mobile-${VERSION#v}.apk"

# 3. 更新 versions.json
echo ""
echo "[3/4] 更新版本信息..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 通过API更新版本信息 (需要在服务器上运行)
curl -s -X POST "http://127.0.0.1:8000/api/notifications/version-update" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY:-lingjing-cloud-key-dev-only}" \
  -d "{
    \"version\": \"$VERSION\",
    \"size\": $(stat -c%s "$APK_FILE" 2>/dev/null || stat -f%z "$APK_FILE" 2>/dev/null || echo 0),
    \"releaseNotes\": \"灵境AI移动端 $VERSION: React Native + Expo构建\"
  }" && echo "" || echo "  警告: 版本API更新失败，请手动更新versions.json"

# 4. 验证部署
echo ""
echo "[4/4] 验证部署..."
APK_URL="https://www.spiritrealmz.com/apk/latest.apk"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APK_URL" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✅ APK可访问: $APK_URL (HTTP $HTTP_CODE)"
else
    echo "  ⚠️  APK访问检查: HTTP $HTTP_CODE"
fi

echo ""
echo "=== 部署完成 ==="
echo "下载地址: $APK_URL"
echo "版本页面: https://www.spiritrealmz.com/#download"
