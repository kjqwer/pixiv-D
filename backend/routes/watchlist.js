const express = require('express');
const WatchlistManager = require('../config/watchlist-manager');
const ResponseUtil = require('../utils/response');
const { defaultLogger } = require('../utils/logger');

const router = express.Router();
const logger = defaultLogger.child('WatchlistRouter');
const watchlistManager = new WatchlistManager();

// 初始化待看名单
watchlistManager.initialize().catch(error => {
  logger.error('待看名单初始化失败:', error);
});

/**
 * 获取所有待看项目
 * GET /api/watchlist
 */
router.get('/', async (req, res) => {
  try {
    const items = await watchlistManager.getAllItems();
    res.json(ResponseUtil.success(items));
  } catch (error) {
    logger.error('获取待看名单失败:', error);
    res.status(500).json(ResponseUtil.error(error.message));
  }
});

/**
 * 添加待看项目
 * POST /api/watchlist
 */
router.post('/', async (req, res) => {
  try {
    const { url, title } = req.body;
    
    if (!url) {
      return res.status(400).json(ResponseUtil.error('URL是必填项'));
    }
    
    // 如果没有提供标题，尝试从URL生成默认标题
    let defaultTitle = title;
    if (!defaultTitle) {
      try {
        // 从URL路径生成默认标题
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.split('/').filter(segment => segment);
        
        if (pathSegments.length >= 1) {
          const type = pathSegments[0]; // 例如 "artist" 或 "artwork"
          
          if (pathSegments.length >= 2) {
            const id = pathSegments[1];
            
            if (type === 'artist') {
              defaultTitle = `作者 ${id}`;
            } else if (type === 'artwork') {
              defaultTitle = `作品 ${id}`;
            } else if (type === 'search') {
              // 处理搜索页面
              const keywordMatch = urlObj.search.match(/keyword=([^&]+)/);
              if (keywordMatch) {
                defaultTitle = `搜索: ${decodeURIComponent(keywordMatch[1])}`;
              } else {
                defaultTitle = '搜索页面';
              }
            } else {
              defaultTitle = `${type} ${id}`;
            }
            
            // 如果有页面参数，加上页面信息
            if (urlObj.search.includes('page=')) {
              const pageMatch = urlObj.search.match(/page=(\d+)/);
              if (pageMatch) {
                defaultTitle += ` - 第${pageMatch[1]}页`;
              }
            }
          } else {
            // 只有一级路径的情况
            switch (type) {
              case 'search':
                const keywordMatch = urlObj.search.match(/keyword=([^&]+)/);
                if (keywordMatch) {
                  defaultTitle = `搜索: ${decodeURIComponent(keywordMatch[1])}`;
                } else {
                  defaultTitle = '搜索页面';
                }
                break;
              case 'ranking':
                const modeMatch = urlObj.search.match(/mode=([^&]+)/);
                if (modeMatch) {
                  const modeMap = { day: '日榜', week: '周榜', month: '月榜' };
                  defaultTitle = `排行榜 - ${modeMap[modeMatch[1]] || modeMatch[1]}`;
                } else {
                  defaultTitle = '排行榜';
                }
                break;
              case 'bookmarks':
                defaultTitle = '我的收藏';
                break;
              case 'artists':
                defaultTitle = '作者管理';
                break;
              case 'downloads':
                defaultTitle = '下载管理';
                break;
              case 'repository':
                defaultTitle = '仓库管理';
                break;
              default:
                defaultTitle = `${type}页面`;
            }
          }
        } else {
          defaultTitle = '首页';
        }
      } catch (error) {
        // 如果URL解析失败，使用简单的默认标题
        defaultTitle = '待看页面';
      }
    }
    
    const item = {
      url,
      title: defaultTitle
    };
    
    const items = await watchlistManager.addItem(item);
    res.json(ResponseUtil.success(items));
  } catch (error) {
    logger.error('添加待看项目失败:', error);
    res.status(500).json(ResponseUtil.error(error.message));
  }
});

/**
 * 更新待看项目
 * PUT /api/watchlist/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // 移除不应该被更新的字段
    delete updates.id;
    delete updates.createdAt;
    
    const updatedItem = await watchlistManager.updateItem(id, updates);
    res.json(ResponseUtil.success(updatedItem));
  } catch (error) {
    logger.error('更新待看项目失败:', error);
    if (error.message === '待看项目不存在') {
      res.status(404).json(ResponseUtil.error(error.message));
    } else {
      res.status(500).json(ResponseUtil.error(error.message));
    }
  }
});

/**
 * 删除待看项目
 * DELETE /api/watchlist/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const items = await watchlistManager.removeItem(id);
    res.json(ResponseUtil.success(items));
  } catch (error) {
    logger.error('删除待看项目失败:', error);
    if (error.message === '待看项目不存在') {
      res.status(404).json(ResponseUtil.error(error.message));
    } else {
      res.status(500).json(ResponseUtil.error(error.message));
    }
  }
});

module.exports = router; 