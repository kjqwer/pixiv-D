const { defaultLogger } = require('../utils/logger');
const RegistrySchema = require('./registry-schema');

const logger = defaultLogger.child('RegistryDatabase');

/**
 * 数据库版本的下载注册表
 * 提供与JSON版本相同的接口，但使用MySQL数据库存储
 */
class RegistryDatabase {
  constructor(databaseManager) {
    this.db = databaseManager;
    this.schema = new RegistrySchema(databaseManager);
    this.loaded = false;
  }

  /**
   * 初始化数据库注册表
   */
  async init() {
    try {
      // 初始化数据库表结构
      await this.schema.initializeTables();
      this.loaded = true;
      
      const stats = await this.getStats();
      logger.info(`数据库注册表初始化完成，总共包含${stats.artistCount}个作者，${stats.artworkCount}个作品`);
      
      return { success: true };
    } catch (error) {
      logger.error('数据库注册表初始化失败:', error);
      throw error;
    }
  }

  /**
   * 标准化作者名称
   */
  normalizeArtistName(artistName) {
    if (!artistName || typeof artistName !== 'string') {
      return 'Unknown Artist';
    }
    return artistName.trim();
  }

  /**
   * 获取或创建艺术家记录
   * @param {string} artistName 艺术家名称
   * @returns {number} 艺术家ID
   */
  async getOrCreateArtist(artistName) {
    const normalizedName = this.normalizeArtistName(artistName);
    
    try {
      // 先尝试查找现有艺术家
      const existingResult = await this.db.select('registry_artists', { 
        normalized_name: normalizedName 
      });
      
      if (existingResult.data.length > 0) {
        return existingResult.data[0].id;
      }
      
      // 创建新艺术家
      const insertResult = await this.db.insert('registry_artists', {
        artist_name: artistName,
        normalized_name: normalizedName,
        artwork_count: 0
      });
      
      return insertResult.insertId;
    } catch (error) {
      logger.error('获取或创建艺术家失败:', { artistName, error: error.message });
      throw error;
    }
  }

  /**
   * 添加作品到注册表
   * @param {string} artistName 艺术家名称
   * @param {number} artworkId 作品ID
   * @param {string} filePath 文件路径（可选）
   */
  async addArtwork(artistName, artworkId, filePath = null) {
    try {
      const normalizedArtworkId = parseInt(artworkId);
      if (!normalizedArtworkId) {
        throw new Error('无效的作品ID');
      }

      // 获取或创建艺术家
      const artistId = await this.getOrCreateArtist(artistName);
      
      // 检查作品是否已存在
      const existingResult = await this.db.select('registry_artworks', {
        artist_id: artistId,
        artwork_id: normalizedArtworkId
      });
      
      if (existingResult.data.length > 0) {
        logger.debug('作品已存在于注册表中', { artistName, artworkId: normalizedArtworkId });
        return;
      }
      
      // 添加作品记录
      await this.db.insert('registry_artworks', {
        artist_id: artistId,
        artwork_id: normalizedArtworkId,
        artist_name: artistName,
        file_path: filePath,
        download_date: new Date()
      });
      
      // 更新艺术家作品数量
      await this.updateArtistArtworkCount(artistId);
      
      logger.debug('成功添加作品到注册表', { artistName, artworkId: normalizedArtworkId });
    } catch (error) {
      logger.error('添加作品到注册表失败:', { artistName, artworkId, error: error.message });
      throw error;
    }
  }

  /**
   * 从注册表移除作品
   * @param {string} artistName 艺术家名称
   * @param {number} artworkId 作品ID
   */
  async removeArtwork(artistName, artworkId) {
    try {
      const normalizedArtworkId = parseInt(artworkId);
      const normalizedArtistName = this.normalizeArtistName(artistName);
      
      // 查找艺术家
      const artistResult = await this.db.select('registry_artists', {
        normalized_name: normalizedArtistName
      });
      
      if (artistResult.data.length === 0) {
        logger.warn('艺术家在注册表中未找到', { artistName: normalizedArtistName });
        return;
      }
      
      const artistId = artistResult.data[0].id;
      
      // 删除作品记录
      const deleteResult = await this.db.delete('registry_artworks', {
        artist_id: artistId,
        artwork_id: normalizedArtworkId
      });
      
      if (deleteResult.affectedRows > 0) {
        // 更新艺术家作品数量
        await this.updateArtistArtworkCount(artistId);
        logger.debug('成功移除作品记录', { artistName: normalizedArtistName, artworkId: normalizedArtworkId });
      } else {
        logger.warn('作品在注册表中未找到', { artistName: normalizedArtistName, artworkId: normalizedArtworkId });
      }
    } catch (error) {
      logger.error('移除作品记录失败:', { artistName, artworkId, error: error.message });
      throw error;
    }
  }

  /**
   * 更新艺术家作品数量
   * @param {number} artistId 艺术家ID
   */
  async updateArtistArtworkCount(artistId) {
    try {
      const countResult = await this.db.query(
        'SELECT COUNT(*) as count FROM registry_artworks WHERE artist_id = ?',
        [artistId]
      );
      
      const count = countResult.data[0].count;
      
      await this.db.update('registry_artists', 
        { artwork_count: count },
        { id: artistId }
      );
    } catch (error) {
      logger.error('更新艺术家作品数量失败:', { artistId, error: error.message });
    }
  }

  /**
   * 检查作品是否已下载
   * @param {number|string} artworkId - 作品ID
   * @returns {boolean} 是否已下载
   */
  async isArtworkDownloaded(artworkId) {
    try {
      const normalizedArtworkId = parseInt(artworkId);
      if (!normalizedArtworkId) {
        return false;
      }
      
      const result = await this.db.query(`
        SELECT COUNT(*) as count 
        FROM registry_artworks 
        WHERE artwork_id = ?
      `, [normalizedArtworkId]);
      
      return result.data[0].count > 0;
    } catch (error) {
      logger.error('检查作品下载状态失败:', { artworkId, error: error.message });
      return false;
    }
  }

  /**
   * 检查作品是否已在注册表中注册
   * @param {string} artistName 艺术家名称
   * @param {string} artworkDir 作品目录名或作品ID
   * @returns {boolean} 是否已注册
   */
  async isArtworkRegistered(artistName, artworkDir) {
    try {
      // 从目录名提取作品ID
      let artworkId;
      if (typeof artworkDir === 'string' && isNaN(artworkDir)) {
        // 如果是目录名，需要提取ID
        const artworkUtils = require('../utils/artwork-utils');
        artworkId = await artworkUtils.extractArtworkIdFromDir(artworkDir);
      } else {
        artworkId = parseInt(artworkDir);
      }
      
      if (!artworkId) {
        logger.warn(`无法从作品目录名中提取作品ID: ${artworkDir}`);
        return false;
      }
      
      const normalizedArtistName = this.normalizeArtistName(artistName);
      
      // 查询数据库
      const result = await this.db.query(`
        SELECT COUNT(*) as count 
        FROM registry_artworks ra 
        JOIN registry_artists rt ON ra.artist_id = rt.id 
        WHERE rt.normalized_name = ? AND ra.artwork_id = ?
      `, [normalizedArtistName, artworkId]);
      
      return result.data[0].count > 0;
    } catch (error) {
      logger.error('检查作品注册状态失败:', { artistName, artworkDir, error: error.message });
      return false;
    }
  }

  /**
   * 获取已下载的作品ID列表
   * @returns {number[]} 作品ID数组
   */
  async getDownloadedArtworkIds() {
    try {
      const result = await this.db.query(`
        SELECT DISTINCT artwork_id 
        FROM registry_artworks 
        ORDER BY artwork_id DESC
      `);
      
      return result.data.map(row => row.artwork_id);
    } catch (error) {
      logger.error('获取已下载作品ID列表失败:', error);
      return [];
    }
  }

  /**
   * 获取指定作者的已下载作品
   * @param {string} artistName 作者名称
   * @returns {number[]} 作品ID数组
   */
  async getArtistArtworks(artistName) {
    try {
      const normalizedArtistName = this.normalizeArtistName(artistName);
      
      const result = await this.db.query(`
        SELECT ra.artwork_id 
        FROM registry_artworks ra 
        JOIN registry_artists rt ON ra.artist_id = rt.id 
        WHERE rt.normalized_name = ? 
        ORDER BY ra.artwork_id DESC
      `, [normalizedArtistName]);
      
      return result.data.map(row => row.artwork_id);
    } catch (error) {
      logger.error('获取艺术家作品列表失败:', { artistName, error: error.message });
      return [];
    }
  }

  /**
   * 获取所有已下载的作者列表
   * @returns {string[]} 作者名称数组
   */
  async getDownloadedArtists() {
    try {
      const result = await this.db.query(`
        SELECT DISTINCT artist_name 
        FROM registry_artists 
        WHERE artwork_count > 0 
        ORDER BY artist_name
      `);
      
      return result.data.map(row => row.artist_name);
    } catch (error) {
      logger.error('获取已下载作者列表失败:', error);
      return [];
    }
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    try {
      // 获取艺术家数量
      const artistCountResult = await this.db.query(`
        SELECT COUNT(*) as count FROM registry_artists WHERE artwork_count > 0
      `);
      
      // 获取作品数量
      const artworkCountResult = await this.db.query(`
        SELECT COUNT(*) as count FROM registry_artworks
      `);
      
      // 获取版本信息
      const versionResult = await this.db.select('registry_meta', { meta_key: 'version' });
      const createdAtResult = await this.db.select('registry_meta', { meta_key: 'created_at' });
      
      // 获取最后更新时间
      const lastUpdatedResult = await this.db.query(`
        SELECT MAX(updated_at) as last_updated FROM registry_artworks
      `);
      
      return {
        artistCount: artistCountResult.data[0].count,
        artworkCount: artworkCountResult.data[0].count,
        version: versionResult.data[0]?.meta_value || '1.0.5',
        created_at: createdAtResult.data[0]?.meta_value || new Date().toISOString(),
        updated_at: lastUpdatedResult.data[0]?.last_updated || new Date().toISOString()
      };
    } catch (error) {
      logger.error('获取统计信息失败:', error);
      return {
        artistCount: 0,
        artworkCount: 0,
        version: '1.0.5',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
  }

  /**
   * 导出注册表数据（转换为JSON格式）
   */
  async exportRegistry() {
    try {
      const result = await this.db.query(`
        SELECT 
          rt.artist_name,
          rt.normalized_name,
          GROUP_CONCAT(ra.artwork_id ORDER BY ra.artwork_id DESC) as artwork_ids
        FROM registry_artists rt
        LEFT JOIN registry_artworks ra ON rt.id = ra.artist_id
        WHERE rt.artwork_count > 0
        GROUP BY rt.id, rt.artist_name, rt.normalized_name
      `);
      
      const artists = {};
      
      for (const row of result.data) {
        const artworkIds = row.artwork_ids ? 
          row.artwork_ids.split(',').map(id => parseInt(id)) : [];
        
        artists[row.artist_name] = {
          artworks: artworkIds
        };
      }
      
      const stats = await this.getStats();
      
      return {
        version: stats.version,
        created_at: stats.created_at,
        updated_at: stats.updated_at,
        exported_at: new Date().toISOString(),
        artists: artists
      };
    } catch (error) {
      logger.error('导出注册表数据失败:', error);
      throw error;
    }
  }

  /**
   * 导入注册表数据（从JSON格式）
   * @param {Object} importData 要导入的数据
   */
  async importRegistry(importData) {
    if (!importData || !importData.artists) {
      throw new Error('导入数据格式不正确');
    }

    let addedArtists = 0;
    let addedArtworks = 0;
    let skippedArtworks = 0;

    try {
      await this.db.transaction(async (connection) => {
        for (const artistName in importData.artists) {
          const importArtworks = importData.artists[artistName].artworks || [];
          
          // 获取或创建艺术家
          const artistId = await this.getOrCreateArtist(artistName);
          
          // 检查是否是新艺术家
          const existingArtworkCount = await this.db.query(
            'SELECT COUNT(*) as count FROM registry_artworks WHERE artist_id = ?',
            [artistId]
          );
          
          if (existingArtworkCount.data[0].count === 0) {
            addedArtists++;
          }
          
          // 获取现有作品ID
          const existingArtworksResult = await this.db.select('registry_artworks', {
            artist_id: artistId
          });
          const existingArtworkIds = new Set(
            existingArtworksResult.data.map(row => row.artwork_id)
          );
          
          // 添加新作品
          for (const artworkId of importArtworks) {
            const normalizedArtworkId = parseInt(artworkId);
            
            if (!existingArtworkIds.has(normalizedArtworkId)) {
              await this.db.insert('registry_artworks', {
                artist_id: artistId,
                artwork_id: normalizedArtworkId,
                artist_name: artistName,
                download_date: new Date()
              });
              addedArtworks++;
            } else {
              skippedArtworks++;
            }
          }
          
          // 更新艺术家作品数量
          await this.updateArtistArtworkCount(artistId);
        }
      });

      const stats = await this.getStats();
      const result = {
        addedArtists,
        addedArtworks,
        skippedArtworks,
        totalArtists: stats.artistCount,
        totalArtworks: stats.artworkCount
      };

      logger.info(`注册表导入完成，导入了 ${result.addedArtists} 个作者，${result.addedArtworks} 个作品，跳过了 ${result.skippedArtworks} 个重复作品。当前总计：${result.totalArtists} 个作者，${result.totalArtworks} 个作品`);
      return result;
    } catch (error) {
      logger.error('导入注册表数据失败:', error);
      throw error;
    }
  }

  /**
   * 从文件系统重建注册表
   * @param {FileManager} fileManager 
   * @param {string} taskId 任务ID
   */
  async rebuildFromFileSystem(fileManager, taskId = null) {
    logger.info('开始从文件系统重建数据库注册表...');
    
    const stats = {
      scannedArtists: 0,
      scannedArtworks: 0,
      addedArtworks: 0,
      skippedArtworks: 0
    };

    // 进度更新函数
    const updateProgress = (currentArtist) => {
      if (taskId) {
        const progressManager = require('../services/progress-manager');
        progressManager.updateProgress(taskId, {
          ...stats,
          currentArtist: currentArtist || ''
        });
      }
    };

    try {
      // 获取所有艺术家目录
      const artistDirs = await fileManager.getArtistDirectories();
      logger.info(`发现 ${artistDirs.length} 个艺术家目录`);

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
                // 从作品目录名中提取作品ID并添加到注册表
                const artworkUtils = require('../utils/artwork-utils');
                const artworkId = await artworkUtils.extractArtworkIdFromDir(artworkDir);
                if (artworkId) {
                  await this.addArtwork(artistDir, artworkId);
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
      
      logger.info('从文件系统重建数据库注册表完成', stats);
      return stats;
    } catch (error) {
      logger.error('从文件系统重建数据库注册表失败:', error);
      throw error;
    }
  }

  /**
   * 清理注册表（移除不存在的记录）
   * @param {FileManager} fileManager 文件管理器实例
   */
  async cleanupRegistry(fileManager) {
    try {
      logger.info('开始清理数据库注册表...');
      
      let removedArtists = 0;
      let removedArtworks = 0;
      const downloadPath = await fileManager.getDownloadPath();

      // 获取所有作品记录
      const artworksResult = await this.db.query(`
        SELECT ra.id, ra.artist_id, ra.artwork_id, rt.artist_name, rt.normalized_name
        FROM registry_artworks ra
        JOIN registry_artists rt ON ra.artist_id = rt.id
      `);

      const fs = require('fs-extra');
      const path = require('path');
      const artworkUtils = require('../utils/artwork-utils');

      for (const artwork of artworksResult.data) {
        let found = false;
        
        try {
          const artistPath = path.join(downloadPath, artwork.artist_name);
          if (await fileManager.directoryExists(artistPath)) {
            const artworkEntries = await fileManager.listDirectory(artistPath);
            
            for (const entry of artworkEntries) {
              const extractedArtworkId = await artworkUtils.extractArtworkIdFromDir(entry);
              if (extractedArtworkId && extractedArtworkId === artwork.artwork_id) {
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
          logger.debug(`检查作品 ${artwork.artwork_id} 时出错:`, error);
        }

        if (!found) {
          // 删除作品记录
          await this.db.delete('registry_artworks', { id: artwork.id });
          removedArtworks++;
          logger.debug(`移除无效作品记录: ${artwork.artist_name} - ${artwork.artwork_id}`);
        }
      }

      // 更新所有艺术家的作品数量
      const artistsResult = await this.db.select('registry_artists');
      for (const artist of artistsResult.data) {
        await this.updateArtistArtworkCount(artist.id);
      }

      // 删除没有作品的艺术家
      const emptyArtistsResult = await this.db.select('registry_artists', { artwork_count: 0 });
      for (const artist of emptyArtistsResult.data) {
        await this.db.delete('registry_artists', { id: artist.id });
        removedArtists++;
        logger.debug(`移除空作者记录: ${artist.artist_name}`);
      }

      const stats = await this.getStats();
      const result = {
        removedArtists,
        removedArtworks,
        remainingArtists: stats.artistCount,
        remainingArtworks: stats.artworkCount
      };

      logger.info('数据库注册表清理完成', result);
      return result;
    } catch (error) {
      logger.error('数据库注册表清理失败:', error);
      throw error;
    }
  }

  /**
   * 获取总作品数量
   */
  async getTotalArtworkCount() {
    try {
      const result = await this.db.query('SELECT COUNT(*) as count FROM registry_artworks');
      return result.data[0].count;
    } catch (error) {
      logger.error('获取总作品数量失败:', error);
      return 0;
    }
  }
}

module.exports = RegistryDatabase;