const express = require('express');
const router = express.Router();
const DownloadService = require('../services/download');

/**
 * 下载单个作品
 * POST /api/download/artwork/:id
 */
router.post('/artwork/:id', async (req, res) => {
  try {
    console.log(`收到下载请求: 作品ID ${req.params.id}`);
    const { id } = req.params;
    const { 
      size = 'original',
      quality = 'high',
      format = 'auto',
      skipExisting = true
    } = req.body;
    
    console.log(`下载参数: size=${size}, quality=${quality}, format=${format}, skipExisting=${skipExisting}`);
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artwork ID'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    console.log('开始调用下载服务...');
    const result = await downloadService.downloadArtwork(parseInt(id), {
      size,
      quality,
      format,
      skipExisting
    });
    
    console.log('下载服务返回结果:', result);
    
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
    console.error('下载路由错误:', error);
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
router.get('/stream/:taskId', async (req, res) => {
  const { taskId } = req.params;
  
  if (!taskId) {
    return res.status(400).json({
      success: false,
      error: 'Task ID is required'
    });
  }

  // 设置SSE头部
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const downloadService = req.backend.getDownloadService();
  
  // 创建进度监听器
  const progressListener = (task) => {
    if (task.id === taskId) {
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        data: task
      })}\n\n`);
      
      // 如果任务完成，关闭连接
      if (['completed', 'failed', 'cancelled', 'partial'].includes(task.status)) {
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          data: task
        })}\n\n`);
        res.end();
        downloadService.removeProgressListener(taskId, progressListener);
      }
    }
  };

  // 注册监听器
  downloadService.addProgressListener(taskId, progressListener);

  // 立即发送当前状态
  const currentTask = downloadService.getTask(taskId);
  if (currentTask) {
    res.write(`data: ${JSON.stringify({
      type: 'progress',
      data: currentTask
    })}\n\n`);
  }

  // 客户端断开连接时清理
  req.on('close', () => {
    downloadService.removeProgressListener(taskId, progressListener);
  });
});

module.exports = router; 