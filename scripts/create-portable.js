const fs = require('fs-extra');
const path = require('path');

async function createPortable() {
  const distDir = path.join(__dirname, '..', 'dist');
  const portableDir = path.join(__dirname, '..', 'pixiv-manager-portable');
  
  try {
    // 清理之前的便携版
    await fs.remove(portableDir);
    await fs.ensureDir(portableDir);
    
    // 复制可执行文件
    const exeName = 'pixiv-backend.exe';
    const exePath = path.join(distDir, exeName);
    if (await fs.pathExists(exePath)) {
      await fs.copy(exePath, path.join(portableDir, exeName));
    }
    
    // 创建启动脚本
    const startScript = `@echo off
chcp 65001 >nul
title Pixiv Manager

:: ========================================
:: 代理配置 - 请根据你的代理软件修改端口号
:: 常见端口: Clash=7890, V2Ray=10809, Shadowsocks=1080
:: ========================================
set PROXY_PORT=7890

echo.
echo ========================================
echo Pixiv Manager Starting...
echo ========================================
echo.

cd /d "%~dp0"

echo Current proxy port: %PROXY_PORT%
echo To change proxy port, edit this file and modify line 6
echo.

echo Starting backend server...
echo Access URL: http://localhost:3000
echo.
echo Tip: Press Ctrl+C to stop server
echo.

:: Start server and pass proxy port
pixiv-backend.exe --proxy-port=%PROXY_PORT%

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

## 代理设置

如需使用代理，请编辑 \`start.bat\` 文件，修改第6行的端口号：
- Clash: 7890
- V2Ray: 10809  
- Shadowsocks: 1080

## 注意事项

- 首次运行可能需要几秒钟启动时间
- 程序会在当前目录创建数据文件夹
- 支持Windows 10/11 64位系统
`;
    
    await fs.writeFile(path.join(portableDir, 'README.txt'), readme, 'utf8');
    
    // 创建数据目录
    await fs.ensureDir(path.join(portableDir, 'data'));
    await fs.ensureDir(path.join(portableDir, 'downloads'));
    
    console.log('✅ 便携版创建完成！');
    console.log(`📁 位置: ${portableDir}`);
    console.log('📦 可以将整个文件夹打包分发给用户');
    
  } catch (error) {
    console.error('❌ 创建便携版失败:', error);
  }
}

createPortable(); 