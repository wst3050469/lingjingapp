@echo off
cd /d D:\lingjing\lingjing\packages\electron
for /d %%d in (release-v*) do if not "%%d"=="release-v1527" (
  echo Deleting %%d...
  rmdir /s /q "%%d" 2>nul
)
echo Cleanup complete!