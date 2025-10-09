const express = require('express');
const router = express.Router();
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('SystemRouter');

/**
 * 重启服务器
 * POST /api/system/restart
 */
router.post('/restart', async (req, res) => {
  try {
    logger.info('收到重启请求');
    
    // 立即返回响应，避免客户端等待超时
    res.json({
      success: true,
      message: '服务器正在重启，请稍后刷新页面'
    });
    
    // 延迟执行重启，给响应时间发送
    setTimeout(async () => {
      try {
        // 获取服务器实例
        const server = req.app.locals.serverInstance;
        if (server && typeof server.restart === 'function') {
          logger.info('开始执行服务器重启...');
          await server.restart();
        } else {
          logger.error('无法获取服务器实例或重启方法');
          // 如果无法优雅重启，则退出进程让进程管理器重启
          logger.info('尝试直接退出进程进行重启');
          process.exit(1);
        }
      } catch (error) {
        logger.error('重启失败:', error);
        // 强制退出进程
        logger.info('重启失败，强制退出进程');
        process.exit(1);
      }
    }, 1000); // 延迟1秒执行重启
    
  } catch (error) {
    logger.error('处理重启请求失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取系统状态
 * GET /api/system/status
 */
router.get('/status', (req, res) => {
  try {
    const status = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('获取系统状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;