const express = require('express');
const WatchlistManager = require('../config/watchlist-manager');
const ResponseUtil = require('../utils/response');
const { defaultLogger } = require('../utils/logger');
const CacheConfigManager = require('../config/cache-config');
const WatchlistDatabase = require('../database/watchlist-database');

const router = express.Router();
const logger = defaultLogger.child('WatchlistRouter');
const watchlistManager = new WatchlistManager();
const cacheConfigManager = new CacheConfigManager();
let watchlistDb = null; // 延迟初始化

// 获取当前存储模式
async function getStorageMode() {
  try {
    await cacheConfigManager.initialize();
    const config = await cacheConfigManager.loadConfig();
    return config.watchlist?.storageMode === 'database' ? 'database' : 'json';
  } catch (e) {
    logger.warn('读取待看名单存储模式失败，回退到json:', e.message);
    return 'json';
  }
}

// 获取数据库适配器（复用Registry连接）
async function getDbAdapter(req) {
  const dbm = req.backend?.databaseManager;
  if (!dbm) return null;
  if (!watchlistDb) {
    watchlistDb = new WatchlistDatabase(dbm);
    await watchlistDb.init();
  }
  return watchlistDb;
}

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
    const mode = await getStorageMode();
    if (mode === 'database') {
      const db = await getDbAdapter(req);
      const items = await db.getAllItems();
      return res.json(ResponseUtil.success(items));
    }
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
    
    const item = { url, title: defaultTitle };

    const mode = await getStorageMode();
    if (mode === 'database') {
      const db = await getDbAdapter(req);
      const items = await db.addItem(item);
      return res.json(ResponseUtil.success(items));
    }

    const items = await watchlistManager.addItem(item);
    res.json(ResponseUtil.success(items));
  } catch (error) {
    logger.error('添加待看项目失败:', error);
    res.status(500).json(ResponseUtil.error(error.message));
  }
});

/**
 * 更新待看名单存储配置（仅切换，不做迁移）
 * PUT /api/watchlist/config
 * body: { storageMode: 'json' | 'database' }
 *
 * 注意：必须放在 PUT '/:id' 之前，避免被动态路由拦截！
 */
router.put('/config', async (req, res) => {
  try {
    const { storageMode } = req.body;
    if (!['json', 'database'].includes(storageMode)) {
      return res.status(400).json(ResponseUtil.error('存储模式必须是 json 或 database'));
    }

    // 更新配置
    const current = await cacheConfigManager.loadConfig();
    const updated = await cacheConfigManager.updateConfig({
      ...current,
      watchlist: { ...(current.watchlist || {}), storageMode }
    });

    // 如果切换到数据库模式，确保表已初始化（复用 Registry 的连接）
    if (storageMode === 'database' && req.backend?.databaseManager) {
      const db = await getDbAdapter(req);
      await db.init();
    }

    res.json(ResponseUtil.success({ storageMode: updated.watchlist?.storageMode || 'json' }));
  } catch (error) {
    logger.error('更新待看名单配置失败:', error);
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
    
    const mode = await getStorageMode();
    if (mode === 'database') {
      const db = await getDbAdapter(req);
      const updatedItem = await db.updateItem(id, updates);
      return res.json(ResponseUtil.success(updatedItem));
    }

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
    const mode = await getStorageMode();
    if (mode === 'database') {
      const db = await getDbAdapter(req);
      const items = await db.removeItem(id);
      return res.json(ResponseUtil.success(items));
    }

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

/**
 * 导出待看名单
 * GET /api/watchlist/export
 */
router.get('/export', async (req, res) => {
  try {
    const mode = await getStorageMode();
    let exportItems = [];
    if (mode === 'database') {
      const db = await getDbAdapter(req);
      exportItems = await db.getAllItems();
    } else {
      const data = await watchlistManager.readData();
      exportItems = Array.isArray(data.items) ? data.items : [];
    }
    // 组装导出结构，向后兼容
    const exportData = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      items: exportItems
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="watchlist.json"');
    res.json(ResponseUtil.success(exportData));
  } catch (error) {
    logger.error('导出待看名单失败:', error);
    res.status(500).json(ResponseUtil.error(error.message));
  }
});

/**
 * 导入待看名单
 * POST /api/watchlist/import
 * body: { watchlistData: { items: [...] }, importMode: 'merge' | 'overwrite' }
 */
router.post('/import', async (req, res) => {
  try {
    const { watchlistData, importMode = 'merge' } = req.body;

    if (!watchlistData || !Array.isArray(watchlistData.items)) {
      return res.status(400).json(ResponseUtil.error('缺少有效的待看名单数据'));
    }

    const normalizeItem = (item) => {
      const now = new Date().toISOString();
      return {
        id: item.id?.toString() || Date.now().toString(),
        title: item.title || '待看页面',
        url: item.url,
        createdAt: item.createdAt || now,
        updatedAt: item.updatedAt || now
      };
    };

    const importItems = watchlistData.items
      .filter(i => i && i.url)
      .map(normalizeItem);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    let deletedCount = 0;

    const mode = await getStorageMode();
    let updatedItems = [];

    if (mode === 'database') {
      const db = await getDbAdapter(req);
      if (importMode === 'overwrite') {
        // 覆盖：清空后批量插入
        const before = await db.getAllItems();
        deletedCount = before.length;
        await db.clearAll();
        await db.batchInsert(importItems);
        successCount = importItems.length;
      } else {
        // 合并：按URL去重，仅新增不存在的
        const existingUrlSet = await db.getExistingUrlSet();
        const toInsert = [];
        for (const item of importItems) {
          try {
            if (existingUrlSet.has(item.url)) {
              skipCount++;
              continue;
            }
            toInsert.push(item);
            successCount++;
          } catch (e) {
            errorCount++;
          }
        }
        await db.batchInsert(toInsert);
      }
      updatedItems = await db.getAllItems();
    } else {
      const currentData = await watchlistManager.readData();
      const existingItems = Array.isArray(currentData.items) ? currentData.items : [];
      if (importMode === 'overwrite') {
        // 覆盖：直接保存导入数据为新清单
        deletedCount = existingItems.length;
        const newData = { items: importItems, lastUpdated: new Date().toISOString() };
        await watchlistManager.saveData(newData);
        successCount = importItems.length;
      } else {
        // 合并：按URL去重，仅新增不存在的
        const existingUrlSet = new Set(existingItems.map(i => i.url));
        const merged = [...existingItems];
        for (const item of importItems) {
          try {
            if (existingUrlSet.has(item.url)) {
              skipCount++;
              continue;
            }
            merged.push(item);
            existingUrlSet.add(item.url);
            successCount++;
          } catch (e) {
            errorCount++;
          }
        }
        await watchlistManager.saveData({ items: merged, lastUpdated: new Date().toISOString() });
      }
      updatedItems = await watchlistManager.getAllItems();
    }

    const message = importMode === 'overwrite'
      ? `覆盖导入完成：删除 ${deletedCount} 项，成功添加 ${successCount} 项，失败 ${errorCount} 项`
      : `重合导入完成：成功 ${successCount} 项，跳过 ${skipCount} 项，失败 ${errorCount} 项`;

    res.json(ResponseUtil.success({
      message,
      stats: { successCount, skipCount, errorCount, deletedCount },
      items: updatedItems
    }));
  } catch (error) {
    logger.error('导入待看名单失败:', error);
    res.status(500).json(ResponseUtil.error(error.message));
  }
});

/**
 * 获取待看名单存储配置
 * GET /api/watchlist/config
 */
router.get('/config', async (req, res) => {
  try {
    const mode = await getStorageMode();
    res.json(ResponseUtil.success({ storageMode: mode }));
  } catch (error) {
    logger.error('获取待看名单配置失败:', error);
    res.status(500).json(ResponseUtil.error(error.message));
  }
});

 

module.exports = router;