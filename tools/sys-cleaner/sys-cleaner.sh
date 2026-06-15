#!/usr/bin/env bash
#===============================================================================
# sys-cleaner.sh - Linux 系统维护自动化脚本
# 功能：错误排查 / 垃圾清理 / 残留检测
# 用法：bash sys-cleaner.sh [OPTIONS]
#   --scan              扫描系统错误日志
#   --clean-junk        清理系统垃圾文件
#   --clean-residuals   检测已卸载软件的残留文件
#   --all               执行全部三项操作
#   --dry-run           模拟运行（仅列出，不删除）
#   --execute           确认执行删除操作
#   --verbose           详细输出模式
#   --help              显示帮助信息
#===============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

DRY_RUN=false; VERBOSE=false; EXECUTE=false
RUN_SCAN=false; RUN_CLEAN_JUNK=false; RUN_CLEAN_RESIDUALS=false
LOG_FILE="/tmp/sys-cleaner-$(date +%Y%m%d-%H%M%S).log"

log()     { echo -e "$1" | tee -a "$LOG_FILE"; }
info()    { log "${BLUE}[INFO]${NC} $1"; }
warn()    { log "${YELLOW}[WARN]${NC} $1"; }
error()   { log "${RED}[ERROR]${NC} $1"; }
success() { log "${GREEN}[OK]${NC} $1"; }
header()  { log "\n${BOLD}${CYAN}=== $1 ===${NC}"; }
verbose() { $VERBOSE && log "${CYAN}[VERBOSE]${NC} $1" || true; }

# 帮助信息
show_help() {
    cat << EOF
用法: bash $0 [OPTIONS]

系统维护自动化脚本，包含三大功能模块：

操作选项（至少指定一项）:
  --scan              扫描系统日志，汇总关键错误和警告
  --clean-junk        清理系统垃圾文件（临时文件/缓存/回收站等）
  --clean-residuals   检测已卸载软件的残留文件和目录
  --all               执行以上全部三项操作

控制选项:
  --dry-run           模拟运行模式：仅扫描和列出，不执行任何删除
  --execute           确认执行删除操作（默认仅报告不删除）
  --verbose           显示详细输出
  --help              显示此帮助信息

示例:
  bash $0 --scan                                    # 仅扫描错误日志
  bash $0 --clean-junk --dry-run                    # 预览垃圾文件，不删除
  bash $0 --all --execute                           # 执行全部操作
  sudo bash $0 --all --execute --verbose            # root 权限 + 详细输出

安全提示:
  - 默认不删除任何文件，必须显式指定 --execute 才会执行清理
  - 建议先用 --dry-run 预览将要清理的内容
  - 操作日志保存在: $LOG_FILE
  - 清理浏览器缓存后可能需要重新登录各网站
EOF
    exit 0
}

# 参数解析
parse_args() {
    for arg in "$@"; do
        case "$arg" in
            --scan)             RUN_SCAN=true ;;
            --clean-junk)       RUN_CLEAN_JUNK=true ;;
            --clean-residuals)  RUN_CLEAN_RESIDUALS=true ;;
            --all)              RUN_SCAN=true; RUN_CLEAN_JUNK=true; RUN_CLEAN_RESIDUALS=true ;;
            --dry-run)          DRY_RUN=true ;;
            --execute)          EXECUTE=true ;;
            --verbose)          VERBOSE=true ;;
            --help)             show_help ;;
            *)                  error "未知选项: $arg"; show_help ;;
        esac
    done
    if ! $RUN_SCAN && ! $RUN_CLEAN_JUNK && ! $RUN_CLEAN_RESIDUALS; then
        error "请至少指定一个操作选项。使用 --help 查看帮助。"
        exit 1
    fi
}

# ============================================================================
# 模块1：全面错误排查
# 扫描 journalctl 和 /var/log 中的关键错误和警告
# ============================================================================
scan_errors() {
    header "模块1：系统错误排查"
    local err_count=0 warn_count=0

    # --- journalctl 扫描（最近7天）---
    info "扫描 systemd journal（最近7天）..."
    if command -v journalctl &>/dev/null; then
        # 错误级别 (err, crit, alert, emerg)
        local journal_errs
        journal_errs=$(journalctl -p err..emerg --since "7 days ago" --no-pager 2>/dev/null | head -100 || true)
        if [[ -n "$journal_errs" ]]; then
            err_count=$(echo "$journal_errs" | grep -c '^' || echo 0)
            log "\n${RED}--- 严重错误 (最近7天, 前100条) ---${NC}"
            echo "$journal_errs" | tee -a "$LOG_FILE"
        else
            success "journalctl: 无严重错误记录"
        fi

        # 警告级别
        local journal_warns
        journal_warns=$(journalctl -p warning --since "7 days ago" --no-pager 2>/dev/null | grep -vE '(systemd|CRON|dbus)' | head -50 || true)
        if [[ -n "$journal_warns" ]]; then
            warn_count=$(echo "$journal_warns" | grep -c '^' || echo 0)
            log "\n${YELLOW}--- 警告 (最近7天, 过滤系统噪音, 前50条) ---${NC}"
            echo "$journal_warns" | tee -a "$LOG_FILE"
        fi
    else
        warn "journalctl 不可用，跳过"
    fi

    # --- /var/log 关键日志扫描 ---
    info "扫描 /var/log 关键日志..."
    local log_files=(
        "/var/log/syslog"
        "/var/log/messages"
        "/var/log/kern.log"
        "/var/log/auth.log"
        "/var/log/boot.log"
        "/var/log/dmesg"
        "/var/log/dpkg.log"
        "/var/log/apt/history.log"
        "/var/log/Xorg.0.log"
    )
    for lf in "${log_files[@]}"; do
        if [[ -f "$lf" ]]; then
            local err_lines
            # 搜索错误/失败关键词，排除常见误报
            err_lines=$(grep -iE '(error|fail|panic|critical|segfault|bug|corrupt)' "$lf" 2>/dev/null | tail -20 || true)
            if [[ -n "$err_lines" ]]; then
                log "\n${CYAN}--- $lf (最近20条异常) ---${NC}"
                echo "$err_lines" | tee -a "$LOG_FILE"
            else
                verbose "  $lf: 无异常"
            fi
        fi
    done

    # --- 磁盘健康检查 ---
    info "磁盘使用情况:"
    df -h / /home 2>/dev/null | tee -a "$LOG_FILE" || true

    # --- 内存状态 ---
    info "内存状态:"
    free -h 2>/dev/null | tee -a "$LOG_FILE" || true

    # --- 失败的服务 ---
    if command -v systemctl &>/dev/null; then
        info "检查失败的系统服务:"
        local failed_svcs
        failed_svcs=$(systemctl --failed --no-pager 2>/dev/null || true)
        if echo "$failed_svcs" | grep -q "0 loaded"; then
            success "无失败服务"
        else
            echo "$failed_svcs" | tee -a "$LOG_FILE"
        fi
    fi

    log "\n${BOLD}错误排查完成。完整日志: $LOG_FILE${NC}"
}

# ============================================================================
# 安全删除辅助函数
# ============================================================================
safe_rm() {
    local target="$1"; local desc="${2:-}"
    if [[ ! -e "$target" ]]; then verbose "跳过（不存在）: $target"; return 0; fi
    local size; size=$(du -sh "$target" 2>/dev/null | cut -f1 || echo "未知")
    if $DRY_RUN; then
        warn "[DRY-RUN] 将删除: $target ($size) $desc"
    elif $EXECUTE; then
        rm -rf "$target" 2>/dev/null && success "已删除: $target ($size) $desc" || warn "删除失败: $target"
    else
        info "待清理: $target ($size) $desc"
    fi
}

safe_rm_glob() {
    local pattern="$1"; local desc="${2:-}"
    local found=false
    for f in $pattern; do
        if [[ -e "$f" ]]; then
            found=true
            safe_rm "$f" "$desc"
        fi
    done
    $found || verbose "无匹配文件: $pattern"
}

# ============================================================================
# 模块2：垃圾文件清理
# 清理系统临时文件、缓存、回收站等（白名单安全路径）
# ============================================================================
clean_junk() {
    header "模块2：垃圾文件清理"
    if ! $DRY_RUN && ! $EXECUTE; then
        warn "默认仅列出待清理项。使用 --execute 执行删除，或 --dry-run 模拟运行。"
        echo ""
    fi

    # 1. 系统临时目录（/tmp 中超过7天的文件）
    info "1. 系统临时文件 (/tmp 中超过7天):"
    if [[ -d /tmp ]]; then
        local tmp_old; tmp_old=$(find /tmp -type f -atime +7 2>/dev/null | wc -l || echo 0)
        local tmp_size; tmp_size=$(du -sh /tmp 2>/dev/null | cut -f1 || echo "未知")
        if $EXECUTE; then
            find /tmp -type f -atime +7 -delete 2>/dev/null && \
                success "已清理 /tmp 中 $tmp_old 个超过7天的文件 ($tmp_size)"
        else
            info "  /tmp 总大小: $tmp_size, 超过7天文件数: ~$tmp_old 个"
        fi
    fi

    # 2. 用户缓存目录
    info "2. 用户缓存目录:"
    local cache_dirs=(
        "$HOME/.cache"                   # 通用用户缓存
        "$HOME/.thumbnails"              # 缩略图缓存
        "$HOME/.local/share/Trash"       # 用户回收站
    )
    for cd in "${cache_dirs[@]}"; do
        safe_rm "$cd" "用户缓存"
    done

    # 3. 包管理器缓存
    info "3. 包管理器缓存:"
    # APT (Debian/Ubuntu)
    if command -v apt-get &>/dev/null; then
        local apt_cache="/var/cache/apt/archives"
        safe_rm_glob "$apt_cache/*.deb" "APT 包缓存"
        # 已下载但不再需要的包
        if $EXECUTE; then apt-get autoclean -y 2>/dev/null && success "apt-get autoclean" || true; fi
    fi
    # YUM/DNF (RHEL/Fedora)
    if command -v dnf &>/dev/null; then
        if $EXECUTE; then dnf clean all 2>/dev/null && success "dnf clean all" || true; fi
    elif command -v yum &>/dev/null; then
        if $EXECUTE; then yum clean all 2>/dev/null && success "yum clean all" || true; fi
    fi
    # pacman (Arch)
    if command -v pacman &>/dev/null; then
        local pkg_cache="/var/cache/pacman/pkg"
        safe_rm_glob "$pkg_cache/*.pkg.tar.*" "Pacman 包缓存"
    fi

    # 4. systemd journal 日志（保留最近7天）
    if command -v journalctl &>/dev/null; then
        info "4. systemd journal 日志清理 (保留最近7天):"
        local j_size_before; j_size_before=$(journalctl --disk-usage 2>/dev/null | grep -oP '[0-9.]+[GM]' || echo "未知")
        if $EXECUTE; then
            journalctl --vacuum-time=7d 2>/dev/null && success "已清理 journal 日志" || true
        else
            info "  journal 当前大小: $j_size_before"
        fi
    fi

    # 5. 浏览器缓存（常见浏览器）
    info "5. 浏览器缓存:"
    local browser_caches=(
        "$HOME/.cache/google-chrome"
        "$HOME/.cache/chromium"
        "$HOME/.cache/mozilla/firefox"
        "$HOME/.cache/microsoft-edge"
        "$HOME/.mozilla/firefox"          # Firefox 旧缓存
        "$HOME/.config/google-chrome/Default/Cache"
        "$HOME/.config/chromium/Default/Cache"
        "$HOME/snap/firefox/common/.cache"
    )
    for bc in "${browser_caches[@]}"; do
        safe_rm "$bc" "浏览器缓存"
    done

    # 6. 缩略图缓存（系统级）
    safe_rm "/root/.thumbnails" "root 缩略图缓存"

    # 7. 核心转储文件
    info "6. 核心转储文件:"
    safe_rm_glob "/var/crash/*" "系统崩溃转储"
    safe_rm_glob "$HOME/.var/app/*/cache/*" "Flatpak 应用缓存"

    log "\n${BOLD}垃圾清理完成。${NC}"
}

# ============================================================================
# 模块3：残留文件检测
# 检测已卸载软件的残留目录和配置文件
# ============================================================================
clean_residuals() {
    header "模块3：残留文件检测"
    warn "残留检测为启发式分析，建议人工确认后再使用 --execute 删除。"
    echo ""

    # 收集当前已安装的软件包列表
    info "构建已安装软件索引..."
    local installed_pkgs=""
    if command -v dpkg &>/dev/null; then
        installed_pkgs=$(dpkg -l 2>/dev/null | grep '^ii' | awk '{print $2}' | tr '\n' '|')
    elif command -v rpm &>/dev/null; then
        installed_pkgs=$(rpm -qa 2>/dev/null | tr '\n' '|')
    elif command -v pacman &>/dev/null; then
        installed_pkgs=$(pacman -Qq 2>/dev/null | tr '\n' '|')
    fi
    installed_pkgs="${installed_pkgs%|}"  # 去掉末尾 |

    info "扫描常见残留位置..."

    # 扫描 /opt 下的孤立目录
    if [[ -d /opt ]]; then
        info "--- /opt 目录分析 ---"
        for d in /opt/*/; do
            local dirname; dirname=$(basename "$d")
            # 检查是否匹配任何已安装的包
            if [[ -n "$installed_pkgs" ]] && echo "$dirname" | grep -iqE "($installed_pkgs)"; then
                verbose "  已安装: /opt/$dirname"
            else
                local size; size=$(du -sh "$d" 2>/dev/null | cut -f1 || echo "未知")
                warn "  疑似残留: /opt/$dirname ($size)"
            fi
        done
    fi

    # 扫描用户 .config 目录
    info "--- ~/.config 残留配置 ---"
    if [[ -d "$HOME/.config" ]]; then
        for d in "$HOME/.config"/*/; do
            local dirname; dirname=$(basename "$d")
            if [[ -n "$installed_pkgs" ]] && echo "$dirname" | grep -iqE "($installed_pkgs)"; then
                verbose "  已安装: ~/.config/$dirname"
            else
                local size; size=$(du -sh "$d" 2>/dev/null | cut -f1 || echo "未知")
                warn "  疑似残留: ~/.config/$dirname ($size)"
            fi
        done
    fi

    # 扫描用户 .local/share 目录
    info "--- ~/.local/share 残留数据 ---"
    if [[ -d "$HOME/.local/share" ]]; then
        for d in "$HOME/.local/share"/*/; do
            local dirname; dirname=$(basename "$d")
            if [[ -n "$installed_pkgs" ]] && echo "$dirname" | grep -iqE "($installed_pkgs)"; then
                verbose "  已安装: ~/.local/share/$dirname"
            else
                if $VERBOSE; then
                    local size; size=$(du -sh "$d" 2>/dev/null | cut -f1 || echo "未知")
                    verbose "  待确认: ~/.local/share/$dirname ($size)"
                fi
            fi
        done
    fi

    # 扫描 /usr/local 下的孤立目录
    info "--- /usr/local 残留 ---"
    if [[ -d /usr/local ]]; then
        for d in /usr/local/*/; do
            local dirname; dirname=$(basename "$d")
            # 排除标准系统目录
            case "$dirname" in bin|etc|games|include|lib|man|sbin|share|src) continue ;; esac
            if [[ -n "$installed_pkgs" ]] && echo "$dirname" | grep -iqE "($installed_pkgs)"; then
                verbose "  已安装: /usr/local/$dirname"
            else
                local size; size=$(du -sh "$d" 2>/dev/null | cut -f1 || echo "未知")
                warn "  疑似残留: /usr/local/$dirname ($size)"
            fi
        done
    fi

    log "\n${YELLOW}提示: 以上为疑似残留列表。确认后可使用 --execute 配合手动路径删除。${NC}"
    log "${BOLD}残留检测完成。${NC}"
}

# ============================================================================
# 安全预检查
# ============================================================================
pre_check() {
    header "预检查"
    info "系统信息: $(uname -a 2>/dev/null || echo '未知')"
    info "当前用户: $(whoami)"
    info "用户ID: $EUID"
    info "日志文件: $LOG_FILE"
    info "操作模式: DRY_RUN=$DRY_RUN | EXECUTE=$EXECUTE | VERBOSE=$VERBOSE"

    if $EXECUTE && ! $DRY_RUN; then
        echo ""
        warn "=============================================="
        warn " 警告：您已启用 --execute 模式！"
        warn " 此模式将实际删除文件和目录。"
        warn "=============================================="
        echo ""
        read -r -p "确认执行清理操作？[y/N] " yn
        if [[ ! "$yn" =~ ^[Yy]$ ]]; then
            info "已取消操作。"
            exit 0
        fi
    fi

    # 备份建议
    if $EXECUTE; then
        info "建议: 在执行清理前备份重要数据。"
        info "  备份用户配置: cp -r ~/.config ~/.config.bak.\$(date +%Y%m%d)"
    fi
}

# ============================================================================
# 主流程
# ============================================================================
main() {
    parse_args "$@"
    check_root "$@"
    pre_check

    log "${BOLD}=============================================="
    log "  系统维护脚本 - $(date '+%Y-%m-%d %H:%M:%S')"
    log "  日志文件: $LOG_FILE"
    log "==============================================${NC}"

    $RUN_SCAN            && scan_errors
    $RUN_CLEAN_JUNK      && clean_junk
    $RUN_CLEAN_RESIDUALS && clean_residuals

    header "执行完毕"
    info "完整日志保存在: $LOG_FILE"
}

main "$@"


