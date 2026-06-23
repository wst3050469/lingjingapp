#!/bin/sh
# ═══════════════════════════════════════════
# 灵境 APK 标准化构建流程
# 用法: sh /home/liuhui/lingjing/mobile/scripts/build-apk.sh
# ═══════════════════════════════════════════
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

MOBILE_DIR="/home/liuhui/lingjing/mobile"
ANDROID_DIR="$MOBILE_DIR/android"
APK_OUT="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"

echo "╔══════════════════════════════════════╗"
echo "║   灵境 APK 标准化构建流程           ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Step 1: 防回归验证 ──
echo "━━━ [1/4] 防回归: App.tsx theme 检查 ━━━"
node "$MOBILE_DIR/scripts/validate-app-theme.js"
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 防回归检查失败! 构建中止。${NC}"
    echo "请先修复 App.tsx 中的 theme 配置后再构建。"
    exit 1
fi
echo ""

# ── Step 2: 版本检查 ──
echo "━━━ [2/4] 版本号检查 ━━━"
VERSION=$(node -e "var j=require('$MOBILE_DIR/app.json');console.log(j.expo.version+' (vc:'+j.expo.android.versionCode+')')")
echo -e "${GREEN}版本: $VERSION${NC}"
echo ""

# ── Step 3: 构建 ──
echo "━━━ [3/4] 构建 APK ━━━"
cd "$ANDROID_DIR"
export ANDROID_HOME=/opt/android-sdk

./gradlew assembleRelease \
    -x lintVitalAnalyzeRelease \
    -x lintVitalReportRelease \
    -x lintVitalRelease \
    --no-daemon 2>&1 | tail -30

if [ ! -f "$APK_OUT" ]; then
    echo -e "${RED}❌ APK 构建失败!${NC}"
    exit 1
fi

APK_SIZE=$(stat -c%s "$APK_OUT")
echo ""
echo -e "${GREEN}✅ APK 构建成功: $APK_SIZE bytes${NC}"

# ── Step 4: 输出 ──
VER=$(node -e "var j=require('$MOBILE_DIR/app.json');console.log(j.expo.version)")
DST="/tmp/lingjing-ide-${VER}.apk"
cp "$APK_OUT" "$DST"
MD5=$(md5sum "$DST" | awk '{print $1}')
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  APK: $DST${NC}"
echo -e "${GREEN}  大小: $APK_SIZE bytes${NC}"
echo -e "${GREEN}  MD5: $MD5${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
