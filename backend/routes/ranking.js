const express = require('express');
const ArtworkService = require('../services/artwork');
const ResponseUtil = require('../utils/response');
const { defaultLogger } = require('../utils/logger');

const router = express.Router();
const logger = defaultLogger.child('RankingRouter');


/**
 * 获取排行榜数据
 * GET /api/ranking
 * 参数: mode (day/week/month), type (art/manga/novel), offset, limit
 */
router.get('/', async (req, res) => {
  try {
    const { mode = 'day', type = 'art', offset = 0, limit = 30 } = req.query;
    
    // 验证参数
    if (!['day', 'week', 'month'].includes(mode)) {
      return res.status(400).json(ResponseUtil.error('无效的时间模式'));
    }
    
    if (!['art', 'manga', 'novel'].includes(type)) {
      return res.status(400).json(ResponseUtil.error('无效的作品类型'));
    }
    
    // 创建作品服务实例，传入认证信息
    const artworkService = new ArtworkService(req.backend.auth);
    
    const result = await artworkService.getRankingArtworks({
      mode,
      content: type,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
    
    res.json(ResponseUtil.success(result));
  } catch (error) {
    logger.error('获取排行榜失败:', error);
    res.status(500).json(ResponseUtil.error(error.message));
  }
});

module.exports = router; 