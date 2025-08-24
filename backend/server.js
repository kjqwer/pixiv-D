const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// 导入路由模块
const authRoutes = require('./routes/auth');
const artworkRoutes = require('./routes/artwork');
const artistRoutes = require('./routes/artist');
const downloadRoutes = require('./routes/download');
const proxyRoutes = require('./routes/proxy');
const repositoryRoutes = require('./routes/repository');
const rankingRoutes = require('./routes/ranking');

// 导入中间件 - 临时注释掉来定位问题
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

// 导入核心模块
const PixivBackend = require('./core');
const proxyConfig = require('./config');

// 自定义日志中间件
function customLogger(req, res, next) {
  // 过滤掉静态资源请求和图片代理请求
  const isStaticResource =
    req.path.startsWith('/assets/') ||
    req.path.startsWith('/downloads/') ||
    req.path.includes('.js') ||
    req.path.includes('.css') ||
    req.path.includes('.ico') ||
    req.path.includes('.png') ||
    req.path.includes('.jpg') ||
    req.path.includes('.jpeg') ||
    req.path.includes('.gif') ||
    req.path.includes('.svg') ||
    req.path.includes('.woff') ||
    req.path.includes('.woff2') ||
    req.path.includes('.ttf') ||
    req.path.includes('.eot');

  // 过滤掉图片代理请求
  const isImageProxy = req.path === '/api/proxy/image';

  // 只记录API请求和重要请求，排除静态资源和图片代理
  if (!isStaticResource && !isImageProxy) {
    const start = Date.now();

    // 原始响应结束方法
    const originalEnd = res.end;

    // 重写响应结束方法以获取响应时间
    res.end = function (chunk, encoding) {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const method = req.method;
      const url = req.originalUrl;

      // 根据状态码选择颜色和图标
      let statusIcon, statusColor;
      if (statusCode >= 200 && statusCode < 300) {
        statusIcon = '✅';
        statusColor = '\x1b[32m'; // 绿色
      } else if (statusCode >= 300 && statusCode < 400) {
        statusIcon = '🔄';
        statusColor = '\x1b[33m'; // 黄色
      } else if (statusCode >= 400 && statusCode < 500) {
        statusIcon = '⚠️';
        statusColor = '\x1b[33m'; // 黄色
      } else {
        statusIcon = '❌';
        statusColor = '\x1b[31m'; // 红色
      }

      // 根据请求类型选择图标
      let methodIcon;
      switch (method) {
        case 'GET':
          methodIcon = '📥';
          break;
        case 'POST':
          methodIcon = '📤';
          break;
        case 'PUT':
          methodIcon = '🔄';
          break;
        case 'DELETE':
          methodIcon = '🗑️';
          break;
        case 'PATCH':
          methodIcon = '🔧';
          break;
        default:
          methodIcon = '❓';
      }

      // 格式化时间
      const now = new Date();
      const timeStr = now.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      // 构建日志消息
      const logMessage = `${statusColor}${statusIcon} ${methodIcon} ${method} ${url} ${statusCode} ${duration}ms\x1b[0m`;

      // 输出日志
      console.log(`[${timeStr}] ${logMessage}`);

      // 调用原始的end方法
      originalEnd.call(this, chunk, encoding);
    };
  }

  next();
}

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
    console.log('\x1b[34m🔧 正在初始化 Pixiv 后端服务器...\x1b[0m');

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

    // 配置错误处理 - 临时注释掉
    this.setupErrorHandling();

    console.log('\x1b[32m✅ 服务器初始化完成\x1b[0m');
  }

  /**
   * 配置中间件
   */
  setupMiddleware() {
    // 自定义日志中间件（替换morgan）
    this.app.use(customLogger);

    // CORS 中间件
    this.app.use(
      cors({
        origin: process.env.FRONTEND_URL || true, // 允许所有来源，或者通过环境变量指定
        credentials: true,
      })
    );

    // JSON 解析中间件
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 静态文件服务
    this.app.use('/downloads', express.static(path.join(__dirname, '../downloads')));

    // 前端静态文件服务
    this.app.use(express.static(path.join(__dirname, '../ui/dist')));

    // 将后端实例注入到请求对象中
    this.app.use((req, res, next) => {
      req.backend = this.backend;
      next();
    });
  }

  /**
   * 配置路由
   */
  setupRoutes() {
    // 健康检查
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        backend: {
          isLoggedIn: req.backend.isLoggedIn,
          user: req.backend.config.user?.account,
        },
      });
    });

    // API 路由
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/artwork', authMiddleware, artworkRoutes);
    this.app.use('/api/artist', authMiddleware, artistRoutes);
    this.app.use('/api/download', authMiddleware, downloadRoutes);
    this.app.use('/api/ranking', authMiddleware, rankingRoutes);
    this.app.use('/api/repository', repositoryRoutes); // 仓库管理，不需要认证
    this.app.use('/api/proxy', proxyRoutes); // 图片代理，不需要认证

    // 404 处理
    this.app.use((req, res) => {
      // 如果是API请求，返回JSON格式的404
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Route ${req.originalUrl} not found`,
        });
      }

      // 否则返回前端页面（SPA路由支持）
      res.sendFile(path.join(__dirname, '../ui/dist/index.html'));
    });
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
      console.log('\x1b[32m✅ Pixiv 后端服务器已启动\x1b[0m');
      console.log(`\x1b[36m📍 服务地址: http://localhost:${this.port}\x1b[0m`);
      console.log(`\x1b[36m🔗 健康检查: http://localhost:${this.port}/health\x1b[0m`);
      console.log(`\x1b[33m📊 登录状态: ${this.backend.isLoggedIn ? '已登录' : '未登录'}\x1b[0m`);
      if (this.backend.isLoggedIn) {
        console.log(`\x1b[33m👤 用户: ${this.backend.config.user?.account}\x1b[0m`);
      }
      console.log('\x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    });
  }

  /**
   * 优雅关闭
   */
  async shutdown() {
    console.log('\x1b[33m🔄 正在关闭服务器...\x1b[0m');
    // 清理代理环境变量
    proxyConfig.clearEnvironmentVariables();
    console.log('\x1b[32m✅ 服务器已关闭\x1b[0m');
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
    .catch(console.error);
}

module.exports = PixivServer;
