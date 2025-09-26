/**
 * 后端实例注入中间件
 * 将PixivBackend实例注入到请求对象中，供后续中间件和路由处理器使用
 */

function backendInjector(backend) {
  return (req, res, next) => {
    req.backend = backend;
    next();
  };
}

module.exports = { backendInjector };