/**
 * CORS中间件配置
 */
const cors = require('cors');

function corsMiddleware() {
  return cors({
    origin: process.env.FRONTEND_URL || true, // 允许所有来源，或者通过环境变量指定
    credentials: true,
  });
}

module.exports = { corsMiddleware };