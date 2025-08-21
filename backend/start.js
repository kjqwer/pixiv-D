#!/usr/bin/env node

/**
 * Pixiv 后端服务器启动脚本
 */

const PixivServer = require('./server');

// 设置环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

console.log('🚀 启动 Pixiv 后端服务器...');
console.log(`📊 环境: ${process.env.NODE_ENV}`);
console.log(`🌐 端口: ${process.env.PORT || 3000}`);

// 创建服务器实例
const server = new PixivServer();

// 处理进程信号
process.on('SIGINT', async () => {
  console.log('\n🛑 收到 SIGINT 信号，正在关闭服务器...');
  await server.shutdown();
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 收到 SIGTERM 信号，正在关闭服务器...');
  await server.shutdown();
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

// 启动服务器
server.init()
  .then(() => server.start())
  .catch((error) => {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }); 