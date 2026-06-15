#===============================================================================
# sys-cleaner.ps1 - Windows 系统维护自动化脚本
# 功能：错误排查 / 垃圾清理 / 残留检测
# 用法：powershell -ExecutionPolicy Bypass -File sys-cleaner.ps1 [OPTIONS]
#===============================================================================
param(
    [switch]$Scan,
    [switch]$CleanJunk,
    [switch]$CleanResiduals,
    [switch]$All,
    [switch]$DryRun,
    [switch]$Execute,
    [switch]$Verbose,
    [switch]$Help
)

# === 颜色输出函数 ===
function Write-Color { param([string]$Color, [string]$Message); Write-Host $Message -ForegroundColor $Color }
function Write-Info    { Write-Color Cyan    "[INFO] $args" }
function Write-Warn    { Write-Color Yellow  "[WARN] $args" }
function Write-Err     { Write-Color Red     "[ERROR] $args" }
function Write-Success { Write-Color Green   "[OK] $args" }
function Write-Hdr     { Write-Host "`n=== $args ===" -ForegroundColor Magenta }
function Write-Verb    { if ($Verbose) { Write-Color DarkCyan "[VERBOSE] $args" } }

# === 帮助信息 ===
function Show-Help {
    Write-Host "用法: powershell -ExecutionPolicy Bypass -File sys-cleaner.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "系统维护自动化脚本，包含三大功能模块："
    Write-Host ""
    Write-Host "操作选项:"
    Write-Host "  -Scan              扫描系统事件日志中的错误和警告"
    Write-Host "  -CleanJunk         清理系统垃圾文件（临时文件/缓存/回收站等）"
    Write-Host "  -CleanResiduals    检测已卸载软件的残留文件和注册表项"
    Write-Host "  -All               执行以上全部三项操作"
    Write-Host ""
    Write-Host "控制选项:"
    Write-Host "  -DryRun            模拟运行模式：仅扫描和列出，不执行任何删除"
    Write-Host "  -Execute           确认执行删除操作（默认仅报告不删除）"
    Write-Host "  -Verbose           显示详细输出"
    Write-Host "  -Help              显示此帮助信息"
    Write-Host ""
    Write-Host "安全提示:"
    Write-Host "  - 默认不删除任何文件，必须显式指定 -Execute 才会执行清理"
    Write-Host "  - 建议先用 -DryRun 预览将要清理的内容"
    Write-Host "  - 清理浏览器缓存后可能需要重新登录各网站"
    Write-Host "  - 建议以管理员身份运行以获得完整功能"
    exit 0
}

# === 参数验证 ===
if ($Help) { Show-Help }
if ($All) { $Scan = $true; $CleanJunk = $true; $CleanResiduals = $true }
if (-not ($Scan -or $CleanJunk -or $CleanResiduals)) {
    Write-Err "请至少指定一个操作选项。使用 -Help 查看帮助。"
    exit 1
}

# === 管理员权限检查 ===
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Warn "当前非管理员身份运行，部分操作可能受限。"
    Write-Warn "建议：右键 PowerShell → 以管理员身份运行 后重新执行此脚本。"
    $continue = Read-Host "是否以非管理员身份继续？[y/N]"
    if ($continue -notmatch "[Yy]") { exit 0 }
}

# === 安全删除函数 ===
function Safe-Remove {
    param([string]$Path, [string]$Description = "")
    if (-not (Test-Path $Path)) { Write-Verb "跳过（不存在）: $Path"; return }
    try {
        $item = Get-Item $Path -Force -ErrorAction Stop
        $sizeBytes = (Get-ChildItem $Path -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $sizeStr = "未知"
        if ($sizeBytes -gt 1GB) { $sizeStr = "{0:N1} GB" -f ($sizeBytes/1GB) }
        elseif ($sizeBytes -gt 1MB) { $sizeStr = "{0:N1} MB" -f ($sizeBytes/1MB) }
        elseif ($sizeBytes -gt 1KB) { $sizeStr = "{0:N1} KB" -f ($sizeBytes/1KB) }
        elseif ($sizeBytes -gt 0) { $sizeStr = "$sizeBytes B" }
    } catch { $sizeStr = "未知" }

    if ($DryRun) {
        Write-Warn "[DRY-RUN] 将删除: $Path ($sizeStr) $Description"
    } elseif ($Execute) {
        try {
            Remove-Item $Path -Recurse -Force -ErrorAction Stop
            Write-Success "已删除: $Path ($sizeStr) $Description"
        } catch {
            Write-Warn "删除失败: $Path - $($_.Exception.Message)"
        }
    } else {
        Write-Info "待清理: $Path ($sizeStr) $Description"
    }
}

function Clear-DirContents {
    param([string]$Path, [string]$Description = "")
    if (-not (Test-Path $Path)) { Write-Verb "跳过（不存在）: $Path"; return }
    $itemCount = (Get-ChildItem $Path -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object).Count
    if ($DryRun) {
        Write-Warn "[DRY-RUN] 将清理目录内容 ($itemCount 项): $Path $Description"
    } elseif ($Execute) {
        try {
            Get-ChildItem $Path -Recurse -Force -ErrorAction Stop | Remove-Item -Force -ErrorAction SilentlyContinue
            Write-Success "已清理 ($itemCount 项): $Path $Description"
        } catch {
            Write-Warn "清理失败: $Path - $($_.Exception.Message)"
        }
    } else {
        Write-Info "待清理 ($itemCount 项): $Path $Description"
    }
}

# ============================================================================
# 模块1：全面错误排查
# ============================================================================
function Invoke-ScanErrors {
    Write-Hdr "模块1：系统错误排查"

    Write-Info "扫描应用程序事件日志（最近7天，错误/警告）..."
    try {
        $appFilter = "*[System[(Level=1 or Level=2) and TimeCreated[timediff(@SystemTime) <= 604800000]]]"
        $appErrors = Get-WinEvent -LogName Application -MaxEvents 50 -FilterXPath $appFilter -ErrorAction SilentlyContinue
        if ($appErrors) {
            Write-Host "`n--- 应用程序日志（错误/警告，前50条）---" -ForegroundColor Red
            $appErrors | Format-Table TimeCreated, Id, LevelDisplayName, ProviderName -AutoSize
            if ($Verbose) { $appErrors | Format-List }
        } else { Write-Success "应用程序日志: 无错误/警告" }
    } catch { Write-Warn "无法读取应用程序日志: $($_.Exception.Message)" }

    Write-Info "扫描系统事件日志（最近7天）..."
    try {
        $sysFilter = "*[System[(Level=1 or Level=2) and TimeCreated[timediff(@SystemTime) <= 604800000]]]"
        $sysErrors = Get-WinEvent -LogName System -MaxEvents 50 -FilterXPath $sysFilter -ErrorAction SilentlyContinue
        if ($sysErrors) {
            Write-Host "`n--- 系统日志（错误/警告，前50条）---" -ForegroundColor Red
            $sysErrors | Format-Table TimeCreated, Id, LevelDisplayName, ProviderName -AutoSize
            if ($Verbose) { $sysErrors | Format-List }
        } else { Write-Success "系统日志: 无错误/警告" }
    } catch { Write-Warn "无法读取系统日志: $($_.Exception.Message)" }

    Write-Info "磁盘使用情况:"
    Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -gt 0 } | 
        Format-Table Name, @{N='Used(GB)';E={[math]::Round($_.Used/1GB,1)}},
                       @{N='Free(GB)';E={[math]::Round($_.Free/1GB,1)}},
                       @{N='Total(GB)';E={[math]::Round(($_.Used+$_.Free)/1GB,1)}} -AutoSize

    Write-Info "检查已停止的自动启动服务:"
    $stoppedSvcs = Get-Service | Where-Object { $_.StartType -eq 'Automatic' -and $_.Status -ne 'Running' }
    if ($stoppedSvcs) { $stoppedSvcs | Format-Table Name, DisplayName, Status -AutoSize }
    else { Write-Success "所有自动启动服务运行正常" }

    Write-Host "`n错误排查完成。" -ForegroundColor Green
}

# ============================================================================
# 模块2：垃圾文件清理
# ============================================================================
function Invoke-CleanJunk {
    Write-Hdr "模块2：垃圾文件清理"
    if (-not $DryRun -and -not $Execute) {
        Write-Warn "默认仅列出待清理项。使用 -Execute 执行删除，或 -DryRun 模拟运行。"
        Write-Host ""
    }

    Write-Info "1. 用户临时文件:"
    $userTemp = [System.IO.Path]::GetTempPath()
    Clear-DirContents $userTemp "用户 Temp"

    Write-Info "2. 系统临时文件:"
    Clear-DirContents "$env:SystemRoot\Temp" "系统 Temp"

    Write-Info "3. Windows Update 缓存:"
    Clear-DirContents "$env:SystemRoot\SoftwareDistribution\Download" "Windows Update 缓存"

    Write-Info "4. 回收站:"
    foreach ($drive in (Get-PSDrive -PSProvider FileSystem)) {
        $rb = "$($drive.Root)`$Recycle.Bin"
        if (Test-Path $rb) { Clear-DirContents $rb "回收站 ($($drive.Name):)" }
    }

    Write-Info "5. 缩略图与图标缓存:"
    $explorerDir = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
    if (Test-Path $explorerDir) {
        Get-ChildItem $explorerDir -Filter "thumbcache_*.db" -ErrorAction SilentlyContinue | ForEach-Object {
            Safe-Remove $_.FullName "缩略图缓存"
        }
        Get-ChildItem $explorerDir -Filter "iconcache_*.db" -ErrorAction SilentlyContinue | ForEach-Object {
            Safe-Remove $_.FullName "图标缓存"
        }
    }

    Write-Info "6. 浏览器缓存:"
    $browserPaths = @(
        "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache",
        "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Code Cache",
        "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache",
        "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Code Cache"
    )
    foreach ($bp in $browserPaths) { Clear-DirContents $bp "浏览器缓存" }

    # Firefox special handling
    $ffProfiles = "$env:APPDATA\Mozilla\Firefox\Profiles"
    if (Test-Path $ffProfiles) {
        Get-ChildItem $ffProfiles -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $cachePath = Join-Path $_.FullName "cache2"
            if (Test-Path $cachePath) { Clear-DirContents $cachePath "Firefox 缓存 ($($_.Name))" }
        }
    }

    Write-Info "7. DNS 缓存:"
    if ($DryRun) { Write-Warn "[DRY-RUN] 将清除 DNS 缓存" }
    elseif ($Execute) {
        try { ipconfig /flushdns | Out-Null; Write-Success "已清除 DNS 缓存" }
        catch { Write-Warn "DNS 缓存清除失败" }
    }
    else { Write-Info "待清除: DNS 缓存 (ipconfig /flushdns)" }

    Write-Info "8. Windows 错误报告:"
    Clear-DirContents "$env:ProgramData\Microsoft\Windows\WER\ReportArchive" "WER 存档"
    Clear-DirContents "$env:ProgramData\Microsoft\Windows\WER\ReportQueue" "WER 队列"

    Write-Info "9. Prefetch 文件:"
    $prefetchDir = "$env:SystemRoot\Prefetch"
    if (Test-Path $prefetchDir) {
        $pfFiles = Get-ChildItem $prefetchDir -Filter "*.pf" -ErrorAction SilentlyContinue
        $pfCount = ($pfFiles | Measure-Object).Count
        if ($DryRun) { Write-Warn "[DRY-RUN] 将删除 $pfCount 个 .pf 文件" }
        elseif ($Execute) {
            $pfFiles | Remove-Item -Force
            Write-Success "已清理 $pfCount 个 Prefetch 文件"
        }
        else { Write-Info "待清理: $pfCount 个 .pf 预读取文件" }
    }

    Write-Host "`n垃圾清理完成。" -ForegroundColor Green
}

# ============================================================================
# 模块3：残留文件检测
# ============================================================================
function Invoke-CleanResiduals {
    Write-Hdr "模块3：残留文件检测"
    Write-Warn "残留检测为启发式分析，建议人工确认后再使用 -Execute 删除。"
    Write-Host ""

    # 收集已安装软件列表
    Write-Info "构建已安装软件索引..."
    $installedApps = @{}
    try {
        $regRoots = @(
            "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
            "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
            "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall"
        )
        foreach ($root in $regRoots) {
            Get-ChildItem $root -ErrorAction SilentlyContinue | ForEach-Object {
                $props = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
                if ($props.DisplayName) {
                    $cleanName = $props.DisplayName -replace '[\\/:*?<>|]', '_'
                    $installedApps[$cleanName] = $true
                }
            }
        }
        Write-Info "已索引 $($installedApps.Count) 个已安装软件"
    } catch {
        Write-Err "无法读取注册表: $($_.Exception.Message)"
    }

    # 扫描 Program Files
    Write-Info "--- Program Files 残留目录 ---"
    $pfPaths = @($env:ProgramFiles)
    if (${env:ProgramFiles(x86)}) { $pfPaths += ${env:ProgramFiles(x86)} }
    $pfPaths += $env:ProgramData
    
    foreach ($pf in $pfPaths) {
        if (-not (Test-Path $pf)) { continue }
        Get-ChildItem $pf -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $dirName = $_.Name
            $isInstalled = $false
            foreach ($appName in $installedApps.Keys) {
                if ($appName -like "*$dirName*" -or $dirName -like "*$appName*") {
                    $isInstalled = $true; break
                }
            }
            if (-not $isInstalled) {
                $sizeMB = try {
                    [math]::Round((Get-ChildItem $_.FullName -Recurse -Force -ErrorAction SilentlyContinue | 
                        Measure-Object -Property Length -Sum).Sum / 1MB, 1)
                } catch { 0 }
                Write-Warn "  疑似残留: $($_.FullName) (~$sizeMB`MB)"
            } else { Write-Verb "  已安装: $($_.FullName)" }
        }
    }

    # 扫描 AppData
    Write-Info "--- AppData 残留配置 ---"
    $adPaths = @($env:LOCALAPPDATA, $env:APPDATA)
    $sysDirs = @("Microsoft", "Windows", "Packages", "Temp", "Adobe", "Intel")
    foreach ($ad in $adPaths) {
        if (-not (Test-Path $ad)) { continue }
        Get-ChildItem $ad -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $dirName = $_.Name
            if ($sysDirs -contains $dirName) { return }
            $isInstalled = $false
            foreach ($appName in $installedApps.Keys) {
                if ($appName -like "*$dirName*" -or $dirName -like "*$appName*") {
                    $isInstalled = $true; break
                }
            }
            if (-not $isInstalled) {
                $sizeMB = try {
                    [math]::Round((Get-ChildItem $_.FullName -Recurse -Force -ErrorAction SilentlyContinue | 
                        Measure-Object -Property Length -Sum).Sum / 1MB, 1)
                } catch { 0 }
                if ($sizeMB -gt 1) {
                    Write-Warn "  疑似残留: $($_.FullName) (~$sizeMB`MB)"
                }
            }
        }
    }

    Write-Info "--- 注册表残留检查（仅报告） ---"
    Write-Info "建议使用 cleanmgr.exe 或手动检查: HKCU\Software, HKLM\Software"

    Write-Host "`n残留检测完成。" -ForegroundColor Green
    Write-Warn "以上为疑似残留列表，请人工确认后再删除。"
}

# ============================================================================
# 预检查
# ============================================================================
function Invoke-PreCheck {
    Write-Hdr "预检查"
    Write-Info "计算机名: $env:COMPUTERNAME"
    Write-Info "操作系统: $((Get-CimInstance Win32_OperatingSystem).Caption)"
    Write-Info "当前用户: $env:USERDOMAIN\$env:USERNAME"
    Write-Info "管理员: $isAdmin"
    Write-Info "操作模式: DryRun=$DryRun | Execute=$Execute | Verbose=$Verbose"

    if ($Execute -and -not $DryRun) {
        Write-Host ""
        Write-Warn "=============================================="
        Write-Warn " 警告：您已启用 -Execute 模式！"
        Write-Warn " 此模式将实际删除文件和目录。"
        Write-Warn "=============================================="
        Write-Host ""
        $confirm = Read-Host "确认执行清理操作？[y/N]"
        if ($confirm -notmatch "[Yy]") {
            Write-Info "已取消操作。"
            exit 0
        }
    }

    if ($Execute) {
        Write-Info "备份建议: 在执行清理前备份重要数据。"
        Write-Info "  可创建系统还原点: Checkpoint-Computer -Description pre-cleaner -RestorePointType MODIFY_SETTINGS"
    }
}

# ============================================================================
# 主流程
# ============================================================================
$now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "=============================================="  -ForegroundColor Green
Write-Host "  系统维护脚本 - $now" -ForegroundColor Green
Write-Host "=============================================="  -ForegroundColor Green

Invoke-PreCheck

if ($Scan)            { Invoke-ScanErrors }
if ($CleanJunk)       { Invoke-CleanJunk }
if ($CleanResiduals)  { Invoke-CleanResiduals }

Write-Hdr "执行完毕"
Write-Info "如需管理员权限的完整功能，请以管理员身份重新运行此脚本。"

