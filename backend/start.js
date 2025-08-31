#!/usr/bin/env node

/**
 * Pixiv 后端服务器启动脚本
 */

const PixivServer = require('./server');
const { defaultLogger } = require('./utils/logger');

// 创建logger实例
const logger = defaultLogger.child('Start');

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
    }
  }

  return options;
}

// 获取命令行参数
const cliOptions = parseArguments();

// 设置环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// 如果提供了代理端口，设置环境变量
if (cliOptions.proxyPort) {
  process.env.PROXY_PORT = cliOptions.proxyPort.toString();
  logger.info(`📡 代理端口已设置为: ${cliOptions.proxyPort}`);
}

// 如果提供了服务器端口，设置环境变量
if (cliOptions.serverPort) {
  process.env.PORT = cliOptions.serverPort.toString();
  logger.info(`🌐 服务器端口已设置为: ${cliOptions.serverPort}`);
}

logger.info('🚀 启动 Pixiv 后端服务器...');

// 创建服务器实例
const server = new PixivServer();

// 处理进程信号
process.on('SIGINT', async () => {
  logger.info('🛑 收到 SIGINT 信号，正在关闭服务器...');
  await server.shutdown();
});

process.on('SIGTERM', async () => {
  logger.info('🛑 收到 SIGTERM 信号，正在关闭服务器...');
  await server.shutdown();
});

// 处理未捕获的异常
process.on('uncaughtException', error => {
  logger.error('❌ 未捕获的异常', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ 未处理的 Promise 拒绝', reason);
  process.exit(1);
});

// 启动服务器
server
  .init()
  .then(() => server.start())
  .catch(error => {
    logger.error('❌ 服务器启动失败', error);
    process.exit(1);
  });
