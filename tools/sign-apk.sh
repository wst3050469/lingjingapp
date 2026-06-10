#!/bin/bash
set -e

SDK_BT="/home/liuhui/android-sdk/build-tools/35.0.0"
APK_IN="/home/liuhui/lingjing-1.71.1-patched.apk"
APK_ALIGNED="/home/liuhui/lingjing-1.71.1-aligned.apk"
APK_OUT="/home/liuhui/lingjing-1.71.1-signed.apk"
KS="/home/liuhui/lingjing-rel.keystore"
KS_PASS="lingjing2024"
KEY_ALIAS="lingjing"
KEY_PASS="lingjing2024"

echo "[1/2] Zipaligning..."
rm -f "$APK_ALIGNED"
$SDK_BT/zipalign -p 4 "$APK_IN" "$APK_ALIGNED"
echo "  Aligned: $(ls -lh $APK_ALIGNED | awk '{print $5}')"

echo "[2/2] Signing..."
rm -f "$APK_OUT"
$SDK_BT/apksigner sign \
  --ks "$KS" \
  --ks-pass "pass:$KS_PASS" \
  --ks-key-alias "$KEY_ALIAS" \
  --key-pass "pass:$KEY_PASS" \
  --out "$APK_OUT" \
  "$APK_ALIGNED"
echo "  Signed: $(ls -lh $APK_OUT | awk '{print $5}')"

echo "DONE - $APK_OUT"
