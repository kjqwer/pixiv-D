const express = require('express');
const router = express.Router();
const DownloadService = require('../services/download');

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
      format = 'auto'
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
    
    const downloadService = req.backend.getDownloadService();
    const progress = downloadService.getTaskProgress(taskId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    res.json({
      success: true,
      data: progress
    });
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
    const tasks = downloadService.getAllTasks();
    
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 取消下载任务
 * POST /api/download/cancel/:taskId
 */
router.post('/cancel/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const downloadService = req.backend.getDownloadService();
    const result = await downloadService.cancelTask(taskId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Task cancelled successfully'
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
    const { limit = 50, offset = 0 } = req.query;
    
    const downloadService = req.backend.getDownloadService();
    const history = downloadService.getDownloadHistory(parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      data: history
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

module.exports = router; 