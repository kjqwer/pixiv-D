/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  console.error('错误详情:', err);
  
  // 默认错误信息
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = null;
  
  // 根据错误类型设置状态码和消息
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    details = err.message;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not Found';
  } else if (err.code === 'ENOTFOUND') {
    statusCode = 503;
    message = 'Service Unavailable';
    details = 'Network connection failed';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Service Unavailable';
    details = 'Connection refused';
  } else if (err.response) {
    // Axios 错误
    statusCode = err.response.status || 500;
    message = err.response.statusText || 'Request Failed';
    details = err.response.data;
  } else if (err.message) {
    message = err.message;
  }
  
  // 构建错误响应
  const errorResponse = {
    error: true,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  };
  
  // 在开发环境下添加详细信息
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = details;
    errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
};

module.exports = { errorHandler }; 