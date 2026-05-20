@echo off
echo 正在断开网络驱动器...
net use L: /delete
net use M: /delete
echo ✅ 已断开
pause
