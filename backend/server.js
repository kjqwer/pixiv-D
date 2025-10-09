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
    this.server = null; // 添加server实例引用
    this.port = 3000; // 默认端口，会在init时重新设置
    this.logLevel = process.env.LOG_LEVEL || 'info'; // 获取日志级别
    this.isVerboseMode = ['debug', 'trace'].includes(this.logLevel.toLowerCase()); // 检查是否为详细模式
    
    // 保存启动时的命令行参数和环境变量
    this.startupArgs = {
      argv: [...process.argv], // 复制命令行参数
      env: {
        PORT: process.env.PORT,
        PROXY_PORT: process.env.PROXY_PORT,
        LOG_LEVEL: process.env.LOG_LEVEL,
        NODE_ENV: process.env.NODE_ENV,
        AUTO_OPEN_BROWSER: process.env.AUTO_OPEN_BROWSER,
        UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE
      }
    };
  }

  /**
   * 初始化服务器
   */
  async init() {
    logger.info('正在初始化 Pixiv 后端服务器...');

    // 重新设置端口（从环境变量获取）
    this.port = process.env.PORT || 3000;

    // 如果启用了详细模式，输出调试信息
    if (this.isVerboseMode) {
      logger.info(`详细模式已启用 (日志级别: ${this.logLevel.toUpperCase()})`);
      logger.debug('环境变量:', {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        PROXY_PORT: process.env.PROXY_PORT,
        LOG_LEVEL: process.env.LOG_LEVEL
      });
    }

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

    logger.info('服务器初始化完成');
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
    
    // 将服务器实例保存到app.locals中，供路由使用
    this.app.locals.serverInstance = this;
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
    this.server = this.app.listen(this.port, () => {
      logger.info('Pixiv 后端服务器已启动');
      logger.info(`服务地址: http://localhost:${this.port}`);
      logger.info(`健康检查: http://localhost:${this.port}/health`);
      logger.info(`登录状态: ${this.backend.isLoggedIn ? '已登录' : '未登录'}`);
      if (this.backend.isLoggedIn) {
        logger.info(`用户: ${this.backend.config.user?.account}`);
      }
      if (this.isVerboseMode) {
        logger.info(`日志级别: ${this.logLevel.toUpperCase()}`);
        logger.debug(`服务器端口: ${this.port}`);
        logger.debug(`代理端口: ${process.env.PROXY_PORT || '未设置'}`);
      }
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // 自动打开浏览器
      if (process.env.AUTO_OPEN_BROWSER === 'true') {
        this.openBrowser();
      }
    });
  }

  /**
   * 打开浏览器
   */
  openBrowser() {
    const url = `http://localhost:${this.port}`;
    logger.info(`正在打开浏览器: ${url}`);
    
    const { spawn } = require('child_process');
    const os = require('os');
    
    let command;
    let args = [url];
    
    switch (os.platform()) {
      case 'win32':
        command = 'cmd';
        args = ['/c', 'start', '""', url];
        break;
      case 'darwin':
        command = 'open';
        break;
      case 'linux':
        command = 'xdg-open';
        break;
      default:
        logger.warn('不支持的操作系统，无法自动打开浏览器');
        return;
    }
    
    try {
      const child = spawn(command, args, { 
        detached: true, 
        stdio: 'ignore' 
      });
      child.unref();
      logger.info('浏览器已打开');
    } catch (error) {
      logger.warn('打开浏览器失败:', error.message);
    }
  }

  /**
   * 重启服务器
   */
  async restart() {
    logger.info('正在重启服务器...');
    
    try {
      // 清理代理环境变量
      proxyConfig.clearEnvironmentVariables();
      
      // 关闭当前服务器
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(() => {
            logger.info('HTTP服务器已关闭');
            resolve();
          });
        });
      }
      
      // 清理后端实例
      if (this.backend) {
        await this.backend.cleanup?.();
      }
      
      logger.info('正在使用原始启动参数重新启动服务器...');
      
      // 使用spawn重新启动进程，保持原始参数
      const { spawn } = require('child_process');
      const path = require('path');
      
      // 构建启动命令
      const nodeExecutable = process.execPath;
      const startScript = path.join(__dirname, 'start.js');
      
      // 获取原始命令行参数（排除node和脚本路径）
      const originalArgs = this.startupArgs.argv.slice(2);
      
      logger.info('重启命令:', nodeExecutable, [startScript, ...originalArgs]);
      
      // 启动新进程
      const child = spawn(nodeExecutable, [startScript, ...originalArgs], {
        detached: true,
        stdio: 'inherit',
        env: {
          ...process.env,
          ...this.startupArgs.env // 恢复原始环境变量
        }
      });
      
      // 分离子进程
      child.unref();
      
      logger.info('新进程已启动，当前进程即将退出');
      
      // 延迟退出当前进程
      setTimeout(() => {
        process.exit(0);
      }, 500);
      
      return { success: true, message: '服务器重启成功' };
      
    } catch (error) {
      logger.error('服务器重启失败:', error);
      throw error;
    }
  }

  /**
   * 优雅关闭
   */
  async shutdown() {
    logger.info('正在关闭服务器...');
    // 清理代理环境变量
    proxyConfig.clearEnvironmentVariables();
    logger.info('服务器已关闭');
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