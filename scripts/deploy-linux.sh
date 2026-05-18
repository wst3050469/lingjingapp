#!/bin/bash
# 灵境 LingJing - 服务器构建与部署脚本
# 用法: bash /root/lingjing-git/scripts/deploy-linux.sh [version]
# 在服务器 /root/lingjing-git 目录下执行

set -e

VERSION=${1:-"1.42.8"}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/tmp/lingjing-deploy-${TIMESTAMP}.log"

log() {
  echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== 灵境 IDE Linux 构建与部署脚本 ==="
log "版本: $VERSION"
log "日志: $LOG_FILE"
log ""

# 1. 拉取最新代码
log "[1/6] 拉取最新代码..."
cd /root/lingjing-git
git pull origin main 2>&1 | tee -a "$LOG_FILE"

# 2. 安装依赖
log "[2/6] 安装依赖..."
pnpm install --no-frozen-lockfile 2>&1 | tee -a "$LOG_FILE"

# 3. 构建 core 包
log "[3/6] 构建 @codepilot/core..."
pnpm -C packages/core run build 2>&1 | tee -a "$LOG_FILE"

# 4. 构建 renderer
log "[4/6] 构建前端 (renderer)..."
pnpm -C packages/renderer run build 2>&1 | tee -a "$LOG_FILE"

# 5. 构建 Electron + Linux 安装包
log "[5/6] 构建 Electron + Linux 安装包..."
pnpm -C packages/electron run dist:linux 2>&1 | tee -a "$LOG_FILE"

# 6. 部署到生产
log "[6/6] 部署到 /var/www/downloads/..."
cp /root/lingjing-git/packages/electron/release-v1428/LingJing-${VERSION}-linux-x86_64.AppImage /var/www/downloads/
cp /root/lingjing-git/packages/electron/release-v1428/LingJing-${VERSION}-linux-x86_64.deb /var/www/downloads/
cp /root/lingjing-git/packages/electron/release-v1428/latest-linux.yml /var/www/downloads/
chmod 755 /var/www/downloads/LingJing-${VERSION}-linux-x86_64.AppImage

# 验证
log ""
log "=== 部署验证 ==="
ls -lh /var/www/downloads/LingJing-${VERSION}-linux-x86_64.AppImage
ls -lh /var/www/downloads/LingJing-${VERSION}-linux-x86_64.deb

log ""
log "=== ✅ 部署完成! 版本 ${VERSION} ==="
