#!/bin/bash
# 灵境 → 新产品 一键改名脚本
# 用法: bash 一键改名.sh 新英文名 新中文名 新域名
# 示例: bash 一键改名.sh MyApp "我的应用" myapp.example.com

set -e

EN_NAME="${1:?请提供新英文名}"
CN_NAME="${2:?请提供新中文名}"
DOMAIN="${3:?请提供新域名}"
BASE="/home/liuhui/lingjingapp"

echo "============================================"
echo "  灵境 → $CN_NAME ($EN_NAME)"
echo "  域名: $DOMAIN"
echo "============================================"
echo ""

# 1. Flutter 配置文件
echo "1/7 Flutter 配置..."
sed -i "s/name: lingjing/name: $EN_NAME/" "$BASE/app/pubspec.yaml"
sed -i "s/spiritrealmz/$DOMAIN/" "$BASE/app/lib/config.dart"
sed -i "s/灵境/$CN_NAME/g" "$BASE/app/lib/config.dart"
sed -i "s/灵境/$CN_NAME/g" "$BASE/app/android/app/src/main/AndroidManifest.xml"

# 2. Android 包名
OLD_PKG="com.spiritrealmz.lingjing"
NEW_PKG="com.${DOMAIN//./_}.${EN_NAME}"
echo "2/7 Android 包名: $OLD_PKG → $NEW_PKG"
find "$BASE/app/android" -type f -exec sed -i "s/$OLD_PKG/$NEW_PKG/g" {} \;

# 3. iOS (如有)
if [ -d "$BASE/app/ios" ]; then
  echo "3/7 iOS 配置..."
  sed -i "s/灵境/$CN_NAME/g" "$BASE/app/ios/Runner/Info.plist" 2>/dev/null || true
fi

# 4. 后端配置
echo "4/7 后端配置..."
sed -i "s/spiritrealmz/$DOMAIN/g" "$BASE/server/app/config.py"
sed -i "s/灵境/$CN_NAME/g" "$BASE/server/app/main.py"

# 5. Web 管理后台
echo "5/7 Web管理后台..."
find "$BASE/admin" -name "*.html" -exec sed -i "s/灵境/$CN_NAME/g" {} \;
find "$BASE/admin" -name "*.js" -exec sed -i "s/灵境/$CN_NAME/g" {} \;

# 6. 系统提示词中的产品名
echo "6/7 System prompts..."
find "$BASE/server" -name "*.py" -exec sed -i "s/灵境/$CN_NAME/g" {} \;
find "$BASE/server" -name "*.py" -exec sed -i "s/LingJing/$EN_NAME/g" {} \;

# 7. 文档
echo "7/7 文档..."
find "$BASE" -name "*.md" -exec sed -i "s/灵境/$CN_NAME/g" {} \;
find "$BASE" -name "*.md" -exec sed -i "s/spiritrealmz/$DOMAIN/g" {} \;

echo ""
echo "✅ 改名完成: $CN_NAME ($EN_NAME)"
echo "⚠️ 请手动检查:"
echo "  - .env 文件中的环境变量"
echo "  - OSS/CDN 配置"
echo "  - DeepSeek API Key"
echo "  - Android 签名密钥"
