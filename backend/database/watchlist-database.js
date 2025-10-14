const { defaultLogger } = require('../utils/logger');
const crypto = require('crypto');

const logger = defaultLogger.child('WatchlistDatabase');

/**
 * 数据库版本的待看名单
 * 提供与JSON版本相同的接口，但使用MySQL数据库存储
 */
class WatchlistDatabase {
  constructor(databaseManager) {
    this.db = databaseManager;
    this.loaded = false;
    this.tableName = 'watchlist_items';
  }

  /**
   * 初始化数据库表
   */
  async init() {
    try {
      // 如果表不存在则创建
      if (!(await this.db.tableExists(this.tableName))) {
        const createSQL = `
          CREATE TABLE ${this.tableName} (
            id VARCHAR(64) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            url TEXT NOT NULL,
            url_hash CHAR(64) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_url_hash (url_hash)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='待看名单表';
        `;
        await this.db.createTable(this.tableName, createSQL);
      }
      this.loaded = true;
      logger.info('待看名单数据库表初始化完成');
      return { success: true };
    } catch (error) {
      logger.error('初始化待看名单数据库失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有待看项目
   */
  async getAllItems() {
    try {
      const result = await this.db.query(`
        SELECT id, title, url, created_at, updated_at
        FROM ${this.tableName}
        ORDER BY created_at ASC
      `);
      return result.data.map(row => ({
        id: row.id.toString(),
        title: row.title,
        url: row.url,
        createdAt: (row.created_at instanceof Date) ? row.created_at.toISOString() : row.created_at,
        updatedAt: (row.updated_at instanceof Date) ? row.updated_at.toISOString() : row.updated_at
      }));
    } catch (error) {
      logger.error('获取待看项目失败(数据库):', error);
      throw error;
    }
  }

  /**
   * 添加或更新待看项目（按URL唯一）
   */
  async addItem(item) {
    try {
      const { url, title } = item;
      if (!url) throw new Error('URL是必填项');
      const urlHash = crypto.createHash('sha256').update(url).digest('hex');

      // 先查是否存在
      const exists = await this.db.select(this.tableName, { url_hash: urlHash });
      if (exists.data && exists.data.length > 0) {
        // 更新标题
        await this.db.update(this.tableName, { title }, { url_hash: urlHash });
      } else {
        const id = (item.id?.toString()) || Date.now().toString();
        await this.db.insert(this.tableName, {
          id,
          title: title || '待看页面',
          url,
          url_hash: urlHash
        });
      }
      return await this.getAllItems();
    } catch (error) {
      logger.error('添加待看项目失败(数据库):', error);
      throw error;
    }
  }

  /**
   * 删除待看项目
   */
  async removeItem(id) {
    try {
      const result = await this.db.delete(this.tableName, { id });
      if (result.affectedRows === 0) {
        throw new Error('待看项目不存在');
      }
      return await this.getAllItems();
    } catch (error) {
      logger.error('删除待看项目失败(数据库):', error);
      throw error;
    }
  }

  /**
   * 更新待看项目
   */
  async updateItem(id, updates) {
    try {
      const allowed = {};
      if (typeof updates.title === 'string') allowed.title = updates.title;
      if (typeof updates.url === 'string') {
        allowed.url = updates.url;
        allowed.url_hash = crypto.createHash('sha256').update(updates.url).digest('hex');
      }
      if (Object.keys(allowed).length === 0) {
        // 没有可更新字段则返回原项
        const rows = await this.db.select(this.tableName, { id });
        if (!rows.data || rows.data.length === 0) throw new Error('待看项目不存在');
        const row = rows.data[0];
        return {
          id: row.id.toString(),
          title: row.title,
          url: row.url,
          createdAt: (row.created_at instanceof Date) ? row.created_at.toISOString() : row.created_at,
          updatedAt: (row.updated_at instanceof Date) ? row.updated_at.toISOString() : row.updated_at
        };
      }
      await this.db.update(this.tableName, allowed, { id });
      const rows = await this.db.select(this.tableName, { id });
      const row = rows.data[0];
      return {
        id: row.id.toString(),
        title: row.title,
        url: row.url,
        createdAt: (row.created_at instanceof Date) ? row.created_at.toISOString() : row.created_at,
        updatedAt: (row.updated_at instanceof Date) ? row.updated_at.toISOString() : row.updated_at
      };
    } catch (error) {
      logger.error('更新待看项目失败(数据库):', error);
      throw error;
    }
  }

  /**
   * 清空表
   */
  async clearAll() {
    await this.db.query(`DELETE FROM ${this.tableName}`);
  }

  /**
   * 批量插入
   */
  async batchInsert(items) {
    const rows = items.map(i => {
      const url = i.url;
      const url_hash = url ? crypto.createHash('sha256').update(url).digest('hex') : null;
      return {
        id: i.id?.toString() || Date.now().toString(),
        title: i.title || '待看页面',
        url,
        url_hash
      };
    });
    return await this.db.batchInsert(this.tableName, rows);
  }

  /**
   * 获取已有URL集合
   */
  async getExistingUrlSet() {
    const result = await this.db.query(`SELECT url FROM ${this.tableName}`);
    return new Set(result.data.map(r => r.url));
  }
}

module.exports = WatchlistDatabase;