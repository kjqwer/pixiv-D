#!/usr/bin/env node

/**
 * Pixiv 后端服务器启动脚本
 */

const PixivServer = require('./server');

// 解析命令行参数
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--proxy-port' && i + 1 < args.length) {
      options.proxyPort = parseInt(args[i + 1]);
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
  console.log(`\x1b[36m📡 代理端口已设置为: ${cliOptions.proxyPort}\x1b[0m`);
}

console.log('\x1b[35m🚀 启动 Pixiv 后端服务器...\x1b[0m');

// 创建服务器实例
const server = new PixivServer();

// 处理进程信号
process.on('SIGINT', async () => {
  console.log('\n\x1b[33m🛑 收到 SIGINT 信号，正在关闭服务器...\x1b[0m');
  await server.shutdown();
});

process.on('SIGTERM', async () => {
  console.log('\n\x1b[33m🛑 收到 SIGTERM 信号，正在关闭服务器...\x1b[0m');
  await server.shutdown();
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('\x1b[31m❌ 未捕获的异常:\x1b[0m', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\x1b[31m❌ 未处理的 Promise 拒绝:\x1b[0m', reason);
  process.exit(1);
});

// 启动服务器
server.init()
  .then(() => server.start())
  .catch((error) => {
    console.error('\x1b[31m❌ 服务器启动失败:\x1b[0m', error);
    process.exit(1);
  }); 