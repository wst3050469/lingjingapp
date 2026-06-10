#!/bin/bash
# 灵境 IDE Launcher v1.47.3
# 检测运行环境（物理桌面 vs 远程桌面），自动优化参数

APP_BIN="/opt/灵境/lingjing"
LOG_FILE="$HOME/.lingjing/startup.log"

mkdir -p "$HOME/.lingjing"

# 滚动日志（超过 1MB 时备份）
if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null)" -gt 1048576 ]; then
    mv "$LOG_FILE" "$LOG_FILE.old" 2>/dev/null
fi

echo "[$(date)] ===== 灵境 v1.47.3 Starting =====" >> "$LOG_FILE"

# 检测是否为远程桌面 (xrdp/VNC) - 远程桌面 GPU 加速不可用
IS_REMOTE=0
if [ -n "$XRDP_SESSION" ] || [ -n "$VNCDESKTOP" ] || echo "$DISPLAY" | grep -q "^:1[0-9]"; then
    IS_REMOTE=1
fi

# 构建启动参数
ARGS=("--no-sandbox" "--force-device-scale-factor=1.25")

if [ "$IS_REMOTE" -eq 1 ]; then
    echo "[$(date)] 检测到远程桌面，禁用 GPU 加速" >> "$LOG_FILE"
    ARGS+=(--disable-gpu)
    # v1.72.10: REMOVED --disable-software-rasterizer — kills CPU fallback
    # rasterizer, leaving ZERO rendering paths available.
fi

exec "$APP_BIN" "${ARGS[@]}" "$@" 2>> "$LOG_FILE"
