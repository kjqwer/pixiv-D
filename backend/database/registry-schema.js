const { defaultLogger } = require('../utils/logger');

const logger = defaultLogger.child('RegistrySchema');

/**
 * 注册表数据库表结构管理
 */
class RegistrySchema {
  constructor(databaseManager) {
    this.db = databaseManager;
  }

  /**
   * 初始化所有注册表相关的数据库表
   */
  async initializeTables() {
    try {
      await this.createArtistsTable();
      await this.createArtworksTable();
      await this.createRegistryMetaTable();
      logger.info('注册表数据库表初始化完成');
      return { success: true };
    } catch (error) {
      logger.error('初始化注册表数据库表失败:', error);
      throw error;
    }
  }

  /**
   * 创建艺术家表
   */
  async createArtistsTable() {
    const tableName = 'registry_artists';
    
    if (await this.db.tableExists(tableName)) {
      logger.debug(`表 ${tableName} 已存在，跳过创建`);
      return;
    }

    const createSQL = `
      CREATE TABLE ${tableName} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        artist_name VARCHAR(255) NOT NULL UNIQUE COMMENT '艺术家名称',
        normalized_name VARCHAR(255) NOT NULL COMMENT '标准化后的艺术家名称',
        artwork_count INT DEFAULT 0 COMMENT '作品数量',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        INDEX idx_artist_name (artist_name),
        INDEX idx_normalized_name (normalized_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='注册表艺术家表';
    `;

    await this.db.createTable(tableName, createSQL);
  }

  /**
   * 创建作品表
   */
  async createArtworksTable() {
    const tableName = 'registry_artworks';
    
    if (await this.db.tableExists(tableName)) {
      logger.debug(`表 ${tableName} 已存在，跳过创建`);
      return;
    }

    const createSQL = `
      CREATE TABLE ${tableName} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        artist_id INT NOT NULL COMMENT '艺术家ID',
        artwork_id BIGINT NOT NULL COMMENT '作品ID',
        artist_name VARCHAR(255) NOT NULL COMMENT '艺术家名称（冗余字段，便于查询）',
        file_path TEXT COMMENT '文件路径（可选）',
        download_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '下载时间',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        UNIQUE KEY uk_artist_artwork (artist_id, artwork_id),
        INDEX idx_artwork_id (artwork_id),
        INDEX idx_artist_id (artist_id),
        INDEX idx_artist_name (artist_name),
        INDEX idx_download_date (download_date),
        FOREIGN KEY (artist_id) REFERENCES registry_artists(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='注册表作品表';
    `;

    await this.db.createTable(tableName, createSQL);
  }

  /**
   * 创建注册表元数据表
   */
  async createRegistryMetaTable() {
    const tableName = 'registry_meta';
    
    if (await this.db.tableExists(tableName)) {
      logger.debug(`表 ${tableName} 已存在，跳过创建`);
      return;
    }

    const createSQL = `
      CREATE TABLE ${tableName} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        meta_key VARCHAR(100) NOT NULL UNIQUE COMMENT '元数据键',
        meta_value TEXT COMMENT '元数据值',
        description TEXT COMMENT '描述',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        INDEX idx_meta_key (meta_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='注册表元数据表';
    `;

    await this.db.createTable(tableName, createSQL);

    // 插入初始元数据
    await this.initializeMetaData();
  }

  /**
   * 初始化元数据
   */
  async initializeMetaData() {
    const metaData = [
      {
        meta_key: 'version',
        meta_value: '1.0.5',
        description: '注册表版本号'
      },
      {
        meta_key: 'storage_type',
        meta_value: 'database',
        description: '存储类型：database 或 json'
      },
      {
        meta_key: 'created_at',
        meta_value: new Date().toISOString(),
        description: '注册表创建时间'
      },
      {
        meta_key: 'last_migration',
        meta_value: new Date().toISOString(),
        description: '最后一次迁移时间'
      }
    ];

    for (const meta of metaData) {
      try {
        await this.db.insert('registry_meta', meta);
      } catch (error) {
        // 如果键已存在，忽略错误
        if (!error.message.includes('Duplicate entry')) {
          throw error;
        }
      }
    }
  }

  /**
   * 获取表结构信息
   */
  getTableInfo() {
    return {
      artists: {
        tableName: 'registry_artists',
        description: '存储艺术家信息',
        fields: {
          id: '主键ID',
          artist_name: '艺术家名称',
          normalized_name: '标准化后的艺术家名称',
          artwork_count: '作品数量',
          created_at: '创建时间',
          updated_at: '更新时间'
        }
      },
      artworks: {
        tableName: 'registry_artworks',
        description: '存储作品信息',
        fields: {
          id: '主键ID',
          artist_id: '艺术家ID（外键）',
          artwork_id: '作品ID',
          artist_name: '艺术家名称（冗余字段）',
          file_path: '文件路径',
          download_date: '下载时间',
          created_at: '创建时间',
          updated_at: '更新时间'
        }
      },
      meta: {
        tableName: 'registry_meta',
        description: '存储注册表元数据',
        fields: {
          id: '主键ID',
          meta_key: '元数据键',
          meta_value: '元数据值',
          description: '描述',
          created_at: '创建时间',
          updated_at: '更新时间'
        }
      }
    };
  }

  /**
   * 检查所有表是否存在
   */
  async checkTablesExist() {
    const tables = ['registry_artists', 'registry_artworks', 'registry_meta'];
    const results = {};
    
    for (const table of tables) {
      results[table] = await this.db.tableExists(table);
    }
    
    return results;
  }

  /**
   * 删除所有注册表相关的表（谨慎使用）
   */
  async dropAllTables() {
    const tables = ['registry_artworks', 'registry_artists', 'registry_meta'];
    
    try {
      // 按照外键依赖顺序删除表
      for (const table of tables) {
        if (await this.db.tableExists(table)) {
          await this.db.query(`DROP TABLE ${table}`);
          logger.info(`表 ${table} 已删除`);
        }
      }
      
      logger.info('所有注册表相关的表已删除');
      return { success: true };
    } catch (error) {
      logger.error('删除注册表表失败:', error);
      throw error;
    }
  }
}

module.exports = RegistrySchema;