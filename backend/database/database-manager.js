const mysql = require('mysql2/promise');
const { defaultLogger } = require('../utils/logger');

const logger = defaultLogger.child('DatabaseManager');

/**
 * 数据库连接管理器
 * 提供MySQL连接管理和基础CRUD操作
 */
class DatabaseManager {
  constructor() {
    this.pool = null;
    this.config = null;
    this.isConnected = false;
  }

  /**
   * 初始化数据库连接
   * @param {Object} config 数据库配置
   * @param {string} config.host 主机地址
   * @param {number} config.port 端口号
   * @param {string} config.user 用户名
   * @param {string} config.password 密码
   * @param {string} config.database 数据库名
   */
  async init(config) {
    try {
      this.config = {
        host: config.host || 'localhost',
        port: config.port || 3306,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4'
      };

      // 创建连接池
      this.pool = mysql.createPool(this.config);
      
      // 测试连接
      await this.testConnection();
      
      this.isConnected = true;
      logger.info('数据库连接初始化成功');
      
      return { success: true };
    } catch (error) {
      logger.error('数据库连接初始化失败:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * 测试数据库连接
   */
  async testConnection() {
    if (!this.pool) {
      throw new Error('数据库连接池未初始化');
    }

    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      logger.info('数据库连接测试成功');
      return { success: true, message: '数据库连接正常' };
    } catch (error) {
      logger.error('数据库连接测试失败:', error);
      throw new Error(`数据库连接失败: ${error.message}`);
    }
  }

  /**
   * 执行SQL查询
   * @param {string} sql SQL语句
   * @param {Array} params 参数
   */
  async query(sql, params = []) {
    if (!this.pool) {
      throw new Error('数据库连接池未初始化');
    }

    try {
      const [rows, fields] = await this.pool.execute(sql, params);
      return { success: true, data: rows, fields };
    } catch (error) {
      logger.error('SQL查询执行失败:', { sql, params, error: error.message });
      throw error;
    }
  }

  /**
   * 执行事务
   * @param {Function} callback 事务回调函数
   */
  async transaction(callback) {
    if (!this.pool) {
      throw new Error('数据库连接池未初始化');
    }

    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const result = await callback(connection);
      
      await connection.commit();
      connection.release();
      
      return result;
    } catch (error) {
      await connection.rollback();
      connection.release();
      logger.error('事务执行失败:', error);
      throw error;
    }
  }

  /**
   * 插入数据
   * @param {string} table 表名
   * @param {Object} data 数据对象
   */
  async insert(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    
    try {
      const result = await this.query(sql, values);
      return {
        success: true,
        insertId: result.data.insertId,
        affectedRows: result.data.affectedRows
      };
    } catch (error) {
      logger.error('插入数据失败:', { table, data, error: error.message });
      throw error;
    }
  }

  /**
   * 更新数据
   * @param {string} table 表名
   * @param {Object} data 更新数据
   * @param {Object} where 条件
   */
  async update(table, data, where) {
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    const params = [...Object.values(data), ...Object.values(where)];
    
    try {
      const result = await this.query(sql, params);
      return {
        success: true,
        affectedRows: result.data.affectedRows,
        changedRows: result.data.changedRows
      };
    } catch (error) {
      logger.error('更新数据失败:', { table, data, where, error: error.message });
      throw error;
    }
  }

  /**
   * 删除数据
   * @param {string} table 表名
   * @param {Object} where 条件
   */
  async delete(table, where) {
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    const params = Object.values(where);
    
    try {
      const result = await this.query(sql, params);
      return {
        success: true,
        affectedRows: result.data.affectedRows
      };
    } catch (error) {
      logger.error('删除数据失败:', { table, where, error: error.message });
      throw error;
    }
  }

  /**
   * 查询数据
   * @param {string} table 表名
   * @param {Object} where 条件
   * @param {Object} options 选项
   */
  async select(table, where = {}, options = {}) {
    let sql = `SELECT * FROM ${table}`;
    let params = [];
    
    if (Object.keys(where).length > 0) {
      const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
      sql += ` WHERE ${whereClause}`;
      params = Object.values(where);
    }
    
    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }
    
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    
    if (options.offset) {
      sql += ` OFFSET ${options.offset}`;
    }
    
    try {
      const result = await this.query(sql, params);
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      logger.error('查询数据失败:', { table, where, options, error: error.message });
      throw error;
    }
  }

  /**
   * 检查表是否存在
   * @param {string} tableName 表名
   */
  async tableExists(tableName) {
    try {
      const sql = `
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = ?
      `;
      const result = await this.query(sql, [this.config.database, tableName]);
      return result.data[0].count > 0;
    } catch (error) {
      logger.error('检查表是否存在失败:', { tableName, error: error.message });
      return false;
    }
  }

  /**
   * 创建表
   * @param {string} tableName 表名
   * @param {string} createSQL 创建表的SQL语句
   */
  async createTable(tableName, createSQL) {
    try {
      await this.query(createSQL);
      logger.info(`表 ${tableName} 创建成功`);
      return { success: true };
    } catch (error) {
      logger.error(`创建表 ${tableName} 失败:`, error);
      throw error;
    }
  }

  /**
   * 批量插入数据
   * @param {string} table 表名
   * @param {Array} dataArray 数据数组
   */
  async batchInsert(table, dataArray) {
    if (!dataArray || dataArray.length === 0) {
      return { success: true, affectedRows: 0 };
    }

    const keys = Object.keys(dataArray[0]);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    
    try {
      return await this.transaction(async (connection) => {
        let totalAffectedRows = 0;
        
        for (const data of dataArray) {
          const values = keys.map(key => data[key]);
          const [result] = await connection.execute(sql, values);
          totalAffectedRows += result.affectedRows;
        }
        
        return {
          success: true,
          affectedRows: totalAffectedRows
        };
      });
    } catch (error) {
      logger.error('批量插入数据失败:', { table, count: dataArray.length, error: error.message });
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    if (this.pool) {
      try {
        await this.pool.end();
        this.pool = null;
        this.isConnected = false;
        logger.info('数据库连接已关闭');
      } catch (error) {
        logger.error('关闭数据库连接失败:', error);
      }
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      config: this.config ? {
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        database: this.config.database
      } : null
    };
  }
}

module.exports = DatabaseManager;