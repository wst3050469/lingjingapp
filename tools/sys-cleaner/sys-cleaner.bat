@echo off
REM ===============================================================================
REM sys-cleaner.bat - Windows 系统维护自动化脚本 (批处理版本)
REM 功能：错误排查 / 垃圾清理 / 残留检测
REM 用法：sys-cleaner.bat [/SCAN] [/CLEANJUNK] [/CLEANRESIDUALS] [/ALL]
REM              [/DRYRUN] [/EXECUTE] [/VERBOSE] [/HELP]
REM
REM 管理员权限：右键 → 以管理员身份运行，或从管理员命令提示符执行
REM ===============================================================================
setlocal enabledelayedexpansion

REM === 初始化标志 ===
SET SCAN=0
SET CLEANJUNK=0
SET CLEANRESIDUALS=0
SET DRYRUN=0
SET EXECUTE=0
SET VERBOSE=0

REM === 解析参数 ===
:parse_args
IF "%1"=="" GOTO check_args
IF /I "%1"=="/SCAN"           SET SCAN=1
IF /I "%1"=="/CLEANJUNK"      SET CLEANJUNK=1
IF /I "%1"=="/CLEANRESIDUALS" SET CLEANRESIDUALS=1
IF /I "%1"=="/ALL"            SET SCAN=1 & SET CLEANJUNK=1 & SET CLEANRESIDUALS=1
IF /I "%1"=="/DRYRUN"         SET DRYRUN=1
IF /I "%1"=="/EXECUTE"        SET EXECUTE=1
IF /I "%1"=="/VERBOSE"        SET VERBOSE=1
IF /I "%1"=="/HELP"           GOTO show_help
SHIFT
GOTO parse_args

:check_args
REM 检查是否至少指定了一个操作
SET /A TOTAL=%SCAN%+%CLEANJUNK%+%CLEANRESIDUALS%
IF %TOTAL%==0 (
    ECHO [ERROR] 请至少指定一个操作选项。使用 /HELP 查看帮助。
    EXIT /B 1
)

REM === 管理员权限检查 ===
NET SESSION >NUL 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO [WARN] 当前非管理员身份运行，部分操作可能受限。
    ECHO [WARN] 建议：右键此脚本 → 以管理员身份运行。
    SET /P CONTINUE="是否以非管理员身份继续？[y/N]: "
    IF /I NOT "!CONTINUE!"=="Y" EXIT /B 0

REM ===============================================================================
REM 模块1：全面错误排查 - 扫描 Windows 事件日志
REM ===============================================================================
:scan_errors
ECHO.
ECHO === 模块1：系统错误排查 ===

REM --- 应用程序日志（最近7天，错误+警告）---
ECHO [INFO] 扫描应用程序事件日志（最近7天，错误/警告）...
REM 使用 wevtutil 查询应用程序日志中的错误(1)和警告(2)
wevtutil qe Application /c:50 /rd:true /f:text /q:"*[System[(Level=1 or Level=2) and TimeCreated[timediff(@SystemTime) <= 604800000]]]" 2>NUL
IF %ERRORLEVEL% NEQ 0 ECHO [WARN] 无法读取应用程序日志（可能需要管理员权限）

REM --- 系统日志 ---
ECHO [INFO] 扫描系统事件日志（最近7天）...
wevtutil qe System /c:50 /rd:true /f:text /q:"*[System[(Level=1 or Level=2) and TimeCreated[timediff(@SystemTime) <= 604800000]]]" 2>NUL
IF %ERRORLEVEL% NEQ 0 ECHO [WARN] 无法读取系统日志（可能需要管理员权限）

REM --- 磁盘使用情况 ---
ECHO [INFO] 磁盘使用情况:
wmic logicaldisk get size,freespace,caption 2>NUL

REM --- 最近系统错误报告 ---
ECHO [INFO] 检查最近的系统错误:
IF EXIST "%ProgramData%\Microsoft\Windows\WER\ReportArchive\" (
    DIR /O-D "%ProgramData%\Microsoft\Windows\WER\ReportArchive\*.wer" 2>NUL | findstr /C:".wer" >NUL
    IF !ERRORLEVEL!==0 (
        ECHO [WARN] 发现 Windows 错误报告文件，详细路径：%ProgramData%\Microsoft\Windows\WER\ReportArchive\
    ) ELSE (
        ECHO [OK] 无最近的错误报告
    )
)

ECHO [OK] 错误排查完成。
EXIT /B 0

REM ===============================================================================
REM 模块2：垃圾文件清理
REM ===============================================================================
:clean_junk
ECHO.
ECHO === 模块2：垃圾文件清理 ===
IF %DRYRUN%==0 IF %EXECUTE%==0 (
    ECHO [WARN] 默认仅列出待清理项。使用 /EXECUTE 执行删除，或 /DRYRUN 模拟运行。
)

REM --- 1. 用户临时文件 ---
ECHO [INFO] 1. 用户临时文件:
IF EXIST "%TEMP%" (
    IF %DRYRUN%==1 (
        DIR /A-D /S "%TEMP%" 2>NUL | findstr /C:"File(s)" 
        ECHO [DRY-RUN] 将清理: %TEMP%
    ) ELSE IF %EXECUTE%==1 (
        DEL /F /S /Q "%TEMP%\*" 2>NUL
        ECHO [OK] 已清理: %TEMP%
    ) ELSE (
        DIR /A-D /S "%TEMP%" 2>NUL | findstr /C:"File(s)" 
        ECHO [INFO] 待清理: %TEMP%
    )
)

REM --- 2. 系统临时文件 ---
ECHO [INFO] 2. 系统临时文件:
SET SYSTEMP=%SystemRoot%\Temp
IF EXIST "%SYSTEMP%" (
    IF %DRYRUN%==1 (
        ECHO [DRY-RUN] 将清理: %SYSTEMP%
    ) ELSE IF %EXECUTE%==1 (
        DEL /F /S /Q "%SYSTEMP%\*" 2>NUL
        ECHO [OK] 已清理: %SYSTEMP%
    ) ELSE (
        ECHO [INFO] 待清理: %SYSTEMP%
    )
)

REM --- 3. 回收站 ---
ECHO [INFO] 3. 回收站:
REM 回收站位于每个驱动器的 $Recycle.Bin 隐藏目录
FOR %%D IN (C D E F G H) DO (
    IF EXIST "%%D:\$Recycle.Bin" (
        IF %DRYRUN%==1 (
            ECHO [DRY-RUN] 将清空回收站: %%D:
        ) ELSE IF %EXECUTE%==1 (
            RD /S /Q "%%D:\$Recycle.Bin" 2>NUL
            ECHO [OK] 已清空回收站: %%D:
        ) ELSE (
            ECHO [INFO] 待清空回收站: %%D:
        )
    )
)

REM --- 4. Windows Update 缓存 ---
ECHO [INFO] 4. Windows Update 缓存:
SET WUDIR=%SystemRoot%\SoftwareDistribution\Download
IF EXIST "%WUDIR%" (
    IF %DRYRUN%==1 (
        ECHO [DRY-RUN] 将清理: %WUDIR%
    ) ELSE IF %EXECUTE%==1 (
        DEL /F /S /Q "%WUDIR%\*" 2>NUL
        ECHO [OK] 已清理: Windows Update 缓存
    ) ELSE (
        ECHO [INFO] 待清理: %WUDIR%
    )
)

REM --- 5. 浏览器缓存 ---
ECHO [INFO] 5. 浏览器缓存:
REM Chrome 缓存
SET CHROMECACHE=%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache
IF EXIST "!CHROMECACHE!" (
    IF %EXECUTE%==1 (DEL /F /S /Q "!CHROMECACHE!\*" 2>NUL & ECHO [OK] Chrome) ELSE ECHO [INFO] 待清理: Chrome 缓存
)
REM Edge 缓存
SET EDGECACHE=%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cache
IF EXIST "!EDGECACHE!" (
    IF %EXECUTE%==1 (DEL /F /S /Q "!EDGECACHE!\*" 2>NUL & ECHO [OK] Edge) ELSE ECHO [INFO] 待清理: Edge 缓存
)

REM --- 6. 缩略图缓存 ---
ECHO [INFO] 6. 缩略图缓存:
SET THUMBDIR=%LOCALAPPDATA%\Microsoft\Windows\Explorer
IF EXIST "%THUMBDIR%\thumbcache_*.db" (
    IF %DRYRUN%==1 (
        ECHO [DRY-RUN] 将清理缩略图缓存
    ) ELSE IF %EXECUTE%==1 (
        DEL /F /Q "%THUMBDIR%\thumbcache_*.db" 2>NUL
        DEL /F /Q "%THUMBDIR%\iconcache_*.db" 2>NUL
        ECHO [OK] 已清理缩略图缓存
    ) ELSE (
        ECHO [INFO] 待清理缩略图缓存
    )
)

REM --- 7. DNS 缓存 ---
ECHO [INFO] 7. DNS 缓存:
IF %DRYRUN%==1 (
    ECHO [DRY-RUN] 将清除 DNS 缓存
) ELSE IF %EXECUTE%==1 (
    ipconfig /flushdns >NUL 2>&1
    ECHO [OK] 已清除 DNS 缓存
) ELSE (
    ECHO [INFO] 待清除: DNS 缓存
)

REM --- 8. Windows 错误报告 ---
ECHO [INFO] 8. Windows 错误报告存档:
SET WERDIR=%ProgramData%\Microsoft\Windows\WER
IF EXIST "%WERDIR%\ReportArchive" (
    IF %EXECUTE%==1 (
        DEL /F /S /Q "%WERDIR%\ReportArchive\*" 2>NUL
        ECHO [OK] 已清理 WER 存档
    ) ELSE (
        ECHO [INFO] 待清理: %WERDIR%\ReportArchive
    )
)

REM --- 9. Prefetch ---
ECHO [INFO] 9. Prefetch 文件:
SET PFDIR=%SystemRoot%\Prefetch
IF EXIST "%PFDIR%\*.pf" (
    IF %DRYRUN%==1 (
        DIR "%PFDIR%\*.pf" 2>NUL | findstr /C:".pf" 
        ECHO [DRY-RUN] 将清理 Prefetch 文件
    ) ELSE IF %EXECUTE%==1 (
        DEL /F /Q "%PFDIR%\*.pf" 2>NUL
        ECHO [OK] 已清理 Prefetch 文件
    ) ELSE (
        DIR "%PFDIR%\*.pf" 2>NUL | findstr /C:"File(s)"
        ECHO [INFO] 待清理 Prefetch 文件
    )
)

ECHO [OK] 垃圾清理完成。
EXIT /B 0

REM ===============================================================================
REM 模块3：残留文件检测
REM ===============================================================================
:clean_residuals
ECHO.
ECHO === 模块3：残留文件检测 ===
ECHO [WARN] 残留检测为启发式分析，建议人工确认后再删除。

REM --- 收集已安装软件列表 ---
ECHO [INFO] 构建已安装软件索引...
REM 从注册表获取已安装软件列表（64位）
SET "INSTALLED="
FOR /F "tokens=*" %%A IN ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s /v DisplayName 2^>NUL ^| findstr "DisplayName"') DO (
    SET "INSTALLED=!INSTALLED!%%A "
)
REM 从注册表获取（32位）
FOR /F "tokens=*" %%A IN ('reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall" /s /v DisplayName 2^>NUL ^| findstr "DisplayName"') DO (
    SET "INSTALLED=!INSTALLED!%%A "
)
ECHO [INFO] 已索引已安装软件

REM --- 扫描 Program Files ---
ECHO [INFO] --- Program Files 残留目录 ---
REM 列出 Program Files 中的目录
IF EXIST "%ProgramFiles%" (
    FOR /D %%D IN ("%ProgramFiles%\*") DO (
        ECHO   %%~nxD
    )
)
REM 列出 Program Files (x86)
IF EXIST "%ProgramFiles(x86)%" (
    FOR /D %%D IN ("%ProgramFiles(x86)%\*") DO (
        ECHO   %%~nxD
    )
)

REM --- 扫描 AppData ---
ECHO [INFO] --- AppData 残留配置 ---
ECHO [INFO] 检查 %LOCALAPPDATA% 和 %APPDATA% 中的孤立目录...
ECHO [INFO] （仅显示非 Microsoft/Windows/Adobe 目录）
IF EXIST "%LOCALAPPDATA%" (
    FOR /D %%D IN ("%LOCALAPPDATA%\*") DO (
        SET DIRNAME=%%~nxD
        IF /I NOT "!DIRNAME!"=="Microsoft" IF /I NOT "!DIRNAME!"=="Windows" IF /I NOT "!DIRNAME!"=="Temp" IF /I NOT "!DIRNAME!"=="Packages" (
            ECHO   %%~nxD
        )
    )
)

ECHO [WARN] 以上为疑似残留列表，请人工确认后再删除。
ECHO [OK] 残留检测完成。
EXIT /B 0
)

REM === 预检查 ===
ECHO ==============================================
ECHO   系统维护脚本 - %DATE% %TIME%
ECHO ==============================================
ECHO [INFO] 计算机名: %COMPUTERNAME%
ECHO [INFO] 当前用户: %USERDOMAIN%\%USERNAME%
ECHO [INFO] 操作模式: DRYRUN=%DRYRUN% EXECUTE=%EXECUTE%

IF %EXECUTE%==1 IF %DRYRUN%==0 (
    ECHO.
    ECHO [WARN] ==============================================
    ECHO [WARN]  警告：您已启用 /EXECUTE 模式！
    ECHO [WARN]  此模式将实际删除文件和目录。
    ECHO [WARN] ==============================================
    ECHO.
    SET /P CONFIRM="确认执行清理操作？[y/N]: "
    IF /I NOT "!CONFIRM!"=="Y" (
        ECHO [INFO] 已取消操作。
        EXIT /B 0
    )
)

REM === 执行各模块 ===
IF %SCAN%==1            CALL :scan_errors
IF %CLEANJUNK%==1       CALL :clean_junk
IF %CLEANRESIDUALS%==1  CALL :clean_residuals

ECHO.
ECHO === 执行完毕 ===
ECHO [INFO] 如需管理员权限的完整功能，请以管理员身份重新运行。
EXIT /B 0

REM ===============================================================================
REM 帮助信息
REM ===============================================================================
:show_help
ECHO 用法: sys-cleaner.bat [OPTIONS]
ECHO.
ECHO 系统维护自动化脚本，包含三大功能模块：
ECHO.
ECHO 操作选项（至少指定一项）:
ECHO   /SCAN              扫描系统事件日志中的错误和警告
ECHO   /CLEANJUNK         清理系统垃圾文件
ECHO   /CLEANRESIDUALS    检测已卸载软件的残留文件
ECHO   /ALL               执行以上全部三项操作
ECHO.
ECHO 控制选项:
ECHO   /DRYRUN            模拟运行模式：仅扫描和列出，不删除
ECHO   /EXECUTE           确认执行删除操作（默认仅报告）
ECHO   /VERBOSE           显示详细输出
ECHO   /HELP              显示此帮助信息
ECHO.
ECHO 示例:
ECHO   sys-cleaner.bat /SCAN
ECHO   sys-cleaner.bat /CLEANJUNK /DRYRUN
ECHO   sys-cleaner.bat /ALL /EXECUTE /VERBOSE
ECHO.
ECHO 安全提示:
ECHO   - 默认不删除任何文件，必须显式指定 /EXECUTE 才会执行清理
ECHO   - 建议先用 /DRYRUN 预览将要清理的内容
ECHO   - 清理浏览器缓存后可能需要重新登录各网站
ECHO   - 建议以管理员身份运行以获得完整功能
EXIT /B 0
