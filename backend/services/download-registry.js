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

    logger.info('注册表导入完成', result);
    return result;
  }

  /**
   * 从文件系统扫描并重建注册表
   * @param {Object} fileManager - 文件管理器实例
   * @returns {Object} 扫描结果统计
   */
  async rebuildFromFileSystem(fileManager) {
    try {
      logger.info('开始从文件系统扫描并添加新作品到注册表...');
      
      if (!this.loaded) {
        await this.loadRegistry();
      }
      
      let scannedArtists = 0;
      let scannedArtworks = 0;
      let addedArtworks = 0;
      let skippedArtworks = 0;

      const downloadPath = await fileManager.getDownloadPath();
      logger.debug(`扫描下载路径: ${downloadPath}`);
      
      const artists = await fileManager.listDirectory(downloadPath);
      logger.debug(`找到 ${artists.length} 个作者目录`);

      for (const artist of artists) {
        try {
          const artistPath = path.join(downloadPath, artist);
          const artistStat = await fileManager.getFileInfo(artistPath);

          if (artistStat.exists && artistStat.isDirectory) {
            scannedArtists++;
            logger.debug(`扫描作者: ${artist}`);
            
            const artworks = await fileManager.listDirectory(artistPath);

            for (const artwork of artworks) {
              try {
                const artworkPath = path.join(artistPath, artwork);
                const artworkStat = await fileManager.getFileInfo(artworkPath);

                if (artworkStat.exists && artworkStat.isDirectory) {
                  scannedArtworks++;
                  
                  // 检查是否是作品目录（包含数字ID）
                  const artworkMatch = artwork.match(/^(\d+)_(.+)$/);
                  if (artworkMatch) {
                    const artworkId = parseInt(artworkMatch[1]);

                    // 检查作品是否已经在注册表中
                    const isAlreadyRegistered = await this.isArtworkDownloaded(artworkId);
                    if (isAlreadyRegistered) {
                      skippedArtworks++;
                      continue; // 跳过已注册的作品
                    }

                    // 检查作品信息文件和图片文件
                    const infoPath = path.join(artworkPath, 'artwork_info.json');
                    let artworkInfo;
                    try {
                      const infoContent = await fs.readFile(infoPath, 'utf8');
                      artworkInfo = JSON.parse(infoContent);
                    } catch (error) {
                      logger.debug(`读取作品信息文件失败: ${infoPath}`, error);
                      continue; // 跳过没有信息文件的目录
                    }

                    // 检查是否有图片文件
                    const files = await fileManager.listDirectory(artworkPath);
                    const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));

                    if (imageFiles.length > 0) {
                      // 检查图片数量是否与artwork_info.json中记录的一致
                      const expectedImageCount = artworkInfo.page_count || 1;
                      if (imageFiles.length >= expectedImageCount) {
                        // 添加到注册表（只添加新的）
                        await this.addArtwork(artist, artworkId);
                        addedArtworks++;
                        logger.debug(`添加作品到注册表: ${artist} - ${artworkId}`);
                      } else {
                        logger.debug(`作品图片数量不足: ${artist} - ${artworkId}, 期望: ${expectedImageCount}, 实际: ${imageFiles.length}`);
                      }
                    } else {
                      logger.debug(`作品目录无图片文件: ${artworkPath}`);
                    }
                  }
                }
              } catch (error) {
                logger.debug(`处理作品目录 ${artwork} 时出错:`, error);
                continue; // 跳过有问题的作品目录
              }
            }
          }
        } catch (error) {
          logger.debug(`处理作者目录 ${artist} 时出错:`, error);
          continue; // 跳过有问题的作者目录
        }
      }

      const result = {
        scannedArtists,
        scannedArtworks,
        addedArtworks,
        skippedArtworks,
        totalRegisteredArtists: Object.keys(this.registry.artists).length,
        totalRegisteredArtworks: this.getTotalArtworkCount()
      };

      logger.info('注册表扫描完成', result);
      return result;
    } catch (error) {
      logger.error('注册表扫描失败:', error);
      throw error;
    }
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