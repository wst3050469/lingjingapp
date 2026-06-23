#!/bin/bash
# Deploy v1.73.175 to production server
set -e

VERSION="1.73.175"
RELEASE_DIR="/home/liuhui/lingjing/packages/electron/release"
REMOTE_HOST="root@120.55.5.220"
REMOTE_DIR="/var/www/downloads"

echo "=== Deploy v${VERSION} to production ==="

# Upload Windows files
echo "Uploading Windows Setup..."
scp -o StrictHostKeyChecking=no "${RELEASE_DIR}/LingJing-Setup-${VERSION}-win-x64.exe" "${REMOTE_HOST}:${REMOTE_DIR}/"
echo "Uploading Windows Portable..."
scp -o StrictHostKeyChecking=no "${RELEASE_DIR}/LingJing-Portable-${VERSION}-win-x64.exe" "${REMOTE_HOST}:${REMOTE_DIR}/"
echo "Uploading blockmap..."
scp -o StrictHostKeyChecking=no "${RELEASE_DIR}/LingJing-Setup-${VERSION}-win-x64.exe.blockmap" "${REMOTE_HOST}:${REMOTE_DIR}/"
echo "Uploading latest.yml..."
scp -o StrictHostKeyChecking=no "${RELEASE_DIR}/latest.yml" "${REMOTE_HOST}:${REMOTE_DIR}/"

# Upload Linux files
echo "Uploading Linux AppImage..."
scp -o StrictHostKeyChecking=no "${RELEASE_DIR}/LingJing-${VERSION}-linux-x86_64.AppImage" "${REMOTE_HOST}:${REMOTE_DIR}/"
echo "Uploading Linux DEB..."
scp -o StrictHostKeyChecking=no "${RELEASE_DIR}/LingJing-${VERSION}-linux-x86_64.deb" "${REMOTE_HOST}:${REMOTE_DIR}/"
echo "Uploading latest-linux.yml..."
scp -o StrictHostKeyChecking=no "${RELEASE_DIR}/latest-linux.yml" "${REMOTE_HOST}:${REMOTE_DIR}/"

echo "=== Deploy complete ==="
