/**
 * 日志中间件
 */
const { defaultLogger } = require('../utils/logger');

// 颜色常量
const METHOD_COLORS = {
  GET: '\x1b[32m',     // 绿色
  POST: '\x1b[34m',    // 蓝色
  PUT: '\x1b[33m',     // 黄色
  DELETE: '\x1b[31m',  // 红色
  PATCH: '\x1b[35m',   // 紫色
  DEFAULT: '\x1b[37m'  // 白色
};

// 状态码颜色
const STATUS_COLORS = {
  SUCCESS: '\x1b[32m',      // 2xx - 绿色
  REDIRECT: '\x1b[36m',     // 3xx - 青色
  CLIENT_ERROR: '\x1b[33m', // 4xx - 黄色
  SERVER_ERROR: '\x1b[31m'  // 5xx - 红色
};

// 响应时间颜色
const DURATION_COLORS = {
  FAST: '\x1b[32m',    // < 100ms - 绿色
  MEDIUM: '\x1b[33m',  // < 500ms - 黄色
  SLOW: '\x1b[31m'     // >= 500ms - 红色
};

const RESET_COLOR = '\x1b[0m';

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

  // 过滤掉获取作者作品的API请求
  const isArtistArtworksQuery = /^\/api\/artist\/\d+\/artworks/.test(req.path);

  // 过滤掉作品详情请求
  const isArtworkDetailQuery = /^\/api\/artwork\/\d+/.test(req.path);

  // 过滤掉仓库下载检查请求
  const isRepositoryCheckDownloadedQuery = /^\/api\/repository\/check-downloaded\/\d+/.test(req.path);

  // 只记录重要的API请求，排除静态资源、图片代理、下载任务查询、仓库预览、健康检查、作者作品查询、作品详情和仓库下载检查
  if (!isStaticResource && !isImageProxy && !isDownloadTasksQuery && !isRepositoryPreview && !isHealthCheck && !isArtistArtworksQuery && !isArtworkDetailQuery && !isRepositoryCheckDownloadedQuery) {
    const start = Date.now();

    // 原始响应结束方法
    const originalEnd = res.end;

    // 重写响应结束方法以获取响应时间
    res.end = function (chunk, encoding) {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const method = req.method;
      const url = req.originalUrl;

      // 获取方法颜色
      const methodColor = METHOD_COLORS[method] || METHOD_COLORS.DEFAULT;
      
      // 获取状态码颜色
      let statusColor;
      if (statusCode >= 200 && statusCode < 300) {
        statusColor = STATUS_COLORS.SUCCESS;
      } else if (statusCode >= 300 && statusCode < 400) {
        statusColor = STATUS_COLORS.REDIRECT;
      } else if (statusCode >= 400 && statusCode < 500) {
        statusColor = STATUS_COLORS.CLIENT_ERROR;
      } else {
        statusColor = STATUS_COLORS.SERVER_ERROR;
      }
      
      // 获取响应时间颜色
      let durationColor;
      if (duration < 100) {
        durationColor = DURATION_COLORS.FAST;
      } else if (duration < 500) {
        durationColor = DURATION_COLORS.MEDIUM;
      } else {
        durationColor = DURATION_COLORS.SLOW;
      }
      
      // 输出彩色日志
      logger.info(`${methodColor}[${method}]${RESET_COLOR} ${url} ${statusColor}${statusCode}${RESET_COLOR} ${durationColor}${duration}ms${RESET_COLOR}`);

      // 调用原始的end方法
      originalEnd.call(this, chunk, encoding);
    };
  }

  next();
}

module.exports = { loggerMiddleware };