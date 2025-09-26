const express = require('express');
const cors = require('cors');
const path = require('path');

// 导入logger
const { defaultLogger } = require('./utils/logger');

// 导入中间件
const { errorHandler } = require('./middleware/errorHandler');
const { loggerMiddleware } = require('./middleware/logger');
const { corsMiddleware } = require('./middleware/cors');
const { bodyParserMiddleware } = require('./middleware/bodyParser');
const { staticFilesMiddleware } = require('./middleware/staticFiles');
const { backendInjector } = require('./middleware/backendInjector');

// 导入路由配置
const { setupRoutes } = require('./routes');

// 导入核心模块
const PixivBackend = require('./core');
const proxyConfig = require('./config');

// 创建logger实例
const logger = defaultLogger.child('Server');

class PixivServer {
  constructor() {
    this.app = express();
    this.backend = null;
    this.port = 3000; // 默认端口，会在init时重新设置
  }

  /**
   * 初始化服务器
   */
  async init() {
    logger.info('🔧 正在初始化 Pixiv 后端服务器...');

    // 重新设置端口（从环境变量获取）
    this.port = process.env.PORT || 3000;

    // 设置代理
    proxyConfig.setEnvironmentVariables();

    // 初始化 Pixiv 后端
    this.backend = new PixivBackend();
    await this.backend.init();

    // 配置中间件
    this.setupMiddleware();

    // 配置路由
    this.setupRoutes();

    // 配置错误处理
    this.setupErrorHandling();

    logger.info('✅ 服务器初始化完成');
  }

  /**
   * 配置中间件
   */
  setupMiddleware() {
    // 自定义日志中间件
    this.app.use(loggerMiddleware);

    // CORS 中间件
    this.app.use(corsMiddleware());

    // Body Parser 中间件
    this.app.use(bodyParserMiddleware());

    // 静态文件服务中间件
    const staticMiddlewares = staticFilesMiddleware();
    this.app.use('/downloads', staticMiddlewares[0]); // 下载文件静态服务
    this.app.use(staticMiddlewares[1]); // 前端静态文件服务

    // 后端实例注入中间件
    this.app.use(backendInjector(this.backend));
  }

  /**
   * 配置路由
   */
  setupRoutes() {
    setupRoutes(this.app, this.backend);
  }

  /**
   * 配置错误处理
   */
  setupErrorHandling() {
    this.app.use(errorHandler);
  }

  /**
   * 启动服务器
   */
  start() {
    this.app.listen(this.port, () => {
      logger.info('✅ Pixiv 后端服务器已启动');
      logger.info(`📍 服务地址: http://localhost:${this.port}`);
      logger.info(`🔗 健康检查: http://localhost:${this.port}/health`);
      logger.info(`📊 登录状态: ${this.backend.isLoggedIn ? '已登录' : '未登录'}`);
      if (this.backend.isLoggedIn) {
        logger.info(`👤 用户: ${this.backend.config.user?.account}`);
      }
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
  }

  /**
   * 优雅关闭
   */
  async shutdown() {
    logger.info('🔄 正在关闭服务器...');
    // 清理代理环境变量
    proxyConfig.clearEnvironmentVariables();
    logger.info('✅ 服务器已关闭');
    process.exit(0);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const server = new PixivServer();

  // 处理进程信号
  process.on('SIGINT', () => server.shutdown());
  process.on('SIGTERM', () => server.shutdown());

  // 启动服务器
  server
    .init()
    .then(() => server.start())
    .catch((error) => logger.error('服务器启动失败', error));
}

module.exports = PixivServer;