const path = require('path');
const fs = require('fs-extra');
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('DownloadRegistry');

/**
 * 下载记录管理器 - 维护已下载作品的JSON记录
 * 用于快速检测作品是否已下载，支持导入导出和多设备同步
 */
class DownloadRegistry {
  constructor(dataPath) {
    this.dataPath = dataPath;
    this.registryPath = path.join(dataPath, 'download_registry.json');
    this.registry = {
      version: '1.0.5',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      artists: {} // 格式: { artistName: { artworks: [artworkId1, artworkId2, ...] } }
    };
    this.loaded = false;
  }

  /**
   * 初始化注册表
   */
  async init() {
    try {
      // 确保数据目录存在
      await fs.ensureDir(this.dataPath);
      
      // 加载现有注册表
      await this.loadRegistry();
      
      logger.info(`下载记录注册表初始化完成，总共包含${Object.keys(this.registry.artists).length}个作者，${this.getTotalArtworkCount()}个工作品`);
    } catch (error) {
      logger.error('下载记录注册表初始化失败:', error);
      throw error;
    }
  }

  /**
   * 加载注册表文件
   */
  async loadRegistry() {
    try {
      if (await fs.pathExists(this.registryPath)) {
        const data = await fs.readJson(this.registryPath);
        
        // 验证数据格式
        if (data && typeof data === 'object' && data.artists) {
          this.registry = {
            version: data.version || '1.0.0',
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.updated_at || new Date().toISOString(),
            artists: data.artists || {}
          };
        } else {
          logger.warn('注册表文件格式不正确，使用默认格式');
        }
      } else {
        logger.info('注册表文件不存在，将创建新的注册表');
      }
      
      this.loaded = true;
    } catch (error) {
      logger.error('加载注册表文件失败:', error);
      // 使用默认注册表
      this.loaded = true;
    }
  }

  /**
   * 保存注册表到文件
   */
  async saveRegistry() {
    try {
      this.registry.updated_at = new Date().toISOString();
      await fs.writeJson(this.registryPath, this.registry, { spaces: 2 });
      logger.debug('注册表已保存到文件', { path: this.registryPath });
    } catch (error) {
      logger.error('保存注册表失败:', error);
      throw error;
    }
  }

  /**
   * 添加已下载的作品记录
   * @param {string} artistName - 作者名称
   * @param {number|string} artworkId - 作品ID
   */
  async addArtwork(artistName, artworkId) {
    if (!this.loaded) {
      await this.loadRegistry();
    }

    const normalizedArtistName = this.normalizeArtistName(artistName);
    const normalizedArtworkId = parseInt(artworkId);

    if (!this.registry.artists[normalizedArtistName]) {
      this.registry.artists[normalizedArtistName] = {
        artworks: []
      };
    }

    // 检查是否已存在
    if (!this.registry.artists[normalizedArtistName].artworks.includes(normalizedArtworkId)) {
      this.registry.artists[normalizedArtistName].artworks.push(normalizedArtworkId);
      this.registry.artists[normalizedArtistName].artworks.sort((a, b) => b - a); // 按ID倒序排列
      
      await this.saveRegistry();
      logger.debug('添加作品记录', { artistName: normalizedArtistName, artworkId: normalizedArtworkId });
    }
  }

  /**
   * 移除作品记录
   * @param {string} artistName - 作者名称
   * @param {number|string} artworkId - 作品ID
   */
  async removeArtwork(artistName, artworkId) {
    if (!this.loaded) {
      await this.loadRegistry();
    }

    const normalizedArtistName = this.normalizeArtistName(artistName);
    const normalizedArtworkId = parseInt(artworkId);

    logger.debug('开始移除作品记录', { 
      originalArtistName: artistName, 
      normalizedArtistName: normalizedArtistName, 
      artworkId: normalizedArtworkId 
    });

    if (this.registry.artists[normalizedArtistName]) {
      const artworks = this.registry.artists[normalizedArtistName].artworks;
      const index = artworks.indexOf(normalizedArtworkId);
      
      logger.debug('查找作品在注册表中的位置', { 
        artistName: normalizedArtistName, 
        artworkId: normalizedArtworkId, 
        index: index,
        artworks: artworks 
      });
      
      if (index !== -1) {
        artworks.splice(index, 1);
        
        // 如果作者下没有作品了，删除作者记录
        if (artworks.length === 0) {
          delete this.registry.artists[normalizedArtistName];
          logger.info('作者下无作品，删除作者记录', { artistName: normalizedArtistName });
        }
        
        await this.saveRegistry();
        logger.debug('成功移除作品记录', { artistName: normalizedArtistName, artworkId: normalizedArtworkId });
      } else {
        logger.warn('作品在注册表中未找到', { artistName: normalizedArtistName, artworkId: normalizedArtworkId });
      }
    } else {
      logger.warn('作者在注册表中未找到', { artistName: normalizedArtistName });
    }
  }

  /**
   * 检查作品是否已下载
   * @param {number|string} artworkId - 作品ID
   * @returns {boolean} 是否已下载
   */
  async isArtworkDownloaded(artworkId) {
    if (!this.loaded) {
      await this.loadRegistry();
    }

    const normalizedArtworkId = parseInt(artworkId);
    
    // 遍历所有作者查找作品
    for (const artistName in this.registry.artists) {
      if (this.registry.artists[artistName].artworks.includes(normalizedArtworkId)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 获取已下载的作品ID列表
   * @returns {number[]} 作品ID数组
   */
  async getDownloadedArtworkIds() {
    if (!this.loaded) {
      await this.loadRegistry();
    }

    const artworkIds = new Set();
    
    for (const artistName in this.registry.artists) {
      for (const artworkId of this.registry.artists[artistName].artworks) {
        artworkIds.add(artworkId);
      }
    }
    
    return Array.from(artworkIds).sort((a, b) => b - a);
  }

  /**
   * 获取指定作者的已下载作品
   * @param {string} artistName - 作者名称
   * @returns {number[]} 作品ID数组
   */
  async getArtistArtworks(artistName) {
    if (!this.loaded) {
      await this.loadRegistry();
    }

    const normalizedArtistName = this.normalizeArtistName(artistName);
    
    if (this.registry.artists[normalizedArtistName]) {
      return [...this.registry.artists[normalizedArtistName].artworks];
    }
    
    return [];
  }

  /**
   * 获取所有已下载的作者列表
   * @returns {string[]} 作者名称数组
   */
  async getDownloadedArtists() {
    if (!this.loaded) {
      await this.loadRegistry();
    }

    return Object.keys(this.registry.artists);
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    if (!this.loaded) {
      await this.loadRegistry();
    }

    const artists = Object.keys(this.registry.artists);
    const totalArtworks = this.getTotalArtworkCount();
    
    return {
      artistCount: artists.length,
      artworkCount: totalArtworks,
      version: this.registry.version,
      created_at: this.registry.created_at,
      updated_at: this.registry.updated_at
    };
  }

  /**
   * 导出注册表数据
   * @returns {Object} 注册表数据
   */
  async exportRegistry() {
    if (!this.loaded) {
      await this.loadRegistry();
    }

    return {
      ...this.registry,
      exported_at: new Date().toISOString()
    };
  }

  /**
   * 导入注册表数据（增量导入，不覆盖现有数据）
   * @param {Object} importData - 要导入的数据
   * @returns {Object} 导入结果统计
   */
  async importRegistry(importData) {
    if (!this.loaded) {
      await this.loadRegistry();
    }

    if (!importData || !importData.artists) {
      throw new Error('导入数据格式不正确');
    }

    let addedArtists = 0;
    let addedArtworks = 0;
    let skippedArtworks = 0;

    for (const artistName in importData.artists) {
      const normalizedArtistName = this.normalizeArtistName(artistName);
      const importArtworks = importData.artists[artistName].artworks || [];
      
      if (!this.registry.artists[normalizedArtistName]) {
        this.registry.artists[normalizedArtistName] = { artworks: [] };
        addedArtists++;
      }

      const existingArtworks = new Set(this.registry.artists[normalizedArtistName].artworks);
      
      for (const artworkId of importArtworks) {
        const normalizedArtworkId = parseInt(artworkId);
        if (!existingArtworks.has(normalizedArtworkId)) {
          this.registry.artists[normalizedArtistName].artworks.push(normalizedArtworkId);
          addedArtworks++;
        } else {
          skippedArtworks++;
        }
      }
      
      // 排序
      this.registry.artists[normalizedArtistName].artworks.sort((a, b) => b - a);
    }

    await this.saveRegistry();

    const result = {
      addedArtists,
      addedArtworks,
      skippedArtworks,
      totalArtists: Object.keys(this.registry.artists).length,
      totalArtworks: this.getTotalArtworkCount()
    };

    logger.info(`注册表导入完成，导入了 ${result.addedArtists} 个作者，${result.addedArtworks} 个作品，跳过了 ${result.skippedArtworks} 个重复作品。当前总计：${result.totalArtists} 个作者，${result.totalArtworks} 个作品`);
    return result;
  }

  /**
   * 从文件系统重建注册表
   * @param {FileManager} fileManager 
   * @param {string} taskId - 任务ID，用于更新进度
   * @returns {Promise<{scannedArtists: number, scannedArtworks: number, addedArtworks: number, skippedArtworks: number}>}
   */
  async rebuildFromFileSystem(fileManager, taskId = null) {
    logger.info('开始从文件系统重建下载注册表...');
    
    const stats = {
      scannedArtists: 0,
      scannedArtworks: 0,
      addedArtworks: 0,
      skippedArtworks: 0
    };

    // 获取所有艺术家目录
    const artistDirs = await fileManager.getArtistDirectories();
    logger.info(`发现 ${artistDirs.length} 个艺术家目录`);

    // 更新进度的辅助函数
    const updateProgress = (currentArtist = null) => {
      if (taskId && global.registryRebuildTasks) {
        const task = global.registryRebuildTasks.get(taskId);
        if (task && task.status === 'running') {
          global.registryRebuildTasks.set(taskId, {
            ...task,
            progress: {
              ...stats,
              currentArtist
            }
          });
        }
        // 检查是否被取消
        if (task && task.status === 'cancelled') {
          throw new Error('任务已被取消');
        }
      }
    };

    for (const artistDir of artistDirs) {
      try {
        stats.scannedArtists++;
        updateProgress(artistDir);
        
        logger.info(`扫描艺术家目录: ${artistDir}`);
        
        // 获取艺术家目录下的所有作品目录
        const artworkDirs = await fileManager.getArtworkDirectories(artistDir);
        
        for (const artworkDir of artworkDirs) {
          try {
            stats.scannedArtworks++;
            updateProgress(artistDir);
            
            // 检查作品是否已在注册表中
            const isRegistered = await this.isArtworkRegistered(artistDir, artworkDir);
            
            if (!isRegistered) {
              // 获取作品信息并添加到注册表
              const artworkInfo = await fileManager.getArtworkInfo(artistDir, artworkDir);
              if (artworkInfo) {
                await this.addArtwork(artistDir, artworkDir, artworkInfo);
                stats.addedArtworks++;
                logger.debug(`添加作品到注册表: ${artistDir}/${artworkDir}`);
              }
            } else {
              stats.skippedArtworks++;
            }
            
            // 每处理10个作品更新一次进度
            if (stats.scannedArtworks % 10 === 0) {
              updateProgress(artistDir);
            }
            
          } catch (error) {
            logger.warn(`处理作品目录失败 ${artistDir}/${artworkDir}:`, error.message);
          }
        }
        
      } catch (error) {
        logger.warn(`处理艺术家目录失败 ${artistDir}:`, error.message);
      }
    }

    // 最终更新进度
    updateProgress(null);
    
    logger.info('从文件系统重建下载注册表完成', stats);
    return stats;
  }

  /**
   * 清理注册表（移除不存在的记录）
   * @param {Object} fileManager - 文件管理器实例
   * @returns {Object} 清理结果统计
   */
  async cleanupRegistry(fileManager) {
    try {
      if (!this.loaded) {
        await this.loadRegistry();
      }

      logger.info('开始清理注册表...');
      
      let removedArtists = 0;
      let removedArtworks = 0;
      const downloadPath = await fileManager.getDownloadPath();

      for (const artistName in this.registry.artists) {
        const artworks = [...this.registry.artists[artistName].artworks];
        let validArtworks = [];

        for (const artworkId of artworks) {
          // 检查作品目录是否存在
          let found = false;
          
          try {
            const artistPath = path.join(downloadPath, artistName);
            if (await fileManager.directoryExists(artistPath)) {
              const artworkEntries = await fileManager.listDirectory(artistPath);
              
              for (const entry of artworkEntries) {
                const match = entry.match(/^(\d+)_(.+)$/);
                if (match && parseInt(match[1]) === artworkId) {
                  const artworkPath = path.join(artistPath, entry);
                  const infoPath = path.join(artworkPath, 'artwork_info.json');
                  
                  // 检查信息文件是否存在
                  if (await fs.pathExists(infoPath)) {
                    found = true;
                    break;
                  }
                }
              }
            }
          } catch (error) {
            logger.debug(`检查作品 ${artworkId} 时出错:`, error);
          }

          if (found) {
            validArtworks.push(artworkId);
          } else {
            removedArtworks++;
            logger.debug(`移除无效作品记录: ${artistName} - ${artworkId}`);
          }
        }

        if (validArtworks.length > 0) {
          this.registry.artists[artistName].artworks = validArtworks;
        } else {
          delete this.registry.artists[artistName];
          removedArtists++;
          logger.debug(`移除空作者记录: ${artistName}`);
        }
      }

      await this.saveRegistry();

      const result = {
        removedArtists,
        removedArtworks,
        remainingArtists: Object.keys(this.registry.artists).length,
        remainingArtworks: this.getTotalArtworkCount()
      };

      logger.info('注册表清理完成', result);
      return result;
    } catch (error) {
      logger.error('注册表清理失败:', error);
      throw error;
    }
  }

  /**
   * 标准化作者名称（处理特殊字符）
   */
  normalizeArtistName(artistName) {
    if (!artistName || typeof artistName !== 'string') {
      return 'Unknown Artist';
    }
    return artistName.trim();
  }

  /**
   * 获取总作品数量
   */
  getTotalArtworkCount() {
    let total = 0;
    for (const artistName in this.registry.artists) {
      total += this.registry.artists[artistName].artworks.length;
    }
    return total;
  }

  /**
   * 获取注册表文件路径
   */
  getRegistryPath() {
    return this.registryPath;
  }
}

module.exports = DownloadRegistry;