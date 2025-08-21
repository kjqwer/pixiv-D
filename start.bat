@echo off
chcp 65001 >nul
echo.
echo 🚀 Pixiv Manager 启动中...
echo.

cd /d "%~dp0"

echo 📊 启动后端服务器...
echo 🌐 访问地址: http://localhost:3000
echo.
echo 💡 提示: 按 Ctrl+C 停止服务器
echo.

node backend/start.js

echo.
echo ⏹️  服务器已停止
pause 