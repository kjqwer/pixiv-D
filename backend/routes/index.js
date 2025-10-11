/**
 * 路由配置文件
 * 统一管理和配置所有路由
 */

// 导入路由模块
const authRoutes = require('./auth');
const artworkRoutes = require('./artwork');
const artistRoutes = require('./artist');
const downloadRoutes = require('./download');
const proxyRoutes = require('./proxy');
const repositoryRoutes = require('./repository');
const rankingRoutes = require('./ranking');
const watchlistRoutes = require('./watchlist');
const updateRoutes = require('./update');
const systemRoutes = require('./system');
const databaseRoutes = require('./database');

// 导入认证中间件
const { authMiddleware } = require('../middleware/auth');

/**
 * 配置所有路由
 * @param {Express.Application} app Express应用实例
 * @param {PixivBackend} backend Pixiv后端实例
 */
function setupRoutes(app, backend) {
  const path = require('path');
  
  // 健康检查
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      backend: {
        isLoggedIn: backend.isLoggedIn,
        user: backend.config.user?.account,
      },
    });
  });

  // API 路由
  app.use('/api/auth', authRoutes);
  app.use('/api/artwork', authMiddleware, artworkRoutes);
  app.use('/api/artist', authMiddleware, artistRoutes);
  app.use('/api/download', authMiddleware, downloadRoutes);
  app.use('/api/ranking', authMiddleware, rankingRoutes);
  app.use('/api/repository', repositoryRoutes); // 仓库管理，不需要认证
  app.use('/api/proxy', proxyRoutes); // 图片代理，不需要认证
  app.use('/api/watchlist', authMiddleware, watchlistRoutes); // 待看名单，需要认证
  app.use('/api/update', updateRoutes); // 更新检查，不需要认证
  app.use('/api/system', systemRoutes); // 系统管理，不需要认证
  app.use('/api/database', databaseRoutes); // 数据库管理，不需要认证

  // 404 处理
  app.use((req, res) => {
    // 如果是API请求，返回JSON格式的404
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
      });
    }

    // 否则返回前端页面（SPA路由支持）
    res.sendFile(path.join(__dirname, '../../ui/dist/index.html'));
  });
}

module.exports = { setupRoutes };