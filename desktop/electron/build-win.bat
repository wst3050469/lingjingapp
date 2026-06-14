@echo off
setlocal
cd /d D:\lingjing-ide\desktop\electron

echo [%date% %time%] Build started
echo.

REM Run electron-builder with output to file
call npx electron-builder build --win --x64 > eb-output.log 2>&1

echo [%date% %time%] Build finished with exit code %ERRORLEVEL%
echo.

REM Show output summary
findstr /I "building packaging target artifact error output done created block wrote" eb-output.log 2>nul
echo.
echo === Release files ===
dir release-v17363\*.exe release-v17363\*.blockmap release-v17363\latest.yml 2>nul
if errorlevel 1 echo No installers found!
