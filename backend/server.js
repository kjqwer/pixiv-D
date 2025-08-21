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

// 导入中间件 - 临时注释掉来定位问题
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

// 导入核心模块
const PixivBackend = require('./core');
const proxyConfig = require('./config');

class PixivServer {
  constructor() {
    this.app = express();
    this.backend = null;
    this.port = process.env.PORT || 3000;
  }

  /**
   * 初始化服务器
   */
  async init() {
    console.log('正在初始化 Pixiv 后端服务器...');
    
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
    
    console.log('服务器初始化完成');
  }

  /**
   * 配置中间件
   */
  setupMiddleware() {
    // 日志中间件
    this.app.use(morgan('combined'));
    
    // CORS 中间件
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true
    }));
    
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
          user: req.backend.config.user?.account
        }
      });
    });

    // API 路由
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/artwork', authMiddleware, artworkRoutes);
    this.app.use('/api/artist', authMiddleware, artistRoutes);
    this.app.use('/api/download', authMiddleware, downloadRoutes);
    this.app.use('/api/proxy', proxyRoutes); // 图片代理，不需要认证
    
    // 404 处理
    this.app.use((req, res) => {
      // 如果是API请求，返回JSON格式的404
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ 
        error: 'Not Found', 
        message: `Route ${req.originalUrl} not found` 
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
      console.log(`🚀 Pixiv 后端服务器已启动`);
      console.log(`📍 后端API: http://localhost:${this.port}`);
      console.log(`🌐 前端页面: http://localhost:${this.port}`);
      console.log(`🔗 健康检查: http://localhost:${this.port}/health`);
      console.log(`📊 登录状态: ${this.backend.isLoggedIn ? '已登录' : '未登录'}`);
      if (this.backend.isLoggedIn) {
        console.log(`👤 用户: ${this.backend.config.user?.account}`);
      }
    });
  }

  /**
   * 优雅关闭
   */
  async shutdown() {
    console.log('正在关闭服务器...');
    // 清理代理环境变量
    proxyConfig.clearEnvironmentVariables();
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
  server.init().then(() => server.start()).catch(console.error);
}

module.exports = PixivServer; 