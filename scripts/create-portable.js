const fs = require('fs-extra');
const path = require('path');
const { defaultLogger } = require('../backend/utils/logger');

// 创建logger实例
const logger = defaultLogger.child('CreatePortable');

async function createPortable(platform = 'win') {
  const distDir = path.join(__dirname, '..', 'dist');
  let portableDir = path.join(__dirname, '..', 'pixiv-manager-portable');
  
  // 根据平台设置不同的目录名和可执行文件名
  let exeName = 'pixiv-manager.exe';
  let exePath = path.join(distDir, exeName);
  
  // 根据平台参数设置
  if (platform === 'linux') {
    portableDir = path.join(__dirname, '..', 'pixiv-manager-portable-linux');
    exeName = 'pixiv-manager';
    exePath = path.join(distDir, exeName);
  } else if (platform === 'macos') {
    portableDir = path.join(__dirname, '..', 'pixiv-manager-portable-macos');
    exeName = 'pixiv-manager';
    exePath = path.join(distDir, exeName);
  }
  
  try {
    // 清理之前的便携版
    await fs.remove(portableDir);
    await fs.ensureDir(portableDir);
    
    // 复制可执行文件
    if (await fs.pathExists(exePath)) {
      await fs.copy(exePath, path.join(portableDir, exeName));
    }
    
    // 创建README
    let executableInstructions = '';
    if (platform === 'linux') {
      executableInstructions = `1. 添加执行权限: \`chmod +x pixiv-manager-linux\`
2. 运行程序: \`./pixiv-manager-linux\``;
    } else if (platform === 'macos') {
      executableInstructions = `1. 添加执行权限: \`chmod +x pixiv-manager-macos\`
2. 运行程序: \`./pixiv-manager-macos\``;
    } else {
      executableInstructions = `1. 双击 \`pixiv-manager.exe\` 启动程序`;
    }
    
    const readme = `# Pixiv Manager 便携版

## 使用说明

${executableInstructions}
${platform === 'win' ? '' : '3. '}在浏览器中访问 http://localhost:3000
${platform === 'win' ? '3' : '4'}. 按 Ctrl+C 停止服务器

## 配置设置

如需修改配置，请用记事本编辑 \`config.json\` 文件：

### 代理设置（重要）
修改 proxy 部分：
\`\`\`json
{
  "proxy": {
    "port": null,        // 代理端口号（auto模式下可为null）
    "enabled": "auto"    // 代理模式：true/false/"auto"
  }
}
\`\`\`

代理模式说明：
- \`"auto"\`: 自动检测系统代理（推荐）
- \`true\`: 启用指定端口的代理
- \`false\`: 禁用代理

常见代理端口：
- Clash: 7890
- V2Ray: 10809  
- Shadowsocks: 1080

**推荐使用 "auto" 模式**，程序会自动检测 Clash 等代理软件的系统代理设置。

### 服务器端口设置
修改 server 部分：
\`\`\`json
{
  "server": {
    "port": 3000,           // 服务器端口，默认3000
    "autoOpenBrowser": true // 是否自动打开浏览器
  }
}
\`\`\`

### 日志级别设置
修改 logging 部分：
\`\`\`json
{
  "logging": {
    "level": "INFO"  // 日志级别
  }
}
\`\`\`

可选的日志级别：
- ERROR: 只显示错误信息
- WARN: 显示警告及以上级别信息
- INFO: 显示一般信息及以上级别信息（默认）
- DEBUG: 显示调试信息及以上级别信息
- TRACE: 显示所有级别信息（最详细）

### 系统设置
修改 system 部分：
\`\`\`json
{
  "system": {
    "threadPoolSize": 16  // 线程池大小，影响下载性能
  }
}
\`\`\`

## 注意事项

- 首次运行可能需要几秒钟启动时间
- 程序会在当前目录创建数据文件夹
- 没代理或者代理设置错误无法成功登录，注意仔细检查，获取code的时间比较短，记得快速操作
- 支持Windows 10/11 64位系统
- 修改配置文件后需要重启程序才能生效
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

// 获取命令行参数
const platform = process.argv[2] || 'win';
createPortable(platform);