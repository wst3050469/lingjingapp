#!/bin/bash
set -e
BUILD_DIR="/home/liuhui/lingjing-ide/desktop/electron/release-v17361"
PROD="root@120.55.5.220"
PROD_PATH="/var/www/downloads/"

echo "Testing production server..."
ssh -o StrictHostKeyChecking=no $PROD "echo PROD_REACHABLE" || { echo "PROD_UNREACHABLE"; exit 1; }

echo "Uploading NSIS installer..."
scp "$BUILD_DIR/灵境 Setup 1.73.61.exe" $PROD:$PROD_PATH
echo "NSIS done"

echo "Uploading Portable..."
scp "$BUILD_DIR/LingJing-Portable-1.73.61-win-x64.exe" $PROD:$PROD_PATH
echo "Portable done"

echo "Uploading latest.yml..."
scp "$BUILD_DIR/latest.yml" $PROD:$PROD_PATH
echo "latest.yml done"

echo "Uploading blockmap..."
scp "$BUILD_DIR/灵境 Setup 1.73.61.exe.blockmap" $PROD:$PROD_PATH
echo "blockmap done"

echo "=== ALL_UPLOADED ==="
