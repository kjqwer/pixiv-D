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
      tags,
      type = 'all', 
      sort = 'date_desc', 
      duration = 'all',
      offset = 0,
      limit = 30
    } = req.query;
    
    // 处理标签参数
    let tagsArray = [];
    if (tags) {
      if (Array.isArray(tags)) {
        tagsArray = tags;
      } else {
        tagsArray = [tags];
      }
    }
    
    if (!keyword && (!tagsArray || tagsArray.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Search keyword or tags are required'
      });
    }
    
    const artworkService = new ArtworkService(req.backend.getAuth());
    const result = await artworkService.searchArtworks({
      keyword,
      tags: tagsArray,
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
 * 获取用户收藏的作品列表
 * GET /api/artwork/bookmarks
 */
router.get('/bookmarks', async (req, res) => {
  try {
    const { 
      type = 'all',
      offset = 0,
      limit = 30
    } = req.query;
    
    const artworkService = new ArtworkService(req.backend.getAuth());
    const result = await artworkService.getBookmarks({
      type,
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

/**
 * 收藏/取消收藏作品
 * POST /api/artwork/:id/bookmark
 */
router.post('/:id/bookmark', async (req, res) => {
  try {
    const { id } = req.params;
    const { action = 'add' } = req.body; // 'add' 或 'remove'
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artwork ID'
      });
    }
    
    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be "add" or "remove"'
      });
    }
    
    const artworkService = new ArtworkService(req.backend.getAuth());
    const result = await artworkService.toggleBookmark(parseInt(id), action);
    
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
 * 获取相关推荐作品
 * GET /api/artwork/:id/related
 */
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const { offset = 0, limit = 30 } = req.query;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artwork ID'
      });
    }
    
    const artworkService = new ArtworkService(req.backend.getAuth());
    const result = await artworkService.getRelatedArtworks(parseInt(id), {
      offset: parseInt(offset),
      limit: parseInt(limit)
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

module.exports = router; 