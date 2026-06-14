@echo off
REM ================================================================
REM v1.73.72 部署收尾脚本
REM 在 shell 环境恢复后以管理员身份运行
REM ================================================================
setlocal enabledelayedexpansion

echo === v1.73.72 部署收尾 ===
echo.

REM ================================================================
REM Step 1: Linux deb 检查与部署
REM ================================================================
echo [Step 1/4] 检查构建机 deb 状态...
ssh -o BatchMode=yes liuhui@192.168.1.9 "ls -la /home/liuhui/lingjing/desktop/electron/release-v17372/LingJing-1.73.72-linux-x86_64.deb"
if %ERRORLEVEL% NEQ 0 (
    echo   ⚠️ deb 文件不存在，检查 fpm 是否还在运行...
    ssh -o BatchMode=yes liuhui@192.168.1.9 "pgrep -af fpm || echo 'no_fpm'"
    echo   ⏳ 等待 deb 构建完成后重新运行此脚本
    goto :GIT_STEP
)
echo   ✅ deb 文件存在，上传到生产服务器
sshpass -p WsT13575967132 scp -o StrictHostKeyChecking=no liuhui@192.168.1.9:/home/liuhui/lingjing/desktop/electron/release-v17372/LingJing-1.73.72-linux-x86_64.deb root@120.55.5.220:/var/www/downloads/
echo   ✅ 上传完成

REM 更新 versions.json 添加 deb 条目
echo   📝 更新 versions.json...
python -c "
import json, os
prod = '/var/www/downloads/versions.json'
with open(prod) as f: data = json.load(f)
for v in data['versions']:
    if v['version'] == '1.73.72':
        v['files'].append({
            'url': '/downloads/LingJing-1.73.72-linux-x86_64.deb',
            'size': 0,  # 需替换为实际大小
            'sha512': '',
            'platform': 'linux-x86_64',
            'type': 'deb'
        })
        break
with open(prod, 'w') as f: json.dump(data, f, indent=2, ensure_ascii=False)
# 同步到其他路径
import shutil
for p in ['/var/www/html/versions.json', '/opt/lingjing-update-server/versions.json', '/root/cloud-server/versions.json']:
    shutil.copy2(prod, p)
print('versions.json updated and synced')
"
echo   ✅ versions.json 已更新

REM ================================================================
REM Step 2: Git 提交源文件修复
REM ================================================================
:GIT_STEP
echo.
echo [Step 2/4] Git 提交源文件修复...
cd /d D:\lingjing-ide
git add desktop/electron/scripts/build-main.mjs
git commit -m "fix: remove IIFE immediate execution in __safeRequireCodepilot Phase 0.6

The IIFE (})();) on line 391 of build-main.mjs caused the
__safeRequireCodepilot variable to be assigned the immediate
execution result (empty object {}) instead of the function reference.
This made all subsequent __safeRequireCodepilot('mcp') calls fail
with 'is not a function' error.

Fix: })(; → }), keeping __safeRequireCodepilot as a function reference."
echo   ✅ Git commit 完成

REM ================================================================
REM Step 3: 推送到各远程仓库
REM ================================================================
echo.
echo [Step 3/4] 推送到远程仓库...
git push build-machine master
git push production master
git push ide-origin master
echo   ✅ 推送完成

REM ================================================================
REM Step 4: GitHub 推送
REM ================================================================
echo.
echo [Step 4/4] GitHub 推送（需手动处理 token）...
echo   请执行以下命令（替换 YOUR_TOKEN）:
echo   git remote add github https://YOUR_TOKEN@github.com/zhejiangjinmo/lingjing-ide.git
echo   git push github master
echo.
echo ========== v1.73.72 部署收尾完成 ==========
echo.
pause
