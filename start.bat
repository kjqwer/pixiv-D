@echo off
chcp 65001 >nul

:: ========================================
:: 代理配置 - 请根据你的代理软件修改端口号
:: 常见端口: Clash=7890, V2Ray=10809, Shadowsocks=1080
:: ========================================
set PROXY_PORT=

:: ========================================
:: 服务器端口配置 - 默认3000
:: ========================================
set SERVER_PORT=3000

echo.
echo Pixiv Manager 启动中...
echo.

cd /d "%~dp0"

echo 当前代理端口: %PROXY_PORT%
echo 当前服务器端口: %SERVER_PORT%
echo 如需修改端口，请用记事本打开此文件，修改对应的端口号
echo.

echo 启动后端服务器...
echo 访问地址: http://localhost:%SERVER_PORT%
echo.
echo 提示: 按 Ctrl+C 停止服务器
echo.

:: 启动服务器并传递代理端口和服务器端口
if "%PROXY_PORT%"=="" (
  node backend/start.js --server-port=%SERVER_PORT%
) else (
  node backend/start.js --proxy-port=%PROXY_PORT% --server-port=%SERVER_PORT%
)

echo.
echo 服务器已停止
pause 