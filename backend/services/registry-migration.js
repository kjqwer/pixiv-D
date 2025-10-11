const { defaultLogger } = require('../utils/logger');
const fs = require('fs-extra');
const path = require('path');

const logger = defaultLogger.child('RegistryMigration');

/**
 * 注册表数据迁移服务
 * 处理JSON和数据库之间的数据转换
 */
class RegistryMigration {
  constructor(jsonRegistry, databaseRegistry, fileManager) {
    this.jsonRegistry = jsonRegistry;
    this.databaseRegistry = databaseRegistry;
    this.fileManager = fileManager;
  }

  /**
   * 从JSON迁移到数据库
   * @param {boolean} overwrite 是否覆盖现有数据
   * @returns {Object} 迁移结果
   */
  async migrateJsonToDatabase(overwrite = true) {
    logger.info('开始从JSON迁移数据到数据库...');
    
    try {
      // 确保JSON注册表已加载
      if (!this.jsonRegistry.loaded) {
        await this.jsonRegistry.init();
      }

      // 初始化数据库注册表
      await this.databaseRegistry.init();

      // 如果需要覆盖，先清空数据库
      if (overwrite) {
        logger.info('清空数据库中的现有数据...');
        await this.clearDatabaseRegistry();
      }

      // 获取JSON数据
      const jsonData = await this.jsonRegistry.exportRegistry();
      if (!jsonData || !jsonData.artists) {
        throw new Error('JSON注册表数据为空或格式不正确');
      }

      // 导入到数据库
      const importResult = await this.databaseRegistry.importRegistry(jsonData);
      
      const result = {
        success: true,
        direction: 'json-to-db',
        recordsProcessed: importResult.addedArtworks,
        addedArtists: importResult.addedArtists,
        addedArtworks: importResult.addedArtworks,
        skippedArtworks: importResult.skippedArtworks,
        totalArtists: importResult.totalArtists,
        totalArtworks: importResult.totalArtworks,
        message: `成功从JSON迁移到数据库，处理了${importResult.addedArtists}个作者，${importResult.addedArtworks}个作品`
      };

      logger.info('JSON到数据库迁移完成', result);
      return result;

    } catch (error) {
      logger.error('JSON到数据库迁移失败:', error);
      throw error;
    }
  }

  /**
   * 从数据库迁移到JSON
   * @param {boolean} overwrite 是否覆盖现有数据
   * @returns {Object} 迁移结果
   */
  async migrateDatabaseToJson(overwrite = true) {
    logger.info('开始从数据库迁移数据到JSON...');
    
    try {
      // 确保数据库注册表已初始化
      await this.databaseRegistry.init();

      // 确保JSON注册表已加载
      if (!this.jsonRegistry.loaded) {
        await this.jsonRegistry.init();
      }

      // 获取数据库数据
      const dbData = await this.databaseRegistry.exportRegistry();
      if (!dbData || !dbData.artists) {
        throw new Error('数据库注册表数据为空或格式不正确');
      }

      // 如果需要覆盖，先清空JSON注册表
      if (overwrite) {
        logger.info('清空JSON注册表中的现有数据...');
        this.jsonRegistry.artists = {};
        this.jsonRegistry.version = dbData.version || '1.0.5';
        this.jsonRegistry.created_at = dbData.created_at || new Date().toISOString();
      }

      // 统计信息
      let addedArtists = 0;
      let addedArtworks = 0;
      let skippedArtworks = 0;

      // 导入数据到JSON注册表
      for (const artistName in dbData.artists) {
        const artistData = dbData.artists[artistName];
        const artworks = artistData.artworks || [];

        // 检查艺术家是否已存在
        const isNewArtist = !this.jsonRegistry.artists[artistName];
        if (isNewArtist) {
          this.jsonRegistry.artists[artistName] = { artworks: [] };
          addedArtists++;
        }

        // 获取现有作品ID
        const existingArtworkIds = new Set(this.jsonRegistry.artists[artistName].artworks);

        // 添加新作品
        for (const artworkId of artworks) {
          if (!existingArtworkIds.has(artworkId)) {
            this.jsonRegistry.artists[artistName].artworks.push(artworkId);
            addedArtworks++;
          } else {
            skippedArtworks++;
          }
        }

        // 排序作品ID
        this.jsonRegistry.artists[artistName].artworks.sort((a, b) => b - a);
      }

      // 更新时间戳
      this.jsonRegistry.updated_at = new Date().toISOString();

      // 保存JSON注册表
      await this.jsonRegistry.save();

      // 获取最终统计
      const finalStats = await this.jsonRegistry.getStats();

      const result = {
        success: true,
        direction: 'db-to-json',
        recordsProcessed: addedArtworks,
        addedArtists,
        addedArtworks,
        skippedArtworks,
        totalArtists: finalStats.totalArtists,
        totalArtworks: finalStats.totalArtworks,
        message: `成功从数据库迁移到JSON，处理了${addedArtists}个作者，${addedArtworks}个作品`
      };

      logger.info('数据库到JSON迁移完成', result);
      return result;

    } catch (error) {
      logger.error('数据库到JSON迁移失败:', error);
      throw error;
    }
  }

  /**
   * 清空数据库注册表
   */
  async clearDatabaseRegistry() {
    try {
      const db = this.databaseRegistry.db;
      
      // 删除所有作品记录
      await db.query('DELETE FROM registry_artworks');
      
      // 删除所有艺术家记录
      await db.query('DELETE FROM registry_artists');
      
      // 重置自增ID
      await db.query('ALTER TABLE registry_artists AUTO_INCREMENT = 1');
      await db.query('ALTER TABLE registry_artworks AUTO_INCREMENT = 1');
      
      logger.info('数据库注册表已清空');
    } catch (error) {
      logger.error('清空数据库注册表失败:', error);
      throw error;
    }
  }

  /**
   * 比较JSON和数据库注册表的差异
   * @returns {Object} 差异报告
   */
  async compareRegistries() {
    logger.info('开始比较JSON和数据库注册表...');
    
    try {
      // 确保两个注册表都已初始化
      if (!this.jsonRegistry.loaded) {
        await this.jsonRegistry.init();
      }
      await this.databaseRegistry.init();

      // 获取统计信息
      const jsonStats = await this.jsonRegistry.getStats();
      const dbStats = await this.databaseRegistry.getStats();

      // 获取艺术家列表
      const jsonArtists = await this.jsonRegistry.getDownloadedArtists();
      const dbArtists = await this.databaseRegistry.getDownloadedArtists();

      // 计算差异
      const jsonArtistSet = new Set(jsonArtists);
      const dbArtistSet = new Set(dbArtists);

      const onlyInJson = jsonArtists.filter(artist => !dbArtistSet.has(artist));
      const onlyInDb = dbArtists.filter(artist => !jsonArtistSet.has(artist));
      const commonArtists = jsonArtists.filter(artist => dbArtistSet.has(artist));

      // 比较共同艺术家的作品差异
      let artworkDifferences = [];
      for (const artist of commonArtists.slice(0, 10)) { // 限制比较数量以避免性能问题
        const jsonArtworks = await this.jsonRegistry.getArtistArtworks(artist);
        const dbArtworks = await this.databaseRegistry.getArtistArtworks(artist);

        const jsonArtworkSet = new Set(jsonArtworks);
        const dbArtworkSet = new Set(dbArtworks);

        const onlyInJsonArtworks = jsonArtworks.filter(id => !dbArtworkSet.has(id));
        const onlyInDbArtworks = dbArtworks.filter(id => !jsonArtworkSet.has(id));

        if (onlyInJsonArtworks.length > 0 || onlyInDbArtworks.length > 0) {
          artworkDifferences.push({
            artist,
            onlyInJson: onlyInJsonArtworks.length,
            onlyInDb: onlyInDbArtworks.length,
            jsonTotal: jsonArtworks.length,
            dbTotal: dbArtworks.length
          });
        }
      }

      const comparison = {
        json: {
          artists: jsonStats.totalArtists,
          artworks: jsonStats.totalArtworks,
          version: jsonStats.version,
          updated_at: jsonStats.updated_at
        },
        database: {
          artists: dbStats.artistCount,
          artworks: dbStats.artworkCount,
          version: dbStats.version,
          updated_at: dbStats.updated_at
        },
        differences: {
          artistsOnlyInJson: onlyInJson.length,
          artistsOnlyInDb: onlyInDb.length,
          commonArtists: commonArtists.length,
          artworkDifferences: artworkDifferences.length,
          sampleArtworkDifferences: artworkDifferences.slice(0, 5)
        },
        recommendation: this.getRecommendation(jsonStats, dbStats, onlyInJson, onlyInDb)
      };

      logger.info('注册表比较完成', {
        jsonArtists: jsonStats.totalArtists,
        dbArtists: dbStats.artistCount,
        differences: comparison.differences
      });

      return comparison;

    } catch (error) {
      logger.error('比较注册表失败:', error);
      throw error;
    }
  }

  /**
   * 根据比较结果给出建议
   */
  getRecommendation(jsonStats, dbStats, onlyInJson, onlyInDb) {
    if (jsonStats.totalArtworks === 0 && dbStats.artworkCount === 0) {
      return '两个注册表都为空，无需迁移';
    }

    if (jsonStats.totalArtworks === 0) {
      return '建议从数据库迁移到JSON';
    }

    if (dbStats.artworkCount === 0) {
      return '建议从JSON迁移到数据库';
    }

    if (jsonStats.totalArtworks > dbStats.artworkCount) {
      return 'JSON注册表包含更多数据，建议从JSON迁移到数据库';
    }

    if (dbStats.artworkCount > jsonStats.totalArtworks) {
      return '数据库注册表包含更多数据，建议从数据库迁移到JSON';
    }

    if (onlyInJson.length > onlyInDb.length) {
      return 'JSON注册表有更多独有艺术家，建议从JSON迁移到数据库';
    }

    if (onlyInDb.length > onlyInJson.length) {
      return '数据库注册表有更多独有艺术家，建议从数据库迁移到JSON';
    }

    return '两个注册表数据相似，可根据需要选择迁移方向';
  }

  /**
   * 验证迁移结果
   * @param {string} direction 迁移方向
   * @returns {Object} 验证结果
   */
  async validateMigration(direction) {
    logger.info(`验证${direction}迁移结果...`);
    
    try {
      const comparison = await this.compareRegistries();
      
      let isValid = false;
      let message = '';

      if (direction === 'json-to-db') {
        // 验证数据库是否包含JSON的所有数据
        isValid = comparison.database.artworks >= comparison.json.artworks &&
                  comparison.differences.artistsOnlyInJson === 0;
        message = isValid ? 
          '迁移验证成功：数据库包含了JSON的所有数据' : 
          '迁移验证失败：数据库缺少部分JSON数据';
      } else if (direction === 'db-to-json') {
        // 验证JSON是否包含数据库的所有数据
        isValid = comparison.json.artworks >= comparison.database.artworks &&
                  comparison.differences.artistsOnlyInDb === 0;
        message = isValid ? 
          '迁移验证成功：JSON包含了数据库的所有数据' : 
          '迁移验证失败：JSON缺少部分数据库数据';
      }

      const result = {
        valid: isValid,
        message,
        comparison
      };

      logger.info('迁移验证完成', { valid: isValid, message });
      return result;

    } catch (error) {
      logger.error('验证迁移结果失败:', error);
      throw error;
    }
  }

  /**
   * 创建数据备份
   * @param {string} type 备份类型 ('json' | 'database')
   * @returns {string} 备份文件路径
   */
  async createBackup(type) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 检测是否在pkg打包环境中运行
    const isPkg = process.pkg !== undefined;
    
    const backupDir = isPkg 
      ? path.join(process.cwd(), 'data', 'backups', 'registry')  // 打包环境：当前工作目录的data文件夹
      : path.join(__dirname, '..', '..', 'backups', 'registry');  // 开发环境：项目根目录的backups文件夹
    
    await fs.ensureDir(backupDir);

    try {
      if (type === 'json') {
        // 备份JSON注册表
        const jsonData = await this.jsonRegistry.exportRegistry();
        const backupPath = path.join(backupDir, `registry-json-backup-${timestamp}.json`);
        
        await fs.writeJson(backupPath, jsonData, { spaces: 2 });
        logger.info(`JSON注册表备份已创建: ${backupPath}`);
        return backupPath;

      } else if (type === 'database') {
        // 备份数据库注册表
        const dbData = await this.databaseRegistry.exportRegistry();
        const backupPath = path.join(backupDir, `registry-db-backup-${timestamp}.json`);
        
        await fs.writeJson(backupPath, dbData, { spaces: 2 });
        logger.info(`数据库注册表备份已创建: ${backupPath}`);
        return backupPath;
      }

      throw new Error(`不支持的备份类型: ${type}`);

    } catch (error) {
      logger.error(`创建${type}备份失败:`, error);
      throw error;
    }
  }

  /**
   * 执行完整的迁移流程（包含备份和验证）
   * @param {string} direction 迁移方向
   * @param {boolean} overwrite 是否覆盖
   * @param {boolean} createBackup 是否创建备份
   * @returns {Object} 迁移结果
   */
  async performMigration(direction, overwrite = true, createBackup = true) {
    logger.info(`开始执行完整迁移流程: ${direction}`);
    
    const result = {
      success: false,
      direction,
      backupPath: null,
      migrationResult: null,
      validationResult: null,
      error: null
    };

    try {
      // 创建备份
      if (createBackup) {
        const backupType = direction === 'json-to-db' ? 'database' : 'json';
        result.backupPath = await this.createBackup(backupType);
      }

      // 执行迁移
      if (direction === 'json-to-db') {
        result.migrationResult = await this.migrateJsonToDatabase(overwrite);
      } else if (direction === 'db-to-json') {
        result.migrationResult = await this.migrateDatabaseToJson(overwrite);
      } else {
        throw new Error(`不支持的迁移方向: ${direction}`);
      }

      // 验证迁移结果
      result.validationResult = await this.validateMigration(direction);

      result.success = result.migrationResult.success && result.validationResult.valid;
      
      logger.info('完整迁移流程完成', {
        direction,
        success: result.success,
        recordsProcessed: result.migrationResult.recordsProcessed
      });

      return result;

    } catch (error) {
      result.error = error.message;
      logger.error('完整迁移流程失败:', error);
      throw error;
    }
  }
}

module.exports = RegistryMigration;