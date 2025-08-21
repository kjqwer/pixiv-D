/**
 * 认证中间件
 */
const authMiddleware = (req, res, next) => {
  try {
    // 检查后端是否已登录
    if (!req.backend || !req.backend.isLoggedIn) {
      return res.status(401).json({
        error: true,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // 检查访问令牌是否有效
    const auth = req.backend.getAuth();
    if (!auth || !auth.accessToken) {
      return res.status(401).json({
        error: true,
        message: 'Invalid access token',
        code: 'INVALID_TOKEN'
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 可选的认证中间件（不强制要求登录）
 */
const optionalAuthMiddleware = (req, res, next) => {
  try {
    // 如果后端已登录，将用户信息添加到请求对象
    if (req.backend && req.backend.isLoggedIn) {
      req.user = req.backend.config.user;
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware
}; 