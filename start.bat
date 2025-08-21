@echo off
chcp 65001 >nul

:: ========================================
:: 代理配置 - 请根据你的代理软件修改端口号
:: 常见端口: Clash=7890, V2Ray=10809, Shadowsocks=1080
:: ========================================
set PROXY_PORT=

echo.
echo 🚀 Pixiv Manager 启动中...
echo.

cd /d "%~dp0"

echo 📡 当前代理端口: %PROXY_PORT%
echo 💡 如需修改代理端口，请用记事本打开此文件，修改第6行的端口号
echo.

echo 📊 启动后端服务器...
echo 🌐 访问地址: http://localhost:3000
echo.
echo 💡 提示: 按 Ctrl+C 停止服务器
echo.

:: 启动服务器并传递代理端口
node backend/start.js --proxy-port=%PROXY_PORT%

echo.
echo ⏹️  服务器已停止
pause 