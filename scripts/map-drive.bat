@echo off
echo =============================================
echo  灵境 IDE 网络驱动器映射工具
echo  192.168.1.9 (32核/62G Linux 开发机)
echo =============================================
echo.
echo 用户名: liuhui
echo 密码: liuhui123
echo.
echo 正在映射网络驱动器...
net use L: \\192.168.1.9\lingjing-ide /user:liuhui liuhui123 /persistent:yes
net use M: \\192.168.1.9\lingjing-linux /user:liuhui liuhui123 /persistent:yes
echo.
echo ✅ L: 盘 → 灵境项目源码 (lingjing-ide)
echo ✅ M: 盘 → Linux构建产物 (lingjing-linux)
echo.
echo 现在可以在文件管理器中直接访问 L: 和 M: 盘
echo 支持在 Windows VS Code/灵境 IDE 中直接编辑保存
echo.
pause
