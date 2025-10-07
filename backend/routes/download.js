const express = require('express');
const router = express.Router();
const DownloadService = require('../services/download');
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('DownloadRouter');


/**
 * 下载单个作品
 * POST /api/download/artwork/:id
 */
router.post('/artwork/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      size = 'original',
      quality = 'high',
      format = 'auto',
      skipExisting = true
    } = req.body;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artwork ID'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.downloadArtwork(parseInt(id), {
      size,
      quality,
      format,
      skipExisting
    });
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('下载路由错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量下载作品
 * POST /api/download/artworks
 */
router.post('/artworks', async (req, res) => {
  try {
    const { 
      artworkIds, 
      size = 'original',
      quality = 'high',
      format = 'auto',
      concurrent = 3
    } = req.body;
    
    if (!artworkIds || !Array.isArray(artworkIds) || artworkIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Artwork IDs array is required'
      });
    }
    
    if (artworkIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 artworks can be downloaded at once'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.downloadMultipleArtworks(artworkIds, {
      size,
      quality,
      format,
      concurrent: parseInt(concurrent)
    });
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 下载作者作品
 * POST /api/download/artist/:id
 */
router.post('/artist/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      type = 'art',
      limit = 50,
      size = 'original',
      quality = 'high',
      format = 'auto'
    } = req.body;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artist ID'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.downloadArtistArtworks(parseInt(id), {
      type,
      limit: parseInt(limit),
      size,
      quality,
      format
    });
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 下载排行榜作品
 * POST /api/download/ranking
 */
router.post('/ranking', async (req, res) => {
  try {
    const { 
      mode = 'day',
      type = 'art',
      limit = 50,
      size = 'original',
      quality = 'high',
      format = 'auto'
    } = req.body;
    
    // 验证参数
    if (!['day', 'week', 'month'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be day, week, or month'
      });
    }
    
    if (!['art', 'manga', 'novel'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type. Must be art, manga, or novel'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.downloadRankingArtworks({
      mode,
      type,
      limit: parseInt(limit),
      size,
      quality,
      format
    });
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取任务进度
 * GET /api/download/progress/:taskId
 */
router.get('/progress/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.getTaskProgress(taskId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取所有任务
 * GET /api/download/tasks
 */
router.get('/tasks', async (req, res) => {
  try {
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.getAllTasks();
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取活跃任务（下载中或暂停）
 * GET /api/download/tasks/active
 */
router.get('/tasks/active', async (req, res) => {
  try {
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.getActiveTasks();
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取任务摘要（用于快速状态检查）
 * GET /api/download/tasks/summary
 */
router.get('/tasks/summary', async (req, res) => {
  try {
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.getTasksSummary();
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取任务变更（增量更新）
 * GET /api/download/tasks/changes?since=timestamp
 */
router.get('/tasks/changes', async (req, res) => {
  try {
    const { since } = req.query;
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.getTasksChanges(since ? parseInt(since) : null);
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取已完成任务（分页）
 * GET /api/download/tasks/completed?offset=0&limit=50
 */
router.get('/tasks/completed', async (req, res) => {
  try {
    const { offset = 0, limit = 50 } = req.query;
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.getCompletedTasks(parseInt(offset), parseInt(limit));
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 暂停任务
 * POST /api/download/pause/:taskId
 */
router.post('/pause/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.pauseTask(taskId);
    
    if (result.success) {
      res.json({
        success: true,
        message: '任务已暂停'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 恢复任务
 * POST /api/download/resume/:taskId
 */
router.post('/resume/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.resumeTask(taskId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: '任务已恢复'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 暂停批量下载任务
 * POST /api/download/batch/pause/:taskId
 */
router.post('/batch/pause/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.pauseBatchTask(taskId);
    
    if (result.success) {
      res.json({
        success: true,
        message: '批量下载任务已暂停'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 恢复批量下载任务
 * POST /api/download/batch/resume/:taskId
 */
router.post('/batch/resume/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.resumeBatchTask(taskId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: '批量下载任务已恢复'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 取消任务
 * DELETE /api/download/cancel/:taskId
 */
router.delete('/cancel/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.cancelTask(taskId);
    
    if (result.success) {
      res.json({
        success: true,
        message: '任务已取消'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取下载历史
 * GET /api/download/history
 */
router.get('/history', async (req, res) => {
  try {
    const { offset = 0, limit = 50 } = req.query;
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.getDownloadHistory(parseInt(offset), parseInt(limit));
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取下载的文件列表
 * GET /api/download/files
 */
router.get('/files', async (req, res) => {
  try {
    const downloadService = req.backend.getDownloadService();
    const files = await downloadService.getDownloadedFiles();
    
    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 检查作品是否已下载
 * GET /api/download/check/:artworkId
 */
router.get('/check/:artworkId', async (req, res) => {
  try {
    const { artworkId } = req.params;
    
    if (!artworkId || isNaN(parseInt(artworkId))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artwork ID'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const isDownloaded = await downloadService.isArtworkDownloaded(parseInt(artworkId));
    
    res.json({
      success: true,
      data: {
        artwork_id: parseInt(artworkId),
        is_downloaded: isDownloaded
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取已下载的作品ID列表
 * GET /api/download/downloaded-ids
 */
router.get('/downloaded-ids', async (req, res) => {
  try {
    const downloadService = req.backend.getDownloadService();
    const downloadedIds = await downloadService.getDownloadedArtworkIds();
    
    res.json({
      success: true,
      data: downloadedIds
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 删除下载的文件
 * DELETE /api/download/files
 */
router.delete('/files', async (req, res) => {
  try {
    const { artist, artwork } = req.body;
    
    if (!artist || !artwork) {
      return res.status(400).json({
        success: false,
        error: 'Artist and artwork names are required'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.deleteDownloadedFiles(artist, artwork);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Files deleted successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * SSE端点 - 实时推送下载进度
 * GET /api/download/stream/:taskId
 */
router.get('/stream/:taskId', (req, res) => {
  const taskId = req.params.taskId;
  
  logger.debug(`SSE连接建立: ${taskId}`, {
    taskId,
    clientIP: req.ip,
    userAgent: req.get('User-Agent')
  });

  // 设置SSE响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // 发送初始连接确认
  res.write('data: {"type":"connected","taskId":"' + taskId + '"}\n\n');

  const downloadService = req.backend.getDownloadService();

  // 创建进度监听器
  const progressListener = (task) => {
    try {
      if (res.writableEnded || res.destroyed || isCleanedUp) {
        logger.debug(`SSE连接已关闭，跳过发送: ${taskId}`);
        return;
      }
      
      const data = JSON.stringify({
        type: 'progress',
        task: task
      });
      
      res.write(`data: ${data}\n\n`);
      logger.debug(`SSE进度更新发送: ${taskId}`, {
        status: task.status,
        progress: task.progress,
        completed: task.completed_files,
        failed: task.failed_files
      });
    } catch (error) {
      // 区分正常断开和异常错误
      if (isNormalDisconnectError(error)) {
        logger.debug(`SSE发送数据时连接正常断开: ${taskId}`, {
          code: error.code,
          message: error.message
        });
      } else {
        logger.error(`SSE发送数据异常失败: ${taskId}`, {
          error: error.message,
          taskId
        });
      }
      // 发送失败时移除监听器并清理连接
      downloadService.removeProgressListener(taskId, progressListener);
      cleanup('progress_send_error');
    }
  };

  // 注册进度监听器
  downloadService.addProgressListener(taskId, progressListener);

  // 设置连接超时 - 增加到60秒，并添加心跳机制
  let connectionTimeout;
  let heartbeatInterval;
  
  const resetTimeout = () => {
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
    }
    connectionTimeout = setTimeout(() => {
      logger.info(`SSE连接超时，关闭连接: ${taskId}`);
      cleanup('connection_timeout');
      if (!res.writableEnded && !isCleanedUp) {
        try {
          res.write('data: {"type":"timeout"}\n\n');
          res.end();
        } catch (error) {
          // 忽略写入已关闭连接的错误
          logger.debug(`SSE连接已关闭，无法发送超时消息: ${taskId}`);
        }
      }
    }, 60000); // 60秒超时
  };

  // 启动心跳机制
  heartbeatInterval = setInterval(() => {
    try {
      if (!res.writableEnded && !res.destroyed && !isCleanedUp) {
        res.write('data: {"type":"heartbeat"}\n\n');
        resetTimeout(); // 心跳时重置超时
      } else {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    } catch (error) {
      // 区分正常断开和异常错误
      if (isNormalDisconnectError(error)) {
        logger.debug(`SSE心跳发送时连接正常断开: ${taskId}`, {
          code: error.code,
          message: error.message
        });
      } else {
        logger.warn(`SSE心跳发送异常失败: ${taskId}`, error);
      }
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
      cleanup('heartbeat_error');
    }
  }, 15000); // 每15秒发送心跳

  resetTimeout();

  // 连接状态跟踪
  let isCleanedUp = false;
  let isNormalDisconnect = false;

  // 清理函数
  const cleanup = (reason = 'unknown') => {
    if (isCleanedUp) {
      return; // 避免重复清理
    }
    isCleanedUp = true;

    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    downloadService.removeProgressListener(taskId, progressListener);
    logger.debug(`SSE连接清理完成: ${taskId}`, { reason });
  };

  // 判断是否为正常断开连接的错误
  const isNormalDisconnectError = (error) => {
    if (!error) return false;
    
    // 常见的正常断开连接错误码
    const normalErrorCodes = [
      'ECONNRESET',    // 连接被重置
      'EPIPE',         // 管道破裂
      'ECONNABORTED',  // 连接被中止
      'ECANCELED'      // 请求被取消
    ];
    
    return normalErrorCodes.includes(error.code) || 
           error.message === 'aborted' ||
           error.message.includes('aborted');
  };

  // 监听客户端断开连接
  req.on('close', () => {
    isNormalDisconnect = true;
    logger.debug(`SSE客户端断开连接: ${taskId}`);
    cleanup('client_close');
  });

  req.on('error', (error) => {
    if (isNormalDisconnectError(error)) {
      // 正常断开连接，使用debug级别日志
      logger.debug(`SSE客户端正常断开: ${taskId}`, { 
        code: error.code, 
        message: error.message 
      });
    } else {
      // 真正的异常错误，使用error级别日志
      logger.error(`SSE请求异常错误: ${taskId}`, error);
    }
    cleanup('request_error');
  });

  res.on('error', (error) => {
    if (isNormalDisconnectError(error)) {
      // 正常断开连接，使用debug级别日志
      logger.debug(`SSE响应正常断开: ${taskId}`, { 
        code: error.code, 
        message: error.message 
      });
    } else {
      // 真正的异常错误，使用error级别日志
      logger.error(`SSE响应异常错误: ${taskId}`, error);
    }
    cleanup('response_error');
  });

  res.on('close', () => {
    logger.debug(`SSE响应关闭: ${taskId}`);
    cleanup('response_close');
  });

  // 检查任务状态，如果任务已完成则立即关闭连接
  const task = downloadService.getTask(taskId);
  if (task && ['completed', 'failed', 'cancelled', 'partial'].includes(task.status)) {
    logger.debug(`任务已完成，关闭SSE连接: ${taskId}`, { status: task.status });
    setTimeout(() => {
      cleanup('task_completed');
      if (!res.writableEnded && !isCleanedUp) {
        try {
          res.write(`data: {"type":"completed","status":"${task.status}"}\n\n`);
          res.end();
        } catch (error) {
          // 忽略写入已关闭连接的错误
          logger.debug(`SSE连接已关闭，无法发送完成消息: ${taskId}`);
        }
      }
    }, 1000); // 延迟1秒关闭，确保最后的状态更新被发送
  }
});

/**
 * 清理历史记录
 * POST /api/download/cleanup/history
 */
router.post('/cleanup/history', async (req, res) => {
  try {
    const { keepCount = 500 } = req.body;
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.cleanupHistory(parseInt(keepCount));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 清理已完成的任务
 * POST /api/download/cleanup/tasks
 */
router.post('/cleanup/tasks', async (req, res) => {
  try {
    const { keepActive = true, keepCompleted = 100 } = req.body;
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.cleanupTasks(keepActive, parseInt(keepCompleted));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取系统统计信息
 * GET /api/download/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.getSystemStats();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取下载注册表统计信息
 * GET /api/download/registry/stats
 */
router.get('/registry/stats', async (req, res) => {
  try {
    const downloadService = req.backend.getDownloadService();
    const stats = await downloadService.downloadRegistry.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('获取下载注册表统计信息失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 导出下载注册表
 * GET /api/download/registry/export
 */
router.get('/registry/export', async (req, res) => {
  try {
    const downloadService = req.backend.getDownloadService();
    const registryData = await downloadService.downloadRegistry.exportRegistry();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="download-registry.json"');
    res.json(registryData);
  } catch (error) {
    logger.error('导出下载注册表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 导入下载注册表
 * POST /api/download/registry/import
 */
router.post('/registry/import', async (req, res) => {
  try {
    const { registryData } = req.body;
    
    if (!registryData) {
      return res.status(400).json({
        success: false,
        error: '缺少注册表数据'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.downloadRegistry.importRegistry(registryData);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('导入下载注册表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 手动全盘扫描更新注册表
 * POST /api/download/registry/rebuild
 */
router.post('/registry/rebuild', async (req, res) => {
  try {
    const downloadService = req.backend.getDownloadService();
    const fileManager = downloadService.fileManager;
    
    // 生成任务ID
    const taskId = `registry-rebuild-${Date.now()}`;
    
    // 立即返回任务ID，不等待完成
    res.json({
      success: true,
      data: {
        taskId,
        status: 'started',
        message: '注册表重建任务已启动'
      }
    });
    
    // 异步执行重建任务
    setImmediate(async () => {
      try {
        // 设置任务状态为进行中
        global.registryRebuildTasks = global.registryRebuildTasks || new Map();
        global.registryRebuildTasks.set(taskId, {
          status: 'running',
          startTime: Date.now(),
          progress: {
            scannedArtists: 0,
            scannedArtworks: 0,
            addedArtworks: 0,
            skippedArtworks: 0,
            currentArtist: null
          }
        });
        
        const result = await downloadService.downloadRegistry.rebuildFromFileSystem(fileManager, taskId);
        
        // 更新任务状态为完成
        global.registryRebuildTasks.set(taskId, {
          status: 'completed',
          startTime: global.registryRebuildTasks.get(taskId).startTime,
          endTime: Date.now(),
          result: result
        });
        
        logger.info(`注册表重建任务完成: ${taskId}`, result);
      } catch (error) {
        logger.error(`注册表重建任务失败: ${taskId}`, error);
        
        // 更新任务状态为失败
        global.registryRebuildTasks.set(taskId, {
          status: 'failed',
          startTime: global.registryRebuildTasks.get(taskId).startTime,
          endTime: Date.now(),
          error: error.message
        });
      }
    });
    
  } catch (error) {
    logger.error('启动注册表重建任务失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取注册表重建任务状态
 * GET /api/download/registry/rebuild/status/:taskId
 */
router.get('/registry/rebuild/status/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    global.registryRebuildTasks = global.registryRebuildTasks || new Map();
    const task = global.registryRebuildTasks.get(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    logger.error('获取注册表重建任务状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 取消注册表重建任务
 * DELETE /api/download/registry/rebuild/:taskId
 */
router.delete('/registry/rebuild/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    global.registryRebuildTasks = global.registryRebuildTasks || new Map();
    const task = global.registryRebuildTasks.get(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    if (task.status === 'running') {
      // 标记任务为已取消
      global.registryRebuildTasks.set(taskId, {
        ...task,
        status: 'cancelled',
        endTime: Date.now()
      });
    }
    
    res.json({
      success: true,
      data: {
        message: '任务已取消'
      }
    });
  } catch (error) {
    logger.error('取消注册表重建任务失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取下载检测配置
 * GET /api/download/registry/config
 */
router.get('/registry/config', async (req, res) => {
  try {
    const downloadService = req.backend.getDownloadService();
    const config = await downloadService.cacheConfigManager.loadConfig();
    
    // 提取下载相关的配置
    const downloadConfig = {
      useRegistryCheck: config.download?.useRegistryCheck !== false, // 默认启用
      fallbackToScan: config.download?.fallbackToScan === true // 默认不启用
    };
    
    res.json({
      success: true,
      data: downloadConfig
    });
  } catch (error) {
    logger.error('获取下载检测配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新下载检测配置
 * PUT /api/download/registry/config
 */
router.put('/registry/config', async (req, res) => {
  try {
    const { useRegistryCheck, fallbackToScan } = req.body;
    
    if (typeof useRegistryCheck !== 'boolean' || typeof fallbackToScan !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: '配置参数必须是布尔值'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    
    // 更新配置
    const updatedConfig = await downloadService.cacheConfigManager.updateConfig({
      download: {
        useRegistryCheck,
        fallbackToScan
      }
    });
    
    res.json({
      success: true,
      data: {
        useRegistryCheck: updatedConfig.download?.useRegistryCheck !== false,
        fallbackToScan: updatedConfig.download?.fallbackToScan === true
      }
    });
  } catch (error) {
    logger.error('更新下载检测配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;