const express = require('express');
const router = express.Router();
const ArtistService = require('../services/artist');

/**
 * 搜索作者
 * GET /api/artist/search
 */
router.get('/search', async (req, res) => {
  try {
    const { keyword, offset = 0, limit = 30 } = req.query;
    
    if (!keyword || keyword.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '搜索关键词不能为空'
      });
    }
    
    const artistService = new ArtistService(req.backend.getAuth());
    const result = await artistService.searchArtists({
      keyword: keyword.trim(),
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
    
    if (result.success) {
      // 转换数据格式以匹配前端期望
      const artists = (result.data.users || []).map(user => ({
        id: user.user.id,
        name: user.user.name,
        account: user.user.account,
        profile_image_urls: user.user.profile_image_urls,
        is_followed: user.user.is_followed || false
      }));

      res.json({
        success: true,
        data: {
          artists,
          total: artists.length
        }
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
 * 获取当前用户关注的作者列表
 * GET /api/artist/following
 */
router.get('/following', async (req, res) => {
  try {
    const { restrict = 'public' } = req.query;
    
    const artistService = new ArtistService(req.backend.getAuth());
    const result = await artistService.getFollowingArtists({
      restrict
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
 * 获取作者作品列表
 * GET /api/artist/:id/artworks
 */
router.get('/:id/artworks', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      type = 'art', 
      filter = 'for_ios', 
      offset = 0, 
      limit = 30 
    } = req.query;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artist ID'
      });
    }
    
    const artistService = new ArtistService(req.backend.getAuth());
    const result = await artistService.getArtistArtworks(parseInt(id), {
      type,
      filter,
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

/**
 * 获取作者关注列表
 * GET /api/artist/:id/following
 */
router.get('/:id/following', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      restrict = 'public', 
      offset = 0, 
      limit = 30 
    } = req.query;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artist ID'
      });
    }
    
    const artistService = new ArtistService(req.backend.getAuth());
    const result = await artistService.getArtistFollowing(parseInt(id), {
      restrict,
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

/**
 * 获取作者粉丝列表
 * GET /api/artist/:id/followers
 */
router.get('/:id/followers', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      offset = 0, 
      limit = 30 
    } = req.query;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artist ID'
      });
    }
    
    const artistService = new ArtistService(req.backend.getAuth());
    const result = await artistService.getArtistFollowers(parseInt(id), {
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

/**
 * 关注/取消关注作者
 * POST /api/artist/:id/follow
 */
router.post('/:id/follow', async (req, res) => {
  try {
    const { id } = req.params;
    const { action = 'follow' } = req.body;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artist ID'
      });
    }
    
    if (!['follow', 'unfollow'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be "follow" or "unfollow"'
      });
    }
    
    const artistService = new ArtistService(req.backend.getAuth());
    const result = await artistService.followArtist(parseInt(id), action);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Artist ${action === 'follow' ? 'followed' : 'unfollowed'} successfully`
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
 * 获取作者信息
 * GET /api/artist/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid artist ID'
      });
    }
    
    const artistService = new ArtistService(req.backend.getAuth());
    const result = await artistService.getArtistInfo(parseInt(id));
    
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