@echo off
echo 正在连接到 Linux 工作站 code-server...
echo 访问 http://localhost:8088 使用密码登录
echo.
echo 密码保存在 Linux: ~/.config/code-server/config.yaml
echo.
C:\Windows\System32\OpenSSH\ssh.exe -N -L 8088:127.0.0.1:8088 liuhui@192.168.1.9
pause
