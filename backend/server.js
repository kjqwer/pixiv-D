const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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
    this.server = null;
    this.backend = null;
  }

  /**
   * 加载配置文件
   */
  loadConfig() {
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
      logger.info(`检测环境: ${isPackaged ? '打包环境' : '开发环境'}`);
      logger.info(`配置文件路径: ${configPath}`);
      
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
        logger.info('已加载配置文件');
      } else {
        // 如果配置文件不存在，创建默认配置文件
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        logger.info('已创建默认配置文件:', configPath);
      }
    } catch (error) {
      logger.error('读取配置文件失败，使用默认配置:', error.message);
    }

    return config;
  }

  /**
   * 应用配置到环境变量
   */
  applyConfig(config) {
    // 设置线程池大小
    if (!process.env.UV_THREADPOOL_SIZE) {
      process.env.UV_THREADPOOL_SIZE = config.system.threadPoolSize.toString();
    }

    // 设置环境变量
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';

    // 设置日志级别环境变量
    if (config.logging.level) {
      process.env.LOG_LEVEL = config.logging.level.toLowerCase();
    }

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

    // 设置自动打开浏览器选项
    if (config.server.autoOpenBrowser !== undefined) {
      process.env.AUTO_OPEN_BROWSER = config.server.autoOpenBrowser.toString();
      logger.info(`自动打开浏览器: ${config.server.autoOpenBrowser ? '启用' : '禁用'}`);
    }

    logger.info(`日志级别: ${config.logging.level}`);
  }

  /**
   * 初始化服务器
   */
  async init() {
    this.app = express();
    this.port = parseInt(process.env.PORT) || 3000;
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.isVerboseMode = ['debug', 'trace'].includes(this.logLevel.toLowerCase());

    logger.info('初始化 Pixiv 服务器...');
    logger.info(`服务器端口: ${this.port}`);
    logger.info(`日志级别: ${this.logLevel}`);

    // 初始化后端核心
    this.backend = new PixivBackend();
    await this.backend.init();

    // 设置中间件
    this.setupMiddleware();

    // 设置路由
    this.setupRoutes();

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
      
      // 重新加载配置文件
      const config = this.loadConfig();
      
      // 重新应用配置到环境变量
      this.applyConfig(config);
      
      // 重新初始化并启动
      await this.init();
      await this.start();
      
      logger.info('服务器重启成功');
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