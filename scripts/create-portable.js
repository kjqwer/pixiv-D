const fs = require('fs-extra');
const path = require('path');
const { defaultLogger } = require('../backend/utils/logger');

// 创建logger实例
const logger = defaultLogger.child('CreatePortable');

async function createPortable() {
  const distDir = path.join(__dirname, '..', 'dist');
  const portableDir = path.join(__dirname, '..', 'pixiv-manager-portable');
  
  try {
    // 清理之前的便携版
    await fs.remove(portableDir);
    await fs.ensureDir(portableDir);
    
    // 复制可执行文件
    const exeName = 'pixiv-manager.exe';
    const exePath = path.join(distDir, exeName);
    if (await fs.pathExists(exePath)) {
      await fs.copy(exePath, path.join(portableDir, exeName));
    }
    
    // 创建启动脚本
    const startScript = `@echo off

title Pixiv Manager

REM ========================================
REM Proxy Configuration - Modify port according to your proxy software
REM Common ports: Clash=7890, V2Ray=10809, Shadowsocks=1080
REM ========================================
set PROXY_PORT=7890

REM ========================================
REM Server Port Configuration - Default 3000
REM ========================================
set SERVER_PORT=3000

REM ========================================
REM Log Level Configuration - Options: ERROR, WARN, INFO, DEBUG, TRACE
REM ERROR: Show only error messages
REM WARN:  Show warning and above level messages
REM INFO:  Show general information and above level messages (default)
REM DEBUG: Show debug information and above level messages
REM TRACE: Show all level messages (most detailed)
REM ========================================
set LOG_LEVEL=INFO

echo.
echo ========================================
echo Pixiv Manager Starting...
echo ========================================
echo.

cd /d "%~dp0"

echo Current proxy port: %PROXY_PORT%
echo Current server port: %SERVER_PORT%
echo Log level: %LOG_LEVEL%
echo To modify settings, edit this file with notepad
echo.

echo Starting backend server...
echo Access URL: http://localhost:%SERVER_PORT%
echo.
echo Tip: Press Ctrl+C to stop server
echo.

REM Start server and pass proxy port, server port and log level
if "%PROXY_PORT%"=="" (
  pixiv-manager.exe --server-port=%SERVER_PORT% --log-level=%LOG_LEVEL%
) else (
  pixiv-manager.exe --proxy-port=%PROXY_PORT% --server-port=%SERVER_PORT% --log-level=%LOG_LEVEL%
)

echo.
echo Server stopped
pause
`;
    
    await fs.writeFile(path.join(portableDir, 'start.bat'), startScript, 'utf8');
    
    // 创建README
    const readme = `# Pixiv Manager 便携版

## 使用说明

1. 双击 \`start.bat\` 启动程序
2. 在浏览器中访问 http://localhost:3000
3. 按 Ctrl+C 停止服务器

## 配置设置

如需修改配置，请用记事本编辑 \`start.bat\` 文件：

### 代理设置（重要）
修改（PROXY_PORT=xxxx）的端口号：
- Clash: 7890
- V2Ray: 10809  
- Shadowsocks: 1080

### 服务器端口设置
修改（SERVER_PORT=xxxx）的端口号，默认为3000

### 日志级别设置
修改（LOG_LEVEL=xxxx）的日志级别，可选值：
- ERROR: 只显示错误信息
- WARN: 显示警告及以上级别信息
- INFO: 显示一般信息及以上级别信息（默认）
- DEBUG: 显示调试信息及以上级别信息
- TRACE: 显示所有级别信息（最详细）

## 注意事项

- 首次运行可能需要几秒钟启动时间
- 程序会在当前目录创建数据文件夹
- 没代理或者代理设置错误无法成功登录，注意仔细检查，获取code的时间比较短，记得快速操作
- 支持Windows 10/11 64位系统
`;
    
    await fs.writeFile(path.join(portableDir, 'README.txt'), readme, 'utf8');
    
    // 创建数据目录
    await fs.ensureDir(path.join(portableDir, 'data'));
    await fs.ensureDir(path.join(portableDir, 'downloads'));
    
    logger.info('便携版创建完成！');
    logger.info(`位置: ${portableDir}`);
    logger.info('可以将整个文件夹打包分发给用户');
    
  } catch (error) {
    logger.error('创建便携版失败', error);
  }
}

createPortable();