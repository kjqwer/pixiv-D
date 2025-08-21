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
    
    const downloadService = new DownloadService(req.backend.getAuth());
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
    
    const downloadService = new DownloadService(req.backend.getAuth());
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
      filter = 'for_ios',
      size = 'original',
      quality = 'high',
      format = 'auto',
      limit = 50,
      concurrent = 3
    } = req.body;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artist ID'
      });
    }
    
    const downloadService = new DownloadService(req.backend.getAuth());
    const result = await downloadService.downloadArtistArtworks(parseInt(id), {
      type,
      filter,
      size,
      quality,
      format,
      limit: parseInt(limit),
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
 * 获取下载进度
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
    
    const downloadService = new DownloadService(req.backend.getAuth());
    const result = await downloadService.getDownloadProgress(taskId);
    
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
 * 取消下载任务
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
    
    const downloadService = new DownloadService(req.backend.getAuth());
    const result = await downloadService.cancelDownload(taskId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Download task cancelled successfully'
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
    const { 
      offset = 0, 
      limit = 20 
    } = req.query;
    
    const downloadService = new DownloadService(req.backend.getAuth());
    const result = await downloadService.getDownloadHistory({
      offset: parseInt(offset),
      limit: parseInt(limit)
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

module.exports = router; 