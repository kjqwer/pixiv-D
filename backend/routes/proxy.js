const express = require('express');
const router = express.Router();
const ImageCacheService = require('../services/image-cache');
const ApiCacheService = require('../services/api-cache');

// 创建缓存服务实例
const imageCache = new ImageCacheService();
const apiCache = new ApiCacheService();

/**
 * 图片代理
 * GET /api/proxy/image
 */
router.get('/image', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Image URL is required'
      });
    }

    const decodedUrl = decodeURIComponent(url);
    
    // 使用缓存服务获取图片
    const imageData = await imageCache.getImage(decodedUrl);
    
    // 设置响应头
    res.set({
      'Content-Type': getContentType(decodedUrl),
      'Cache-Control': 'public, max-age=3600', // 浏览器缓存1小时
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    // 发送图片数据
    res.send(imageData);

  } catch (error) {
    console.error('Image proxy error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load image'
    });
  }
});

/**
 * 缓存管理 - 获取缓存统计信息
 * GET /api/proxy/cache/stats
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = await imageCache.getCacheStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 缓存管理 - 清理所有缓存
 * DELETE /api/proxy/cache
 */
router.delete('/cache', async (req, res) => {
  try {
    await imageCache.clearAllCache();
    res.json({
      success: true,
      message: '所有缓存已清理'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 缓存管理 - 清理过期缓存
 * DELETE /api/proxy/cache/expired
 */
router.delete('/cache/expired', async (req, res) => {
  try {
    await imageCache.cleanupExpiredCache();
    res.json({
      success: true,
      message: '过期缓存已清理'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 缓存管理 - 获取缓存配置
 * GET /api/proxy/cache/config
 */
router.get('/cache/config', async (req, res) => {
  try {
    const config = await imageCache.getConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 缓存管理 - 更新缓存配置
 * PUT /api/proxy/cache/config
 */
router.put('/cache/config', async (req, res) => {
  try {
    const updates = req.body;
    const config = await imageCache.updateConfig(updates);
    res.json({
      success: true,
      data: config,
      message: '缓存配置已更新'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 缓存管理 - 重置缓存配置
 * POST /api/proxy/cache/config/reset
 */
router.post('/cache/config/reset', async (req, res) => {
  try {
    const config = await imageCache.resetConfig();
    res.json({
      success: true,
      data: config,
      message: '缓存配置已重置为默认值'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * API缓存管理 - 获取缓存统计信息
 * GET /api/proxy/api-cache/stats
 */
router.get('/api-cache/stats', async (req, res) => {
  try {
    const stats = await apiCache.getCacheStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * API缓存管理 - 清理所有缓存
 * DELETE /api/proxy/api-cache
 */
router.delete('/api-cache', async (req, res) => {
  try {
    await apiCache.clearAllCache();
    res.json({
      success: true,
      message: '所有API缓存已清理'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * API缓存管理 - 清理过期缓存
 * DELETE /api/proxy/api-cache/expired
 */
router.delete('/api-cache/expired', async (req, res) => {
  try {
    await apiCache.cleanupExpiredCache();
    res.json({
      success: true,
      message: '过期API缓存已清理'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * API缓存管理 - 获取缓存配置
 * GET /api/proxy/api-cache/config
 */
router.get('/api-cache/config', async (req, res) => {
  try {
    const config = await apiCache.getConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * API缓存管理 - 更新缓存配置
 * PUT /api/proxy/api-cache/config
 */
router.put('/api-cache/config', async (req, res) => {
  try {
    const updates = req.body;
    const config = await apiCache.updateConfig(updates);
    res.json({
      success: true,
      data: config,
      message: 'API缓存配置已更新'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * API缓存管理 - 重置缓存配置
 * POST /api/proxy/api-cache/config/reset
 */
router.post('/api-cache/config/reset', async (req, res) => {
  try {
    const config = await apiCache.resetConfig();
    res.json({
      success: true,
      data: config,
      message: 'API缓存配置已重置为默认值'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取文件内容类型
 * @param {string} url 图片URL
 * @returns {string} 内容类型
 */
function getContentType(url) {
  const ext = url.split('.').pop()?.toLowerCase();
  const contentTypeMap = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml'
  };
  
  return contentTypeMap[ext] || 'image/jpeg';
}

module.exports = router; 