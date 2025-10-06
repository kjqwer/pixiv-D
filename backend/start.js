#!/usr/bin/env node

/**
 * Pixiv 后端服务器启动脚本
 */

// 重要：必须在任何其他模块导入之前设置线程池大小
// 解决多个下载任务时的SSH连接阻塞问题
if (!process.env.UV_THREADPOOL_SIZE) {
  process.env.UV_THREADPOOL_SIZE = '16'; // 增加到16个线程
}

const PixivServer = require('./server');

// 解析命令行参数
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // 处理 --key=value 格式
    if (arg.startsWith('--proxy-port=')) {
      const port = parseInt(arg.split('=')[1]);
      if (!isNaN(port)) {
        options.proxyPort = port;
      }
    } else if (arg.startsWith('--server-port=')) {
      const port = parseInt(arg.split('=')[1]);
      if (!isNaN(port)) {
        options.serverPort = port;
      }
    } else if (arg.startsWith('--log-level=')) {
      const level = arg.split('=')[1].toUpperCase();
      if (['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'].includes(level)) {
        options.logLevel = level;
      }
    } else if (arg.startsWith('--auto-open-browser=')) {
      const value = arg.split('=')[1].toLowerCase();
      options.autoOpenBrowser = value === 'true';
    } 
    // 处理 --key value 格式（向后兼容）
    else if (arg === '--proxy-port' && i + 1 < args.length) {
      const port = parseInt(args[i + 1]);
      if (!isNaN(port)) {
        options.proxyPort = port;
      }
      i++; // 跳过下一个参数
    } else if (arg === '--server-port' && i + 1 < args.length) {
      const port = parseInt(args[i + 1]);
      if (!isNaN(port)) {
        options.serverPort = port;
      }
      i++; // 跳过下一个参数
    } else if (arg === '--log-level' && i + 1 < args.length) {
      const level = args[i + 1].toUpperCase();
      if (['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'].includes(level)) {
        options.logLevel = level;
      }
      i++; // 跳过下一个参数
    } else if (arg === '--auto-open-browser' && i + 1 < args.length) {
      const value = args[i + 1].toLowerCase();
      options.autoOpenBrowser = value === 'true';
      i++; // 跳过下一个参数
    }
  }

  return options;
}

// 获取命令行参数
const cliOptions = parseArguments();

// 设置环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// 设置日志级别环境变量
if (cliOptions.logLevel) {
  process.env.LOG_LEVEL = cliOptions.logLevel.toLowerCase();
}

// 在设置环境变量后导入logger
const { defaultLogger } = require('./utils/logger');
const logger = defaultLogger.child('Start');

// 如果提供了代理端口，设置环境变量
if (cliOptions.proxyPort) {
  process.env.PROXY_PORT = cliOptions.proxyPort.toString();
  logger.info(`代理端口已设置为: ${cliOptions.proxyPort}`);
}

// 如果提供了服务器端口，设置环境变量
if (cliOptions.serverPort) {
  process.env.PORT = cliOptions.serverPort.toString();
  logger.info(`服务器端口已设置为: ${cliOptions.serverPort}`);
}

// 输出日志级别信息
if (cliOptions.logLevel) {
  logger.info(`日志级别: ${cliOptions.logLevel}`);
}

// 设置自动打开浏览器选项
if (cliOptions.autoOpenBrowser !== undefined) {
  process.env.AUTO_OPEN_BROWSER = cliOptions.autoOpenBrowser.toString();
  logger.info(`自动打开浏览器: ${cliOptions.autoOpenBrowser ? '启用' : '禁用'}`);
}

logger.info('启动 Pixiv 后端服务器...');

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
