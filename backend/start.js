#!/usr/bin/env node

/**
 * Pixiv 后端服务器启动脚本
 */

const fs = require('fs');
const path = require('path');

// 加载配置文件
function loadConfig() {
  // 检测是否在pkg打包环境中运行
  const isPackaged = process.pkg !== undefined;
  
  // 在打包环境中，配置文件在当前工作目录；在开发环境中，配置文件在上级目录
  const configPath = isPackaged 
    ? path.join(process.cwd(), 'config.json')  // 打包环境：当前工作目录
    : path.join(__dirname, '..', 'config.json');  // 开发环境：上级目录
  let config = {
    server: {
      port: 3000,
      autoOpenBrowser: true
    },
    proxy: {
      port: null,
      enabled: false
    },
    logging: {
      level: "INFO"
    },
    system: {
      threadPoolSize: 16
    }
  };

  try {
    console.log(`检测环境: ${isPackaged ? '打包环境' : '开发环境'}`);
    console.log(`配置文件路径: ${configPath}`);
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const userConfig = JSON.parse(configData);
      
      // 合并配置，用户配置覆盖默认配置
      config = {
        ...config,
        server: { ...config.server, ...userConfig.server },
        proxy: { ...config.proxy, ...userConfig.proxy },
        logging: { ...config.logging, ...userConfig.logging },
        system: { ...config.system, ...userConfig.system }
      };
      console.log('已加载配置文件');
    } else {
      // 如果配置文件不存在，创建默认配置文件
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log('已创建默认配置文件:', configPath);
    }
  } catch (error) {
    console.error('读取配置文件失败，使用默认配置:', error.message);
  }

  return config;
}
// 加载配置
const config = loadConfig();

// 重要：必须在任何其他模块导入之前设置线程池大小
// 解决多个下载任务时的SSH连接阻塞问题
if (!process.env.UV_THREADPOOL_SIZE) {
  process.env.UV_THREADPOOL_SIZE = config.system.threadPoolSize.toString();
}

// 设置环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// 设置日志级别环境变量
if (config.logging.level) {
  process.env.LOG_LEVEL = config.logging.level.toLowerCase();
}

// 在设置环境变量后导入logger和服务器
const { defaultLogger } = require('./utils/logger');
const logger = defaultLogger.child('Start');
const PixivServer = require('./server');

// 如果配置了代理，设置环境变量
if (config.proxy.enabled === true || (config.proxy.enabled === "auto" && config.proxy.port)) {
  // 显式配置代理端口
  if (config.proxy.port) {
    process.env.PROXY_PORT = config.proxy.port.toString();
    logger.info(`代理端口已设置为: ${config.proxy.port}`);
  }
} else if (config.proxy.enabled === "auto") {
  // 自动检测系统代理
  const systemProxy = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy;
  if (systemProxy) {
    logger.info(`检测到系统代理: ${systemProxy}`);
    // 从系统代理URL中提取端口
    const match = systemProxy.match(/http:\/\/127\.0\.0\.1:(\d+)/);
    if (match) {
      process.env.PROXY_PORT = match[1];
      logger.info(`自动设置代理端口为: ${match[1]}`);
    }
  } else {
    logger.info('未检测到系统代理，将尝试使用系统代理环境变量');
  }
}

// 设置服务器端口
if (config.server.port) {
  process.env.PORT = config.server.port.toString();
  logger.info(`服务器端口已设置为: ${config.server.port}`);
}

// 输出日志级别信息
logger.info(`日志级别: ${config.logging.level}`);

// 设置自动打开浏览器选项
if (config.server.autoOpenBrowser !== undefined) {
  process.env.AUTO_OPEN_BROWSER = config.server.autoOpenBrowser.toString();
  logger.info(`自动打开浏览器: ${config.server.autoOpenBrowser ? '启用' : '禁用'}`);
}

logger.info('启动 Pixiv 后端服务器...');
// logger.info('配置信息:', {
//   serverPort: config.server.port,
//   proxyMode: config.proxy.enabled,
//   proxyPort: config.proxy.enabled === true && config.proxy.port ? config.proxy.port : 
//             (config.proxy.enabled === "auto" ? '自动检测' : '未启用'),
//   logLevel: config.logging.level,
//   autoOpenBrowser: config.server.autoOpenBrowser,
//   threadPoolSize: config.system.threadPoolSize
// });

// 创建服务器实例
const server = new PixivServer();

// 处理进程信号
process.on('SIGINT', async () => {
  logger.info('收到 SIGINT 信号，正在关闭服务器...');
  await server.shutdown();
});

process.on('SIGTERM', async () => {
  logger.info('收到 SIGTERM 信号，正在关闭服务器...');
  await server.shutdown();
});

// 处理未捕获的异常
process.on('uncaughtException', error => {
  logger.error('未捕获的异常', error);
  logger.error('异常堆栈:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝');
  logger.error('拒绝原因:', reason);
  if (reason instanceof Error) {
    logger.error('错误堆栈:', reason.stack);
  }
  logger.error('Promise:', promise);
  
  // 不要立即退出进程，而是记录错误并继续运行
  // 这样可以避免因为自动恢复任务的小错误而停止整个服务
  logger.warn('继续运行服务器，但建议检查上述错误');
});

// 启动服务器
server
  .init()
  .then(() => server.start())
  .catch(error => {
    logger.error('服务器启动失败', error);
    process.exit(1);
  });
