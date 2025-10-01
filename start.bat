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

:: ========================================
:: 日志级别配置 - 可选值: ERROR, WARN, INFO, DEBUG, TRACE
:: ERROR: 只显示错误信息
:: WARN:  显示警告及以上级别信息
:: INFO:  显示一般信息及以上级别信息 (默认)
:: DEBUG: 显示调试信息及以上级别信息
:: TRACE: 显示所有级别信息 (最详细)
:: ========================================
set LOG_LEVEL=

echo.
echo Pixiv Manager 启动中...
echo.

cd /d "%~dp0"

echo 当前代理端口: %PROXY_PORT%
echo 当前服务器端口: %SERVER_PORT%
echo 日志级别: %LOG_LEVEL%
echo 如需修改端口或日志级别，请用记事本打开此文件，修改对应的配置
echo.

echo 启动后端服务器...
echo 访问地址: http://localhost:%SERVER_PORT%
echo.
echo 提示: 按 Ctrl+C 停止服务器
echo.

:: 启动服务器并传递代理端口、服务器端口和日志级别
if "%PROXY_PORT%"=="" (
  node backend/start.js --server-port=%SERVER_PORT% --log-level=%LOG_LEVEL%
) else (
  node backend/start.js --proxy-port=%PROXY_PORT% --server-port=%SERVER_PORT% --log-level=%LOG_LEVEL%
)

echo.
echo 服务器已停止
pause