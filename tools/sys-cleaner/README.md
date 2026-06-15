# sys-cleaner - 系统维护自动化脚本

跨平台系统维护工具，涵盖三大功能：错误排查、垃圾清理、残留检测。

## 目录结构

```
tools/sys-cleaner/
├── sys-cleaner.sh    # Linux Bash 版本
├── sys-cleaner.ps1   # Windows PowerShell 版本
├── sys-cleaner.bat   # Windows 批处理版本 (.bat)
└── README.md         # 本文件
```

---

## Linux 使用指南 (`sys-cleaner.sh`)

### 前置条件
- Bash 4.0+
- 建议以 **root** 运行以获得完整功能

### 命令选项

| 选项 | 说明 |
|------|------|
| `--scan` | 扫描系统错误日志 (journalctl + /var/log) |
| `--clean-junk` | 清理垃圾文件 (临时文件/缓存/回收站等) |
| `--clean-residuals` | 检测已卸载软件的残留文件 |
| `--all` | 执行全部三项操作 |
| `--dry-run` | 模拟运行，仅列出，不删除 |
| `--execute` | 确认执行删除操作 ⚠️ |
| `--verbose` | 详细输出 |
| `--help` | 显示帮助 |

### 使用示例

```bash
# 扫描错误日志
bash sys-cleaner.sh --scan

# 预览垃圾文件（不删除）
bash sys-cleaner.sh --clean-junk --dry-run

# 执行全部操作（需 root）
sudo bash sys-cleaner.sh --all --execute --verbose

# 仅检测残留文件
bash sys-cleaner.sh --clean-residuals
```

### 清理范围

| 类别 | 路径 |
|------|------|
| 系统临时文件 | `/tmp` (超过7天) |
| 用户缓存 | `~/.cache`, `~/.thumbnails`, `~/.local/share/Trash` |
| 包管理器 | APT/YUM/DNF/Pacman 缓存 |
| systemd journal | 保留最近7天 |
| 浏览器缓存 | Chrome, Chromium, Firefox, Edge |
| 核心转储 | `/var/crash` |

---

## Windows 使用指南 (`sys-cleaner.ps1`)

### 前置条件
- PowerShell 5.0+
- **建议以管理员身份运行** PowerShell

### 命令选项

| 选项 | 说明 |
|------|------|
| `-Scan` | 扫描 Windows 事件日志中的错误/警告 |
| `-CleanJunk` | 清理垃圾文件 |
| `-CleanResiduals` | 检测已卸载软件的残留 |
| `-All` | 执行全部三项操作 |
| `-DryRun` | 模拟运行，仅列出，不删除 |
| `-Execute` | 确认执行删除操作 ⚠️ |
| `-Verbose` | 详细输出 |
| `-Help` | 显示帮助 |

### 使用示例

```powershell
# 以管理员身份打开 PowerShell，然后：
powershell -ExecutionPolicy Bypass -File sys-cleaner.ps1 -Scan

# 预览垃圾文件
powershell -ExecutionPolicy Bypass -File sys-cleaner.ps1 -CleanJunk -DryRun

# 执行全部操作
powershell -ExecutionPolicy Bypass -File sys-cleaner.ps1 -All -Execute

# 详细模式
powershell -ExecutionPolicy Bypass -File sys-cleaner.ps1 -All -Execute -Verbose
```

---

## Windows 批处理使用指南 (`sys-cleaner.bat`)

### 命令选项

| 选项 | 说明 |
|------|------|
| `/SCAN` | 扫描 Windows 事件日志中的错误/警告 |
| `/CLEANJUNK` | 清理垃圾文件 |
| `/CLEANRESIDUALS` | 检测已卸载软件的残留 |
| `/ALL` | 执行全部三项操作 |
| `/DRYRUN` | 模拟运行，仅列出，不删除 |
| `/EXECUTE` | 确认执行删除操作 ⚠️ |
| `/VERBOSE` | 详细输出 |
| `/HELP` | 显示帮助 |

### 使用示例

```bat
:: 以管理员身份运行命令提示符，然后：
sys-cleaner.bat /SCAN
sys-cleaner.bat /CLEANJUNK /DRYRUN
sys-cleaner.bat /ALL /EXECUTE
```

### 清理范围

| 类别 | 路径 |
|------|------|
| 临时文件 | `%TEMP%`, `C:\Windows\Temp` |
| Windows Update | `SoftwareDistribution\Download` |
| 回收站 | 所有驱动器的 `$Recycle.Bin` |
| 缩略图缓存 | `thumbcache_*.db`, `iconcache_*.db` |
| 浏览器缓存 | Chrome, Edge, Firefox |
| DNS 缓存 | `ipconfig /flushdns` |
| 错误报告 | WER ReportArchive, ReportQueue |
| Prefetch | `*.pf` 预读取文件 |

---

## 安全策略

1. **默认安全** — 所有脚本默认仅报告，不会删除任何文件
2. **显式确认** — 必须使用 `--execute` / `-Execute` 才执行实际清理
3. **模拟运行** — 使用 `--dry-run` / `-DryRun` 预览将要清理的内容
4. **二次确认** — 执行模式下会要求用户再次确认
5. **白名单路径** — 仅清理预定义的安全路径，不会误删用户文档
6. **操作日志** — Linux 版本生成日志文件 `/tmp/sys-cleaner-*.log`

## 备份建议

在执行清理前，建议：

- **Linux**: 备份配置目录 `cp -r ~/.config ~/.config.bak.$(date +%Y%m%d)`
- **Windows**: 创建系统还原点 `Checkpoint-Computer -Description "sys-cleaner 清理前"`

---

## 许可证

MIT License - 作为灵境 IDE 工具集的一部分。
