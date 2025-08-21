const express = require('express');
const router = express.Router();
const ArtworkService = require('../services/artwork');

/**
 * 搜索作品
 * GET /api/artwork/search
 */
router.get('/search', async (req, res) => {
  try {
    const { 
      keyword, 
      type = 'all', 
      sort = 'date_desc', 
      duration = 'all',
      offset = 0,
      limit = 30
    } = req.query;
    
    if (!keyword) {
      return res.status(400).json({
        success: false,
        error: 'Search keyword is required'
      });
    }
    
    const artworkService = new ArtworkService(req.backend.getAuth());
    const result = await artworkService.searchArtworks({
      keyword,
      type,
      sort,
      duration,
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

/**
 * 获取作品详情
 * GET /api/artwork/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { include_user = 'true', include_series = 'false' } = req.query;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artwork ID'
      });
    }
    
    const artworkService = new ArtworkService(req.backend.getAuth());
    const result = await artworkService.getArtworkDetail(parseInt(id), {
      include_user: include_user === 'true',
      include_series: include_series === 'true'
    });
    
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
 * 获取作品预览信息
 * GET /api/artwork/:id/preview
 */
router.get('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artwork ID'
      });
    }
    
    const artworkService = new ArtworkService(req.backend.getAuth());
    const result = await artworkService.getArtworkPreview(parseInt(id));
    
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
 * 获取作品图片URL
 * GET /api/artwork/:id/images
 */
router.get('/:id/images', async (req, res) => {
  try {
    const { id } = req.params;
    const { size = 'medium' } = req.query;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artwork ID'
      });
    }
    
    const artworkService = new ArtworkService(req.backend.getAuth());
    const result = await artworkService.getArtworkImages(parseInt(id), size);
    
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

module.exports = router; 