#!/bin/bash
# scripts/docker-build.sh
# 统一的 Docker 化构建入口脚本

set -e

MODE=${1:-all}
COMPOSE_CMD="docker-compose run --rm"

case $MODE in
  android)
    echo ">>> [Docker] 启动 Android 构建容器..."
    $COMPOSE_CMD android-build
    ;;
  linux)
    echo ">>> [Docker] 启动 Electron Linux 构建容器..."
    $COMPOSE_CMD electron-build
    ;;
  win)
    echo ">>> [Docker] 启动 Electron Windows 构建容器..."
    $COMPOSE_CMD electron-win-build
    ;;
  all)
    echo ">>> [Docker] 启动全平台构建..."
    $COMPOSE_CMD android-build
    $COMPOSE_CMD electron-build
    $COMPOSE_CMD electron-win-build
    ;;
  *)
    echo "Usage: $0 {android|linux|win|all}"
    exit 1
    ;;
esac

echo "=== Docker 构建完成 ==="
