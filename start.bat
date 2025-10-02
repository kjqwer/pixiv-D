@echo off
chcp 65001 >nul

REM ========================================
REM 代理配置 - 请根据你的代理软件修改端口号
REM 常见端口: Clash=7890, V2Ray=10809, Shadowsocks=1080
REM ========================================
set PROXY_PORT=

REM ========================================
REM 服务器端口配置 - 默认3000
REM ========================================
set SERVER_PORT=3000

REM ========================================
REM 日志级别配置 - 可选值: ERROR, WARN, INFO, DEBUG, TRACE
REM ERROR: 只显示错误信息
REM WARN:  显示警告及以上级别信息
REM INFO:  显示一般信息及以上级别信息 (默认)
REM DEBUG: 显示调试信息及以上级别信息
REM TRACE: 显示所有级别信息 (最详细)
REM ========================================
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

REM 启动服务器并传递代理端口、服务器端口和日志级别
if "%PROXY_PORT%"=="" (
  node backend/start.js --server-port=%SERVER_PORT% --log-level=%LOG_LEVEL%
) else (
  node backend/start.js --proxy-port=%PROXY_PORT% --server-port=%SERVER_PORT% --log-level=%LOG_LEVEL%
)

echo.
echo 服务器已停止
pause