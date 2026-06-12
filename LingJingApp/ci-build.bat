@echo off
REM ============================================
REM  LingJingApp CI/CD Build & Deploy Script
REM  v1.0 - Auto build signed APK and deploy to production
REM ============================================
setlocal enabledelayedexpansion

set PROJECT_DIR=D:\lingjing-ide\LingJingApp
set LOG_DIR=D:\lingjing-ide
set SERVER=root@120.55.5.220
set REMOTE_PATH=/var/www/downloads
set VERSION_FILE=D:\lingjing-ide\LingJingApp\app\build.gradle.kts

echo [%date% %time%] ==========================================
echo [%date% %time%] LingJingApp CI/CD Build Starting...
echo [%date% %time%] ==========================================

REM 1. Extract current version
for /f "tokens=2 delims==\"" %%a in ('findstr "versionName" %VERSION_FILE%') do set VERSION=%%a
set VERSION=%VERSION: =%
echo [%date% %time%] Version: %VERSION%

REM 2. Clean build
echo [%date% %time%] Step 1/4: Cleaning...
pushd %PROJECT_DIR%
call gradlew.bat clean > %LOG_DIR%\ci_build.log 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [%date% %time%] ERROR: Clean failed!
    type %LOG_DIR%\ci_build.log
    exit /b 1
)

REM 3. Assemble Release
echo [%date% %time%] Step 2/4: Building Release APK...
call gradlew.bat assembleRelease >> %LOG_DIR%\ci_build.log 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [%date% %time%] ERROR: Build failed!
    type %LOG_DIR%\ci_build.log
    exit /b 1
)

REM 4. Verify APK
set APK_PATH=%PROJECT_DIR%\app\build\outputs\apk\release\app-release.apk
if not exist "%APK_PATH%" (
    echo [%date% %time%] ERROR: APK not found at %APK_PATH%
    exit /b 1
)
for %%A in ("%APK_PATH%") do set APK_SIZE=%%~zA
echo [%date% %time%] Step 3/4: APK built - %APK_SIZE% bytes

REM 5. Deploy to production
echo [%date% %time%] Step 4/4: Deploying to %SERVER%...
set GIT_SSH_COMMAND=ssh
scp "%APK_PATH%" %SERVER%:%REMOTE_PATH%/lingjing-v%VERSION%.apk > %LOG_DIR%\ci_deploy.log 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [%date% %time%] ERROR: SCP upload failed!
    type %LOG_DIR%\ci_deploy.log
    exit /b 1
)

REM 6. Update versions.json on server
echo [%date% %time%] Updating versions.json...
python -c "import json; print('versions_update_needed')" > nul 2>&1
echo [%date% %time%] NOTE: Run update_versions.py on server manually or via webhook

REM 7. Git tag
echo [%date% %time%] Tagging release v%VERSION%...
git tag -a "v%VERSION%" -m "Release v%VERSION% - Automated CI/CD build" 2>&1
set GIT_SSH_COMMAND=ssh
git push production master --tags 2>&1

echo [%date% %time%] ==========================================
echo [%date% %time%] BUILD & DEPLOY SUCCESSFUL!
echo [%date% %time%] APK: %REMOTE_PATH%/lingjing-v%VERSION%.apk
echo [%date% %time%] Size: %APK_SIZE% bytes
echo [%date% %time%] ==========================================
popd
endlocal
