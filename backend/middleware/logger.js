/**
 * 日志中间件
 */
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('API');

/**
 * 自定义日志中间件
 */
function loggerMiddleware(req, res, next) {
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

  // 过滤掉下载任务状态查询请求
  const isDownloadTasksQuery = 
    req.path === '/api/download/tasks' ||
    req.path === '/api/download/tasks/active' ||
    req.path === '/api/download/tasks/summary' ||
    req.path === '/api/download/tasks/changes' ||
    req.path === '/api/download/tasks/completed';

  // 过滤掉仓库预览请求（图片预览）
  const isRepositoryPreview = req.path === '/api/repository/preview';

  // 过滤掉健康检查请求
  const isHealthCheck = req.path === '/health';

  // 只记录重要的API请求，排除静态资源、图片代理、下载任务查询、仓库预览和健康检查
  if (!isStaticResource && !isImageProxy && !isDownloadTasksQuery && !isRepositoryPreview && !isHealthCheck) {
    const start = Date.now();

    // 原始响应结束方法
    const originalEnd = res.end;

    // 重写响应结束方法以获取响应时间
    res.end = function (chunk, encoding) {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const method = req.method;
      const url = req.originalUrl;

      // 根据状态码选择图标
      let statusIcon;
      if (statusCode >= 200 && statusCode < 300) {
        statusIcon = '✅';
      } else if (statusCode >= 300 && statusCode < 400) {
        statusIcon = '🔄';
      } else if (statusCode >= 400 && statusCode < 500) {
        statusIcon = '⚠️';
      } else {
        statusIcon = '❌';
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
      
      // 输出日志
      logger.info(`${statusIcon} ${methodIcon} ${method} ${url} ${statusCode} ${duration}ms`);

      // 调用原始的end方法
      originalEnd.call(this, chunk, encoding);
    };
  }

  next();
}

module.exports = { loggerMiddleware };