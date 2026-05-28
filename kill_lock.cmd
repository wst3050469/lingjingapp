@echo off
echo Checking for locks...
powershell -Command "Get-Process | Where-Object { $_.ProcessName -like '*node*' -or $_.ProcessName -like '*electron*' } | Stop-Process -Force -ErrorAction SilentlyContinue"
echo Retry cleanup...
cd /d D:\lingjing\lingjing\packages\electron
rmdir /s /q release\win-unpacked 2>nul
if exist release\win-unpacked (
    echo STILL LOCKED
) else (
    echo CLEANED OK
)
